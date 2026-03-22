"""
Scheduled jobs for Producers.

- Dossier refresh: Monthly for all, biweekly for active relationships.
- AI discovery: Directed scans with focus areas, intelligence profiles, and code-based dedup.
- Intelligence profile: Regenerated before discovery scans.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def dossier_refresh(session_factory):
    """Refresh dossiers based on cadence settings.

    Monthly for all producers, biweekly for active relationships
    (any interaction in the last 90 days). Cadences are configurable via settings.
    """
    from producers.backend.ai import run_dossier_research
    from producers.backend.models import Producer, ProducerSettings

    logger.info("Starting scheduled dossier refresh")
    now = datetime.now(timezone.utc)

    # Read settings and identify which producers need refresh
    with session_factory() as session:
        settings = {
            s.key: s.value
            for s in session.query(ProducerSettings).all()
        }
        baseline_days = settings.get("refresh_baseline_days", 30)
        active_days = settings.get("refresh_active_days", 14)
        active_window = settings.get("active_window_days", 90)

        producers = session.query(Producer).filter(
            Producer.research_status != "in_progress"
        ).all()

        ids_to_refresh = []
        for producer in producers:
            is_active = (
                producer.last_contact_date and
                (now - producer.last_contact_date).days <= active_window
            )
            cadence = active_days if is_active else baseline_days
            if producer.last_research_date:
                days_since = (now - producer.last_research_date).days
                if days_since < cadence:
                    continue
            ids_to_refresh.append(producer.id)

    # Run research in separate sessions per producer
    refreshed = 0
    for pid in ids_to_refresh:
        try:
            with session_factory() as session:
                asyncio.run(run_dossier_research(session, pid, is_refresh=True))
            refreshed += 1
        except Exception:
            logger.exception("Refresh failed for producer %d", pid)

    logger.info("Dossier refresh complete. Refreshed %d producers.", refreshed)


def ai_discovery(session_factory, focus_area: str = None):
    """Run a directed AI discovery scan.

    Each scan:
    1. Determines a focus area (explicit, rotation, or fallback)
    2. Gets the current intelligence profile (database coverage summary)
    3. Gets the calibration summary (distilled dismissal patterns)
    4. Calls the LLM with focus + profile + calibration (no name lists)
    5. Runs multi-signal dedup on each candidate
    6. Stores candidates with dedup results for human review
    """
    from producers.backend.ai import (
        DiscoveryCandidateData,
        call_llm,
        dedup_candidate,
        generate_intelligence_profile,
        get_current_calibration,
        get_current_intelligence_profile,
        maybe_regenerate_calibration,
    )
    from producers.backend.models import (
        DiscoveryCandidate,
        DiscoveryFocusArea,
        DiscoveryScan,
        IntelligenceProfile,
        LookupValue,
    )

    logger.info("Starting AI discovery scan")

    with session_factory() as session:
        # Create scan record
        scan = DiscoveryScan(status="running")

        # Helper to resolve focus_type lookup value
        def _focus_type_id(value):
            lv = session.query(LookupValue).filter_by(
                category="scan_focus_type", value=value
            ).first()
            return lv.id if lv else None

        # Determine focus area
        if focus_area:
            scan.focus_area = focus_area
            scan.focus_type_id = _focus_type_id("manual")
        else:
            # Pick next focus area in rotation (oldest last_used_at first)
            next_focus = (session.query(DiscoveryFocusArea)
                         .filter_by(active=True)
                         .order_by(DiscoveryFocusArea.last_used_at.asc().nullsfirst())
                         .first())
            if next_focus:
                focus_area = f"{next_focus.name}: {next_focus.description or next_focus.name}"
                scan.focus_type_id = _focus_type_id("rotation")
                next_focus.last_used_at = datetime.now(timezone.utc)
            else:
                focus_area = ("General industry scan: look at recent Off-Broadway openings, "
                              "development announcements, festival programs, and co-producing "
                              "credits on shows that share DNA with WN's work.")
                scan.focus_type_id = _focus_type_id("fallback")
            scan.focus_area = focus_area

        # Ensure intelligence profile is fresh (regenerate if none exists)
        latest_profile = (session.query(IntelligenceProfile)
                         .order_by(IntelligenceProfile.generated_at.desc())
                         .first())
        if not latest_profile:
            asyncio.run(generate_intelligence_profile(session))

        intelligence_profile = get_current_intelligence_profile(session)
        calibration_summary = get_current_calibration(session)

        scan.intelligence_profile_snapshot = intelligence_profile
        scan.calibration_snapshot = calibration_summary
        session.add(scan)
        session.flush()  # get scan.id

        slate_info = "Shows tool not yet built. Focus on general industry discovery."

        try:
            response = asyncio.run(call_llm("ai_discovery", {
                "calibration_summary": calibration_summary,
                "focus_area": focus_area,
                "intelligence_profile": intelligence_profile,
                "slate_info": slate_info,
            }, use_web_search=True,
               response_schema=list[DiscoveryCandidateData]))
            candidates_raw = json.loads(response)

            if not candidates_raw or not isinstance(candidates_raw, list):
                logger.warning("AI discovery returned no parseable results")
                scan.status = "complete"
                scan.completed_at = datetime.now(timezone.utc)
                scan.candidates_found = 0
                scan.candidates_after_dedup = 0
                session.commit()
                return

            scan.candidates_found = len(candidates_raw)
            added = 0

            for candidate_data in candidates_raw:
                first_name = candidate_data.get("first_name")
                last_name = candidate_data.get("last_name")
                if not first_name or not last_name:
                    continue

                # Check if already pending
                already_pending = session.query(DiscoveryCandidate).filter(
                    DiscoveryCandidate.first_name.ilike(f"%{first_name}%"),
                    DiscoveryCandidate.last_name.ilike(f"%{last_name}%"),
                    DiscoveryCandidate.status == "pending",
                ).first()
                if already_pending:
                    continue

                # Multi-signal dedup
                dedup_result = dedup_candidate(session, candidate_data)

                # Auto-filter definite duplicates from existing producers
                # (but still store them on the scan for tracking)
                auto_filtered = (
                    dedup_result["status"] == "definite_duplicate"
                    and any(m.get("match_type") == "hard" for m in dedup_result["matches"])
                )

                # Build raw_data with all enriched fields
                raw_data = {
                    k: v for k, v in candidate_data.items()
                    if k not in ("first_name", "last_name", "reasoning", "source")
                }

                candidate = DiscoveryCandidate(
                    scan_id=scan.id,
                    first_name=first_name,
                    last_name=last_name,
                    reasoning=candidate_data.get("reasoning", ""),
                    source=candidate_data.get("source"),
                    raw_data=raw_data,
                    dedup_status=dedup_result["status"],
                    dedup_matches=dedup_result["matches"] if dedup_result["matches"] else None,
                    status="dismissed" if auto_filtered else "pending",
                    dismissed_reason="Auto-filtered: definite duplicate (hard identifier match)" if auto_filtered else None,
                )
                session.add(candidate)
                if not auto_filtered:
                    added += 1

            scan.candidates_after_dedup = added
            scan.status = "complete"
            scan.completed_at = datetime.now(timezone.utc)
            session.commit()

            # Check if calibration needs regeneration
            asyncio.run(maybe_regenerate_calibration(session))

            logger.info("AI discovery complete. Found %d candidates, %d after dedup.",
                        scan.candidates_found, added)

        except Exception:
            logger.exception("AI discovery scan failed")
            scan.status = "failed"
            scan.completed_at = datetime.now(timezone.utc)
            scan.error_detail = "Scan failed — check server logs for details."
            session.commit()


def refresh_intelligence_profile(session_factory):
    """Regenerate the intelligence profile from current database state."""
    from producers.backend.ai import generate_intelligence_profile

    logger.info("Refreshing intelligence profile")
    with session_factory() as session:
        asyncio.run(generate_intelligence_profile(session))
