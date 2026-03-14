"""
AI pipeline for Producers.

Handles dossier research, follow-up extraction, relationship summary
generation, and AI discovery. All functions are designed to be called
from the interface or as background tasks.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from difflib import SequenceMatcher

from producers.backend.models import (
    Award,
    ChangeHistory,
    DiscoveryCalibration,
    DiscoveryCandidate,
    DiscoveryFocusArea,
    DiscoveryScan,
    FollowUpSignal,
    IntelligenceProfile,
    Organization,
    Producer,
    ProducerOrganization,
    ProducerProduction,
    ProducerSettings,
    ProducerTag,
    Production,
    ResearchSource,
    Show,
    Tag,
    Venue,
)
from producers.backend.prompts import (
    AI_DISCOVERY_SYSTEM,
    AI_DISCOVERY_USER,
    AI_QUERY_SYSTEM,
    AI_QUERY_USER,
    DISCOVERY_CALIBRATION_SYSTEM,
    DISCOVERY_CALIBRATION_USER,
    DOSSIER_RESEARCH_SYSTEM,
    DOSSIER_RESEARCH_USER,
    FOLLOW_UP_EXTRACTION_SYSTEM,
    FOLLOW_UP_EXTRACTION_USER,
    INTELLIGENCE_PROFILE_SYSTEM,
    INTELLIGENCE_PROFILE_USER,
    PROMPT_KEYS,
    RELATIONSHIP_SUMMARY_SYSTEM,
    RELATIONSHIP_SUMMARY_USER,
    URL_EXTRACTION_SYSTEM,
    URL_EXTRACTION_USER,
)
from shared.backend.ai.clients import get_anthropic_client, get_google_ai_client

logger = logging.getLogger(__name__)


def _resolve_lookup_id(session, category: str, entity_type: str, value: str):
    """Resolve a string value to a lookup_values.id. Returns None if not found."""
    if not value:
        return None
    from producers.backend.models import LookupValue
    lv = session.query(LookupValue).filter_by(
        category=category, entity_type=entity_type, value=value
    ).first()
    return lv.id if lv else None


# --- Structured output schemas ---

class EmailCandidate(BaseModel):
    email: str
    source: Optional[str] = None
    confidence: Optional[str] = None  # high, medium, low


class IdentityUpdates(BaseModel):
    city: Optional[str] = None
    state_region: Optional[str] = None
    country: Optional[str] = None
    website: Optional[str] = None
    social_links: Optional[list[dict]] = None  # list of {platform, url}
    photo_url: Optional[str] = None


class ProductionData(BaseModel):
    title: str
    year: Optional[int] = None
    scale: Optional[str] = None
    role: Optional[str] = None
    venue: Optional[str] = None
    run_length: Optional[str] = None
    description: Optional[str] = None


class OrganizationData(BaseModel):
    name: str
    role_title: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class DossierResearchResponse(BaseModel):
    email_candidates: Optional[list[EmailCandidate]] = None
    identity_updates: Optional[IdentityUpdates] = None
    productions: Optional[list[ProductionData]] = None
    organizations: Optional[list[OrganizationData]] = None
    sources_consulted: Optional[list[str]] = None
    research_gaps: Optional[list[str]] = None


class FollowUpSignalData(BaseModel):
    implied_action: str
    timeframe: Optional[str] = None
    due_date: Optional[str] = None


class URLExtractionResponse(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    organization: Optional[str] = None
    org_role: Optional[str] = None
    city: Optional[str] = None
    state_region: Optional[str] = None
    country: Optional[str] = None
    website: Optional[str] = None
    social_links: Optional[list[dict]] = None


class DiscoveryCandidateProduction(BaseModel):
    title: str
    year: Optional[int] = None
    venue: Optional[str] = None
    role: Optional[str] = None
    scale: Optional[str] = None


class DiscoveryCandidateData(BaseModel):
    first_name: str
    last_name: str
    reasoning: str
    source: Optional[str] = None
    organization: Optional[str] = None
    organization_role: Optional[str] = None
    city: Optional[str] = None
    state_region: Optional[str] = None
    country: Optional[str] = None
    email_candidates: Optional[list[EmailCandidate]] = None
    website: Optional[str] = None
    social_links: Optional[list[dict]] = None  # list of {platform, url}
    recent_productions: Optional[list[DiscoveryCandidateProduction]] = None


# --- Model configuration ---

# Available models grouped by provider
MODEL_OPTIONS = {
    "anthropic": [
        {"id": "claude-opus-4-6", "label": "Claude Opus 4.6", "tier": "high"},
        {"id": "claude-sonnet-4-6", "label": "Claude Sonnet 4.6", "tier": "mid"},
        {"id": "claude-sonnet-4-5-20250929", "label": "Claude Sonnet 4.5", "tier": "mid"},
        {"id": "claude-haiku-4-5-20251001", "label": "Claude Haiku 4.5", "tier": "low"},
    ],
    "google": [
        {"id": "gemini-3.1-pro", "label": "Gemini 3.1 Pro", "tier": "high"},
        {"id": "gemini-3-flash", "label": "Gemini 3 Flash", "tier": "mid"},
        {"id": "gemini-3.1-flash-lite", "label": "Gemini 3.1 Flash-Lite", "tier": "low"},
        {"id": "gemini-2.5-pro", "label": "Gemini 2.5 Pro", "tier": "high"},
        {"id": "gemini-2.5-flash", "label": "Gemini 2.5 Flash", "tier": "mid"},
    ],
}

# Default model per behavior — chosen based on task complexity and cost
# Research/discovery need web search and thorough reasoning → Sonnet 4.6
# Simple extraction tasks → Haiku (cheaper, faster)
# User-facing tasks → Sonnet 4.6 (quality matters)
DEFAULT_MODELS = {
    "url_extraction": "claude-haiku-4-5-20251001",  # Simple extraction from page content
    "dossier_research": "claude-sonnet-4-6",       # Web search + thorough analysis
    "follow_up_extraction": "claude-haiku-4-5-20251001",  # Simple structured extraction
    "relationship_summary": "claude-sonnet-4-6",    # Writing quality matters
    "ai_discovery": "claude-sonnet-4-6",            # Web search + strategic reasoning
    "ai_query": "claude-sonnet-4-6",                # User-facing, needs good reasoning
}

# Settings keys for model selection
MODEL_SETTING_KEYS = {
    behavior: f"model_{behavior}" for behavior in DEFAULT_MODELS
}


def _get_provider(model_id: str) -> str:
    """Determine provider from model ID."""
    if model_id.startswith("claude-"):
        return "anthropic"
    if model_id.startswith("gemini-"):
        return "google"
    return "anthropic"  # fallback


def _get_prompt(session: Session, behavior: str, prompt_type: str, default: str) -> str:
    """Get a prompt from settings (if customized) or return the default."""
    key = PROMPT_KEYS.get(behavior, {}).get(prompt_type)
    if not key:
        return default
    setting = session.query(ProducerSettings).filter_by(key=key).first()
    if setting and setting.value:
        return setting.value
    return default


def _get_model(session: Session, behavior: str) -> str:
    """Get the configured model for a behavior, or the default."""
    key = MODEL_SETTING_KEYS.get(behavior)
    if key:
        setting = session.query(ProducerSettings).filter_by(key=key).first()
        if setting and setting.value:
            return str(setting.value)
    return DEFAULT_MODELS.get(behavior, "claude-sonnet-4-6")


def _call_llm(model: str, system: str, user: str,
              use_web_search: bool = False,
              response_schema: type[BaseModel] | None = None,
              response_list: bool = False) -> str:
    """Call an LLM (Anthropic or Google) and return the text response.

    Routes to the correct provider based on model ID prefix.
    When response_schema is provided, uses native structured output.
    When response_list is True, the schema is wrapped in a list.
    """
    provider = _get_provider(model)

    if provider == "google":
        return _call_gemini(model, system, user, use_web_search,
                            response_schema, response_list)
    else:
        return _call_claude(model, system, user, use_web_search,
                            response_schema, response_list)


def _call_claude(model: str, system: str, user: str,
                 use_web_search: bool = False,
                 response_schema: type[BaseModel] | None = None,
                 response_list: bool = False) -> str:
    """Call Claude and return the text response. Uses structured output when schema provided."""
    client = get_anthropic_client()
    kwargs = {
        "model": model,
        "max_tokens": 4096,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    if use_web_search:
        kwargs["tools"] = [{"type": "web_search_20250305", "name": "web_search", "max_uses": 10}]
        kwargs["max_tokens"] = 16000

    if response_schema:
        schema = response_schema.model_json_schema()
        if response_list:
            json_schema = {
                "type": "array",
                "items": schema,
            }
        else:
            json_schema = schema
        # Remove pydantic metadata keys that Claude doesn't accept
        def _clean_schema(s):
            if isinstance(s, dict):
                return {k: _clean_schema(v) for k, v in s.items() if k != "title"}
            if isinstance(s, list):
                return [_clean_schema(i) for i in s]
            return s
        json_schema = _clean_schema(json_schema)
        kwargs["betas"] = ["structured-outputs-2025-11-13"]
        kwargs["output_format"] = {
            "type": "json_schema",
            "json_schema": {
                "name": response_schema.__name__,
                "schema": json_schema,
            },
        }
        response = client.beta.messages.create(**kwargs)
    else:
        response = client.messages.create(**kwargs)

    text_parts = []
    for block in response.content:
        if hasattr(block, "text"):
            text_parts.append(block.text)
    return "\n".join(text_parts)


def _call_gemini(model: str, system: str, user: str,
                 use_web_search: bool = False,
                 response_schema: type[BaseModel] | None = None,
                 response_list: bool = False) -> str:
    """Call Gemini and return the text response. Uses structured output when schema provided."""
    from google.genai import types

    client = get_google_ai_client()

    config_kwargs = {
        "system_instruction": system,
    }
    tools = []
    if use_web_search:
        tools.append(types.Tool(google_search=types.GoogleSearch()))
    if tools:
        config_kwargs["tools"] = tools

    if response_schema:
        config_kwargs["response_mime_type"] = "application/json"
        if response_list:
            config_kwargs["response_schema"] = list[response_schema]
        else:
            config_kwargs["response_schema"] = response_schema

    response = client.models.generate_content(
        model=model,
        contents=user,
        config=types.GenerateContentConfig(**config_kwargs),
    )
    return response.text or ""
    return None


def _log_change(session: Session, entity_type: str, entity_id: int, field: str,
                old_val, new_val, changed_by: str):
    """Record a field-level change in change history."""
    if str(old_val) == str(new_val):
        return
    session.add(ChangeHistory(
        entity_type=entity_type,
        entity_id=entity_id,
        field_name=field,
        old_value=str(old_val) if old_val is not None else None,
        new_value=str(new_val) if new_val is not None else None,
        changed_by=changed_by,
    ))


def _get_managed_sources(session: Session) -> str:
    """Get the managed source list as formatted text."""
    sources = session.query(ResearchSource).order_by(ResearchSource.sort_order).all()
    if not sources:
        return "IBDB, Playbill, BroadwayWorld, LinkedIn, company websites"
    return ", ".join(s.name for s in sources)


def _set_research_step(session: Session, producer, status: str, detail: str):
    """Update research status and detail, committing immediately so the frontend can poll."""
    producer.research_status = status
    producer.research_status_detail = detail
    session.commit()


# --- Discovery intelligence ---


def generate_intelligence_profile(session: Session) -> IntelligenceProfile:
    """Generate a compact summary of the database's producer coverage.

    Used as context for discovery scans instead of dumping a name list.
    """
    producers = session.query(Producer).all()
    producer_count = len(producers)

    if producer_count == 0:
        profile = IntelligenceProfile(
            profile_text="Empty database — no producers tracked yet. Discovery should cast a wide net.",
            producer_count=0,
        )
        session.add(profile)
        session.commit()
        return profile

    # Org coverage
    org_rows = (
        session.query(Organization.name, func.count(ProducerOrganization.producer_id))
        .join(ProducerOrganization)
        .group_by(Organization.name)
        .order_by(func.count(ProducerOrganization.producer_id).desc())
        .all()
    )
    org_summary = "\n".join(f"- {name}: {count} producer{'s' if count != 1 else ''}" for name, count in org_rows) or "No organizational affiliations recorded."

    # Geographic distribution
    geo_counts = {}
    for p in producers:
        loc = ", ".join(filter(None, [p.city, p.state_region, p.country])) or "Unknown"
        geo_counts[loc] = geo_counts.get(loc, 0) + 1
    geo_sorted = sorted(geo_counts.items(), key=lambda x: -x[1])
    geographic_summary = "\n".join(f"- {loc}: {count}" for loc, count in geo_sorted) or "No location data."

    # Aesthetic coverage
    genre_counts = {}
    for p in producers:
        for g in (p.genres or []):
            genre_counts[g] = genre_counts.get(g, 0) + 1
    genre_sorted = sorted(genre_counts.items(), key=lambda x: -x[1])
    aesthetic_summary = "\n".join(f"- {g}: {count}" for g, count in genre_sorted) or "No genre data."

    # Scale distribution
    scale_counts = {}
    for p in producers:
        s = p.scale_preference or "Unknown"
        scale_counts[s] = scale_counts.get(s, 0) + 1
    scale_sorted = sorted(scale_counts.items(), key=lambda x: -x[1])
    scale_summary = "\n".join(f"- {s}: {count}" for s, count in scale_sorted) or "No scale data."

    # Call LLM to produce the narrative profile
    system = _get_prompt(session, "intelligence_profile", "system", INTELLIGENCE_PROFILE_SYSTEM)
    user_template = _get_prompt(session, "intelligence_profile", "user", INTELLIGENCE_PROFILE_USER)
    user = user_template.format(
        producer_count=producer_count,
        org_summary=org_summary,
        geographic_summary=geographic_summary,
        aesthetic_summary=aesthetic_summary,
        scale_summary=scale_summary,
    )
    model = _get_model(session, "intelligence_profile")

    try:
        profile_text = _call_llm(model, system, user)
    except Exception:
        logger.exception("Failed to generate intelligence profile via LLM")
        # Fall back to raw data summary
        profile_text = f"Database: {producer_count} producers.\n\nOrganizations:\n{org_summary}\n\nGeography:\n{geographic_summary}\n\nGenres:\n{aesthetic_summary}\n\nScale:\n{scale_summary}"

    profile = IntelligenceProfile(
        profile_text=profile_text,
        producer_count=producer_count,
        org_coverage=org_summary,
        geographic_distribution=geographic_summary,
        aesthetic_coverage=aesthetic_summary,
        scale_distribution=scale_summary,
    )
    session.add(profile)
    session.commit()
    logger.info("Generated intelligence profile for %d producers", producer_count)
    return profile


def get_current_intelligence_profile(session: Session) -> str:
    """Return the most recent intelligence profile text."""
    profile = (session.query(IntelligenceProfile)
               .order_by(IntelligenceProfile.generated_at.desc())
               .first())
    if profile:
        return profile.profile_text
    return "No intelligence profile generated yet. Database coverage is unknown — cast a wide net."


def generate_calibration_summary(session: Session) -> DiscoveryCalibration | None:
    """Distill all dismissal patterns into a concise calibration summary."""
    dismissed = (session.query(DiscoveryCandidate)
                 .filter_by(status="dismissed")
                 .all())
    total = len(dismissed)

    if total < 5:
        return None  # Not enough data to calibrate

    dismissals_data = "\n".join(
        f"- {d.first_name} {d.last_name}: {d.dismissed_reason or d.reasoning}"
        for d in dismissed
    )

    system = _get_prompt(session, "discovery_calibration", "system", DISCOVERY_CALIBRATION_SYSTEM)
    user_template = _get_prompt(session, "discovery_calibration", "user", DISCOVERY_CALIBRATION_USER)
    user = user_template.format(total_count=total, dismissals_data=dismissals_data)
    model = _get_model(session, "discovery_calibration")

    try:
        calibration_text = _call_llm(model, system, user)
    except Exception:
        logger.exception("Failed to generate calibration summary")
        return None

    calibration = DiscoveryCalibration(
        calibration_text=calibration_text,
        dismissal_count=total,
    )
    session.add(calibration)
    session.commit()
    logger.info("Generated discovery calibration from %d dismissals", total)
    return calibration


def get_current_calibration(session: Session) -> str:
    """Return the most recent calibration summary text."""
    cal = (session.query(DiscoveryCalibration)
           .order_by(DiscoveryCalibration.generated_at.desc())
           .first())
    if cal:
        return f"\nCalibration from past dismissals ({cal.dismissal_count} reviewed):\n{cal.calibration_text}"
    return "\nNo calibration data yet — this is an early scan."


def maybe_regenerate_calibration(session: Session):
    """Regenerate calibration if dismissals have accumulated since last generation."""
    current_dismissed = session.query(DiscoveryCandidate).filter_by(status="dismissed").count()
    latest = (session.query(DiscoveryCalibration)
              .order_by(DiscoveryCalibration.generated_at.desc())
              .first())
    last_count = latest.dismissal_count if latest else 0

    if current_dismissed - last_count >= 10:
        generate_calibration_summary(session)


def _normalize_url(url: str | None) -> str | None:
    """Normalize a URL for comparison — strip protocol, www, trailing slash."""
    if not url:
        return None
    url = url.strip().lower()
    for prefix in ("https://", "http://", "www."):
        if url.startswith(prefix):
            url = url[len(prefix):]
    return url.rstrip("/")


def dedup_candidate(session: Session, candidate_data: dict) -> dict:
    """Match a discovery candidate against existing producers and dismissed candidates.

    Returns {status, matches} where status is clean/potential_duplicate/definite_duplicate.
    """
    matches = []

    first = candidate_data.get("first_name", "")
    last = candidate_data.get("last_name", "")
    candidate_social = candidate_data.get("social_links") or []
    candidate_linkedin = None
    for sl in candidate_social:
        if sl.get("platform", "").lower() == "linkedin":
            candidate_linkedin = _normalize_url(sl.get("url"))
            break
    candidate_website = _normalize_url(candidate_data.get("website"))
    candidate_emails = {
        c.get("email", "").lower()
        for c in (candidate_data.get("email_candidates") or [])
        if c.get("email")
    }

    producers = session.query(Producer).all()

    for p in producers:
        signals = []

        # Hard matches: LinkedIn, email, website
        if candidate_linkedin:
            for sl in (p.social_links or []):
                if sl.get("platform", "").lower() == "linkedin" and _normalize_url(sl.get("url")) == candidate_linkedin:
                    signals.append("linkedin_match")
                    break
        if candidate_website and _normalize_url(p.website) == candidate_website:
            signals.append("website_match")
        if p.email and p.email.lower() in candidate_emails:
            signals.append("email_match")
        if p.email_candidates:
            existing_emails = {c.get("email", "").lower() for c in p.email_candidates if c.get("email")}
            if candidate_emails & existing_emails:
                signals.append("email_candidate_match")

        # Soft match: name similarity
        name_ratio = SequenceMatcher(None, f"{first} {last}".lower(), f"{p.first_name} {p.last_name}".lower()).ratio()
        if name_ratio > 0.85:
            signals.append(f"name_similarity_{name_ratio:.0%}")

        if signals:
            is_hard = any(s in ("linkedin_match", "email_match", "website_match") for s in signals)
            matches.append({
                "producer_id": p.id,
                "first_name": p.first_name,
                "last_name": p.last_name,
                "match_type": "hard" if is_hard else "soft",
                "confidence": "definite" if is_hard else "possible",
                "signals": signals,
            })

    # Also check dismissed candidates (avoid resurfacing)
    dismissed = (session.query(DiscoveryCandidate)
                 .filter_by(status="dismissed")
                 .all())
    for d in dismissed:
        name_ratio = SequenceMatcher(None, f"{first} {last}".lower(), f"{d.first_name} {d.last_name}".lower()).ratio()
        if name_ratio > 0.85:
            matches.append({
                "dismissed_candidate_id": d.id,
                "candidate_name": f"{d.first_name} {d.last_name}",
                "match_type": "previously_dismissed",
                "confidence": "definite" if name_ratio > 0.95 else "possible",
                "signals": [f"name_similarity_{name_ratio:.0%}"],
                "dismissed_reason": d.dismissed_reason,
            })

    if not matches:
        return {"status": "clean", "matches": []}

    has_hard = any(m["match_type"] == "hard" for m in matches)
    has_definite_dismissed = any(m["match_type"] == "previously_dismissed" and m["confidence"] == "definite" for m in matches)

    if has_hard or has_definite_dismissed:
        return {"status": "definite_duplicate", "matches": matches}
    return {"status": "potential_duplicate", "matches": matches}


def run_dossier_research(session: Session, producer_id: int, is_refresh: bool = False):
    """Run AI research to populate/refresh a producer's dossier fields.

    This is the core research pipeline — called at intake, on refresh,
    and on manual trigger.
    """
    producer = session.get(Producer, producer_id)
    if not producer:
        logger.error("Producer %d not found for research", producer_id)
        return

    full_name = f"{producer.first_name} {producer.last_name}"
    _set_research_step(session, producer, "in_progress", f"Starting research for {full_name}")

    try:
        changed_by = "AI refresh" if is_refresh else "AI research"

        # Build seed data from what we know
        _set_research_step(session, producer, "in_progress", "Gathering seed data from existing records")
        seed_parts = []
        # Get primary email from entity_emails table
        from producers.backend.models import EntityEmail
        _primary_email = (session.query(EntityEmail)
                          .filter_by(entity_type="producer", entity_id=producer_id, is_primary=True)
                          .first())
        if not _primary_email:
            _primary_email = (session.query(EntityEmail)
                              .filter_by(entity_type="producer", entity_id=producer_id)
                              .first())
        if _primary_email:
            seed_parts.append(f"Email: {_primary_email.email}")
        # Get current org
        current_orgs = [
            po for po in producer.organizations
            if po.organization and po.end_date is None
        ]
        for po in current_orgs:
            seed_parts.append(f"Organization: {po.organization.name} ({po.role_title or 'member'})")
        if producer.intake_source_url:
            seed_parts.append(f"Source URL: {producer.intake_source_url}")
        seed_data = "\n".join(seed_parts) if seed_parts else "No additional information available."

        sources = _get_managed_sources(session)

        system = _get_prompt(session, "dossier_research", "system", DOSSIER_RESEARCH_SYSTEM)
        user_template = _get_prompt(session, "dossier_research", "user", DOSSIER_RESEARCH_USER)
        user = user_template.format(name=full_name, seed_data=seed_data, sources=sources)
        model = _get_model(session, "dossier_research")

        _set_research_step(session, producer, "in_progress",
                           f"Searching the web and industry sources for {full_name}")
        response_text = _call_llm(model, system, user, use_web_search=True,
                                  response_schema=DossierResearchResponse)

        _set_research_step(session, producer, "in_progress", "Parsing AI response")
        data = json.loads(response_text)

        if not data or not isinstance(data, dict):
            _set_research_step(session, producer, "failed",
                               "AI returned an unparseable response. The model may have been unable to find "
                               "information, or the response format was unexpected. Try refreshing again.")
            logger.error("Failed to parse research response for producer %d", producer_id)
            return

        # Update identity fields if found
        identity = data.get("identity_updates", {})
        if identity:
            for field in ["city", "state_region", "country", "website", "photo_url"]:
                val = identity.get(field)
                if val:
                    old = getattr(producer, field)
                    if not old:  # Only fill if empty (don't override human edits)
                        setattr(producer, field, val)
                        _log_change(session, "producer", producer_id, field, old, val, changed_by)
                        fields_updated += 1

            # Merge social links from identity updates into entity_social_links
            social_links_update = identity.get("social_links")
            if social_links_update:
                from producers.backend.models import EntitySocialLink, SocialPlatform as SP
                existing_links = (session.query(EntitySocialLink)
                                  .filter_by(entity_type="producer", entity_id=producer_id)
                                  .all())
                existing_platform_ids = {l.platform_id for l in existing_links}
                for sl in social_links_update:
                    platform = session.query(SP).filter_by(name=sl.get("platform")).first()
                    if platform and platform.id not in existing_platform_ids:
                        session.add(EntitySocialLink(
                            entity_type="producer", entity_id=producer_id,
                            platform_id=platform.id, url=sl.get("url", ""),
                        ))
                        _log_change(session, "producer", producer_id, "social_link_added",
                                    None, f"{sl.get('platform')}: {sl.get('url', '')}", changed_by)
                        fields_updated += 1

        # Process email candidates into entity_emails table
        email_candidates = data.get("email_candidates", [])
        if email_candidates:
            _set_research_step(session, producer, "in_progress",
                               f"Processing {len(email_candidates)} email candidate{'' if len(email_candidates) == 1 else 's'}")
            from producers.backend.models import EntityEmail as EE
            existing_emails = {
                e.email for e in
                session.query(EE).filter_by(entity_type="producer", entity_id=producer_id).all()
            }
            has_primary = session.query(EE).filter_by(
                entity_type="producer", entity_id=producer_id, is_primary=True
            ).count() > 0

            high_conf = next(
                (c for c in email_candidates
                 if c.get("confidence") == "high" and c.get("email")),
                None
            )

            for c in email_candidates:
                email_addr = c.get("email")
                if not email_addr or email_addr in existing_emails:
                    continue
                make_primary = (not has_primary and high_conf and email_addr == high_conf["email"])
                session.add(EE(
                    entity_type="producer", entity_id=producer_id,
                    email=email_addr, source=c.get("source"),
                    confidence=c.get("confidence"), is_primary=make_primary,
                ))
                if make_primary:
                    has_primary = True
                _log_change(session, "producer", producer_id, "email_added",
                            None, email_addr, changed_by)
                fields_updated += 1

        # Process productions
        productions_data = data.get("productions", [])
        if productions_data:
            _set_research_step(session, producer, "in_progress",
                               f"Processing {len(productions_data)} production{'' if len(productions_data) == 1 else 's'}")
        for prod_data in productions_data:
            _upsert_production(session, producer_id, prod_data, changed_by)

        # Process organizations
        orgs_data = data.get("organizations", [])
        if orgs_data:
            _set_research_step(session, producer, "in_progress",
                               f"Processing {len(orgs_data)} organization{'' if len(orgs_data) == 1 else 's'}")
        for org_data in orgs_data:
            _upsert_organization(session, producer_id, org_data, changed_by)

        # Build completion summary
        summary_parts = []
        if fields_updated:
            summary_parts.append(f"{fields_updated} dossier fields")
        if productions_data:
            summary_parts.append(f"{len(productions_data)} production{'' if len(productions_data) == 1 else 's'}")
        if orgs_data:
            summary_parts.append(f"{len(orgs_data)} organization{'' if len(orgs_data) == 1 else 's'}")
        if email_candidates:
            summary_parts.append(f"{len(email_candidates)} email candidate{'' if len(email_candidates) == 1 else 's'}")
        gaps = data.get("research_gaps")
        if gaps:
            summary_parts.append(f"{len(gaps)} gap{'' if len(gaps) == 1 else 's'} noted")

        completion_detail = f"Updated {', '.join(summary_parts)}." if summary_parts else "No new information found."

        # Update metadata
        producer.last_research_date = datetime.now(timezone.utc)
        producer.research_sources_consulted = data.get("sources_consulted")
        producer.research_gaps = gaps
        _set_research_step(session, producer, "complete", completion_detail)

        logger.info("Completed research for producer %d (%s): %s", producer_id, full_name, completion_detail)

    except Exception as exc:
        # Store the actual error so the user knows what went wrong
        error_msg = str(exc)
        if "rate" in error_msg.lower() or "429" in error_msg:
            detail = "API rate limit reached. The research will be retried on the next refresh cycle."
        elif "timeout" in error_msg.lower():
            detail = "Request timed out. The AI service may be temporarily slow. Try again in a few minutes."
        elif "api" in error_msg.lower() or "key" in error_msg.lower() or "auth" in error_msg.lower():
            detail = f"API error: {error_msg}"
        else:
            detail = f"Unexpected error: {error_msg}"
        _set_research_step(session, producer, "failed", detail)
        logger.exception("Research failed for producer %d", producer_id)


def _upsert_production(session: Session, producer_id: int, prod_data: dict, changed_by: str):
    """Create or find a production and link it to a producer."""
    title = prod_data.get("title")
    if not title:
        return

    # Find or create venue
    venue = None
    venue_name = prod_data.get("venue")
    if venue_name:
        venue = session.query(Venue).filter_by(name=venue_name).first()
        if not venue:
            venue = Venue(
                name=venue_name,
                venue_type_id=_resolve_lookup_id(session, "venue_type", "venue", prod_data.get("venue_type")),
                city=prod_data.get("venue_city"),
                state_region=prod_data.get("venue_state_region"),
                country=prod_data.get("venue_country"),
            )
            session.add(venue)
            session.flush()

    # Find or create the underlying show (work as IP)
    show = session.query(Show).filter_by(title=title).first()
    if not show:
        show = Show(
            title=title,
            medium_id=_resolve_lookup_id(session, "medium", "show", prod_data.get("medium")),
            original_year=prod_data.get("year"),
        )
        session.add(show)
        session.flush()

    # Find or create production, update existing on refresh
    production = session.query(Production).filter_by(title=title).first()
    if not production:
        production = Production(
            show_id=show.id,
            title=title,
            venue_id=venue.id if venue else None,
            year=prod_data.get("year"),
            scale_id=_resolve_lookup_id(session, "scale", "production", prod_data.get("scale")),
            run_length=prod_data.get("run_length"),
            description=prod_data.get("description"),
        )
        # Parse dates
        for date_field in ["start_date", "end_date"]:
            date_str = prod_data.get(date_field)
            if date_str:
                try:
                    setattr(production, date_field, datetime.strptime(date_str, "%Y-%m-%d").date())
                except (ValueError, TypeError):
                    pass
        session.add(production)
        session.flush()

        # Add awards (owned by producer, optionally linked to production)
        for award_data in prod_data.get("awards", []):
            session.add(Award(
                producer_id=producer_id,
                production_id=production.id,
                award_name=award_data.get("award_name", ""),
                category=award_data.get("category"),
                year=award_data.get("year"),
                outcome_id=_resolve_lookup_id(session, "award_outcome", "award", award_data.get("outcome")),
            ))
    else:
        # Update existing production data on refresh
        if venue and not production.venue_id:
            production.venue_id = venue.id
        # Resolve scale
        new_scale_id = _resolve_lookup_id(session, "scale", "production", prod_data.get("scale"))
        if new_scale_id and production.scale_id != new_scale_id:
            production.scale_id = new_scale_id
        for field, key in [("year", "year"),
                           ("run_length", "run_length"), ("description", "description")]:
            new_val = prod_data.get(key)
            if new_val and not getattr(production, field):
                setattr(production, field, new_val)
        for date_field in ["start_date", "end_date"]:
            date_str = prod_data.get(date_field)
            if date_str and not getattr(production, date_field):
                try:
                    setattr(production, date_field, datetime.strptime(date_str, "%Y-%m-%d").date())
                except (ValueError, TypeError):
                    pass
        # Add any new awards (owned by producer, optionally linked to production)
        existing_awards = {(a.award_name, a.category, a.year) for a in
                          session.query(Award).filter_by(producer_id=producer_id, production_id=production.id).all()}
        for award_data in prod_data.get("awards", []):
            key = (award_data.get("award_name", ""), award_data.get("category"), award_data.get("year"))
            if key not in existing_awards:
                session.add(Award(
                    producer_id=producer_id,
                    production_id=production.id,
                    award_name=award_data.get("award_name", ""),
                    category=award_data.get("category"),
                    year=award_data.get("year"),
                    outcome_id=_resolve_lookup_id(session, "award_outcome", "award", award_data.get("outcome")),
                ))
        session.flush()

    # Link producer to production
    existing_link = session.query(ProducerProduction).filter_by(
        producer_id=producer_id, production_id=production.id
    ).first()
    if not existing_link:
        session.add(ProducerProduction(
            producer_id=producer_id,
            production_id=production.id,
            role_id=_resolve_lookup_id(session, "role", "producer_production", prod_data.get("role")),
        ))
        _log_change(session, "producer", producer_id, "production_added",
                     None, title, changed_by)

    session.flush()


def _upsert_organization(session: Session, producer_id: int, org_data: dict, changed_by: str):
    """Create or find an organization and link it to a producer."""
    name = org_data.get("name")
    if not name:
        return

    org = session.query(Organization).filter_by(name=name).first()
    if not org:
        org = Organization(
            name=name,
            org_type_id=_resolve_lookup_id(session, "org_type", "organization", org_data.get("org_type")),
            website=org_data.get("website"),
            city=org_data.get("city"),
            state_region=org_data.get("state_region"),
            country=org_data.get("country"),
        )
        session.add(org)
        session.flush()

    # Check for existing affiliation
    existing = session.query(ProducerOrganization).filter_by(
        producer_id=producer_id, organization_id=org.id
    ).first()
    if not existing:
        po = ProducerOrganization(
            producer_id=producer_id,
            organization_id=org.id,
            role_title=org_data.get("role_title"),
            notes=org_data.get("notes"),
        )
        for date_field in ["start_date", "end_date"]:
            date_str = org_data.get(date_field)
            if date_str:
                try:
                    setattr(po, date_field, datetime.strptime(date_str, "%Y-%m-%d").date())
                except (ValueError, TypeError):
                    pass
        session.add(po)
        _log_change(session, "producer", producer_id, "organization_added",
                     None, name, changed_by)
        session.flush()


def extract_follow_ups(session: Session, interaction_id: int, producer_id: int,
                       producer_name: str, content: str, date: str, author: str):
    """Extract follow-up signals from an interaction's text."""
    system = _get_prompt(session, "follow_up_extraction", "system", FOLLOW_UP_EXTRACTION_SYSTEM)
    user_template = _get_prompt(session, "follow_up_extraction", "user", FOLLOW_UP_EXTRACTION_USER)
    user = user_template.format(
        producer_name=producer_name, date=date, author=author, content=content
    )
    model = _get_model(session, "follow_up_extraction")

    response_text = _call_llm(model, system, user,
                              response_schema=FollowUpSignalData, response_list=True)
    signals = json.loads(response_text)

    if not signals or not isinstance(signals, list):
        return

    for signal_data in signals:
        due_date = None
        date_str = signal_data.get("due_date")
        if date_str:
            try:
                due_date = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except (ValueError, TypeError):
                pass

        session.add(FollowUpSignal(
            interaction_id=interaction_id,
            producer_id=producer_id,
            implied_action=signal_data.get("implied_action", ""),
            timeframe=signal_data.get("timeframe"),
            due_date=due_date,
        ))
    session.flush()


def regenerate_relationship_summary(session: Session, producer_id: int):
    # TODO: dead code pending pipeline redesign
    """Regenerate the natural language relationship summary for a producer."""
    from producers.backend.models import Interaction

    producer = session.get(Producer, producer_id)
    if not producer:
        return

    # Get recent interactions
    recent = (session.query(Interaction)
              .filter_by(producer_id=producer_id)
              .order_by(Interaction.date.desc())
              .limit(10)
              .all())

    if not recent:
        producer.relationship_summary = None
        return

    interactions_text = "\n".join(
        f"- {i.date.strftime('%Y-%m-%d') if i.date else 'Unknown date'}: ({i.author}) {i.content}"
        for i in recent
    )

    # Get pending follow-ups
    pending = (session.query(FollowUpSignal)
               .filter_by(producer_id=producer_id, resolved=False)
               .all())
    followups_text = "\n".join(
        f"- {f.implied_action} (timeframe: {f.timeframe or 'unspecified'})"
        for f in pending
    ) if pending else "None"

    last_contact = producer.last_contact_date.strftime("%Y-%m-%d") if producer.last_contact_date else "Never"

    system = _get_prompt(session, "relationship_summary", "system", RELATIONSHIP_SUMMARY_SYSTEM)
    user_template = _get_prompt(session, "relationship_summary", "user", RELATIONSHIP_SUMMARY_USER)
    user = user_template.format(
        name=f"{producer.first_name} {producer.last_name}",
        interaction_count=producer.interaction_count or 0,
        last_contact=last_contact,
        recent_interactions=interactions_text,
        pending_followups=followups_text,
    )
    model = _get_model(session, "relationship_summary")

    response_text = _call_llm(model, system, user)
    old_summary = producer.relationship_summary
    producer.relationship_summary = response_text.strip()
    _log_change(session, "producer", producer_id, "relationship_summary",
                old_summary, producer.relationship_summary, "AI research")


def recompute_relationship_state(session: Session, producer_id: int):
    """Recompute stored relationship state fields from interaction data."""
    from producers.backend.models import Interaction

    producer = session.get(Producer, producer_id)
    if not producer:
        return

    interactions = (session.query(Interaction)
                    .filter_by(producer_id=producer_id)
                    .order_by(Interaction.date.desc())
                    .all())

    count = len(interactions)
    producer.interaction_count = count

    if count > 0:
        producer.last_contact_date = interactions[0].date

        if count > 1:
            dates = [i.date for i in interactions if i.date]
            if len(dates) > 1:
                deltas = []
                for j in range(len(dates) - 1):
                    delta = (dates[j] - dates[j + 1]).total_seconds() / 86400
                    deltas.append(delta)
                producer.interaction_frequency = sum(deltas) / len(deltas)
    else:
        producer.last_contact_date = None
        producer.interaction_frequency = None

    # Check for next follow-up due
    pending = (session.query(FollowUpSignal)
               .filter_by(producer_id=producer_id, resolved=False)
               .filter(FollowUpSignal.due_date.isnot(None))
               .order_by(FollowUpSignal.due_date)
               .first())
    producer.next_followup_due = pending.due_date if pending else None

    session.flush()


def get_relationship_state_label(producer: Producer, cold_threshold_days: int = 90) -> str:
    """Derive the relationship state label from stored fields + current date.

    Args:
        producer: The producer record with pre-computed relationship fields.
        cold_threshold_days: Base threshold for "gone cold" (default 90, configurable via settings).
    """
    now = datetime.now(timezone.utc)

    if not producer.interaction_count or producer.interaction_count == 0:
        return "no_contact"

    # Check for overdue follow-ups
    if producer.next_followup_due and producer.next_followup_due < now:
        return "overdue"

    # Check for pending follow-ups (waiting)
    if producer.next_followup_due:
        return "waiting"

    if producer.interaction_count <= 2:
        if producer.last_contact_date:
            days_since = (now - producer.last_contact_date).days
            if days_since <= 30:
                return "new"

    # Check for gone cold — gap > 2x average frequency or beyond threshold
    if producer.last_contact_date:
        days_since = (now - producer.last_contact_date).days

        effective_threshold = cold_threshold_days
        if producer.interaction_frequency and producer.interaction_frequency > 0:
            effective_threshold = max(effective_threshold, producer.interaction_frequency * 2)

        if days_since > effective_threshold:
            return "gone_cold"

        if days_since <= 30:
            return "active"

    return "active"


def extract_from_url(session: Session, url: str) -> dict | None:
    """Fetch a URL and extract producer identity using AI."""
    import httpx

    try:
        resp = httpx.get(url, follow_redirects=True, timeout=15,
                         headers={"User-Agent": "Mozilla/5.0 (compatible; WN Intelligence)"})
        resp.raise_for_status()
        # Strip HTML tags for a rough text extraction
        import re
        text = re.sub(r'<script[^>]*>.*?</script>', '', resp.text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<[^>]+>', ' ', text)
        text = re.sub(r'\s+', ' ', text).strip()
        # Truncate to avoid token limits
        text = text[:8000]
    except Exception as e:
        logger.error("Failed to fetch URL %s: %s", url, e)
        return {"error": f"Could not fetch URL: {e}"}

    system = _get_prompt(session, "url_extraction", "system", URL_EXTRACTION_SYSTEM)
    user_template = _get_prompt(session, "url_extraction", "user", URL_EXTRACTION_USER)
    user = user_template.format(url=url, content=text)
    model = _get_model(session, "url_extraction")

    response_text = _call_llm(model, system, user,
                              response_schema=URLExtractionResponse)
    data = json.loads(response_text)
    if not data or not isinstance(data, dict):
        return {"error": "AI could not extract producer information from the page"}
    return data


def _build_query_context(session: Session) -> str:
    """Build comprehensive producer database context for AI query."""
    producers = session.query(Producer).options(
        joinedload(Producer.organizations).joinedload(ProducerOrganization.organization),
        joinedload(Producer.tags).joinedload(ProducerTag.tag),
    ).all()

    context_parts = [f"Producer database ({len(producers)} total producers):\n"]
    for p in producers:
        state = get_relationship_state_label(p)
        current_org = None
        for po in (p.organizations or []):
            if po.end_date is None and po.organization:
                current_org = po.organization.name
                break
        tags = [pt.tag.name for pt in (p.tags or []) if pt.tag]

        parts = [f"- **{p.first_name} {p.last_name}** (ID: {p.id})"]
        parts.append(f"  State: {state}")
        if current_org:
            parts.append(f"  Org: {current_org}")
        if p.city:
            parts.append(f"  Location: {p.city}{', ' + p.state_region if p.state_region else ''}")
        # TODO: trait/intel summary fields pending pipeline redesign
        if p.relationship_summary:
            parts.append(f"  Relationship: {p.relationship_summary[:200]}")
        if p.last_contact_date:
            parts.append(f"  Last contact: {p.last_contact_date.strftime('%Y-%m-%d')}")
        if p.interaction_count:
            parts.append(f"  Interactions: {p.interaction_count}")
        if tags:
            parts.append(f"  Tags: {', '.join(tags)}")
        context_parts.append("\n".join(parts))

    return "\n\n".join(context_parts)


def run_ai_query(session: Session, query: str, mcp_server) -> str:
    """Run a natural language query against the producer database via LLM + MCP.

    AI query is for strategic analytical questions that require reasoning and
    synthesis — "Who should we talk to about Moonshot?", "Which producers have
    we lost touch with?", "Find producers whose aesthetic aligns with X".
    Simple search/filter belongs in the list view, not here.
    """
    from shared.backend.config import settings

    model = _get_model(session, "ai_query")
    system = _get_prompt(session, "ai_query", "system", AI_QUERY_SYSTEM)
    user_template = _get_prompt(session, "ai_query", "user", AI_QUERY_USER)
    user = user_template.format(query=query)

    anti_hallucination = "\n\nIMPORTANT: Answer ONLY based on the actual data provided below. Do not invent, extrapolate, or hallucinate information. If you don't have data to answer a question, say so. Be specific — cite actual producer names, actual data fields, actual numbers from the database."

    # MCP tool access is only available for Claude models on deployed servers
    use_mcp = (
        _get_provider(model) == "anthropic"
        and "localhost" not in settings.app_domain
    )

    if use_mcp:
        # Claude on deployed server: use MCP tools for live data access
        client = get_anthropic_client()
        mcp_url = f"{settings.app_domain}/mcp/mcp"
        response = client.beta.messages.create(
            model=model,
            max_tokens=4096,
            system=system,
            messages=[{"role": "user", "content": user}],
            mcp_servers=[{
                "type": "url",
                "url": mcp_url,
                "name": "intelligence",
                "authorization_token": settings.mcp_secret,
            }],
            tools=[{"type": "mcp_toolset", "mcp_server_name": "intelligence"}],
            betas=["mcp-client-2025-11-20"],
        )
        text_parts = []
        for block in response.content:
            if hasattr(block, "text"):
                text_parts.append(block.text)
        return "\n".join(text_parts)
    else:
        # All other cases: build context from DB and call through unified router
        context = _build_query_context(session)
        enriched_system = system + anti_hallucination
        enriched_user = f"{context}\n\nQuestion: {user}"
        return _call_llm(model, enriched_system, enriched_user)
