"""
Seed test shows, script versions, milestones, and visual assets into Slate.

Creates realistic WN project data for UI evaluation. No actual files
are uploaded to GCS — just database records with placeholder paths.

Usage:
    poetry run python scripts/seed_slate_test_data.py
    poetry run python scripts/seed_slate_test_data.py --force   # delete and re-seed
"""

import argparse
import sys
from datetime import date, datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from shared.backend.db import create_engine_for, create_session_factory
from slate.backend.models import (
    SlateShow,
    SlateScriptVersion,
    SlateMusicFile,
    SlateMilestone,
    SlateVisualAsset,
    SlateLookupValue,
)


def _utcnow():
    return datetime.now(timezone.utc)


def _lv(session, category, value):
    """Look up a SlateLookupValue by category and value."""
    return session.query(SlateLookupValue).filter_by(
        category=category, value=value
    ).first()


def seed(session, force=False):
    if not force and session.query(SlateShow).count() > 0:
        print("  Shows already exist, skipping (use --force to re-seed)")
        return

    if force:
        session.query(SlateMusicFile).delete()
        session.query(SlateScriptVersion).delete()
        session.query(SlateMilestone).delete()
        session.query(SlateVisualAsset).delete()
        session.query(SlateShow).delete()
        session.flush()

    # --- Show 1: Vlad ---
    vlad = SlateShow(
        title="Vlad",
        medium_id=_lv(session, "medium", "musical").id,
        genre="political satire, dark comedy",
        logline="A charismatic vampire runs for president on a platform of radical honesty — and wins.",
        summary="Vlad is a two-act musical that follows Count Vladimir Drăculea as he emigrates to America, "
                "stumbles into politics, and discovers that telling the literal truth is the most disruptive "
                "force in modern democracy. Part political satire, part immigrant story, part love letter to "
                "the absurdity of the American experiment. The score blends Eastern European folk with "
                "contemporary pop-rock and big Broadway ensemble numbers.",
        rights_status_id=_lv(session, "rights_status", "original").id,
        development_stage_id=_lv(session, "development_stage", "staged_reading").id,
    )
    session.add(vlad)
    session.flush()
    print(f"  Created show: Vlad (id={vlad.id})")

    # Vlad scripts
    vlad_v1 = SlateScriptVersion(
        show_id=vlad.id,
        version_label="First Draft",
        file_path=f"slate/shows/{vlad.id}/scripts/vlad-first-draft.pdf",
        original_filename="vlad-first-draft.pdf",
        upload_date=datetime(2025, 6, 15, tzinfo=timezone.utc),
        change_notes=None,
        processing_status="complete",
    )
    vlad_v2 = SlateScriptVersion(
        show_id=vlad.id,
        version_label="Post-Workshop Draft",
        file_path=f"slate/shows/{vlad.id}/scripts/vlad-post-workshop.pdf",
        original_filename="vlad-post-workshop-v2.pdf",
        upload_date=datetime(2025, 11, 20, tzinfo=timezone.utc),
        change_notes="Major restructure after October workshop. Collapsed three-act structure to two acts. "
                     "Moved the debate scene to Act I curtain. Cut two songs, added three new ones including "
                     "the 'Democracy Is a Bloodsport' number that killed at the workshop.",
        processing_status="complete",
    )
    vlad_v3 = SlateScriptVersion(
        show_id=vlad.id,
        version_label="Pre-Reading Draft",
        file_path=f"slate/shows/{vlad.id}/scripts/vlad-pre-reading.pdf",
        original_filename="vlad-pre-reading-v3.pdf",
        upload_date=datetime(2026, 2, 1, tzinfo=timezone.utc),
        change_notes="Refined for March staged reading. Tightened Act II pacing, rewrote the "
                     "mother-son phone call scene, added a reprise of 'Old Country' in the finale.",
        processing_status="complete",
    )
    session.add_all([vlad_v1, vlad_v2, vlad_v3])
    session.flush()

    # Vlad music files (on v3)
    session.add_all([
        SlateMusicFile(
            script_version_id=vlad_v3.id,
            file_path=f"slate/shows/{vlad.id}/music/{vlad_v3.id}/opening-number.mp3",
            original_filename="01-opening-number-demo.mp3",
            track_name="Opening Number — 'Fresh Blood'",
            track_type_id=_lv(session, "track_type", "demo_recording").id,
            description="Full company opening. Establishes Vlad arriving in America.",
            sort_order=0,
            processing_status="complete",
        ),
        SlateMusicFile(
            script_version_id=vlad_v3.id,
            file_path=f"slate/shows/{vlad.id}/music/{vlad_v3.id}/democracy-bloodsport.mp3",
            original_filename="02-democracy-bloodsport-demo.mp3",
            track_name="Democracy Is a Bloodsport",
            track_type_id=_lv(session, "track_type", "demo_recording").id,
            description="Act I finale. Vlad wins the primary. Big ensemble production number.",
            sort_order=1,
            processing_status="complete",
        ),
        SlateMusicFile(
            script_version_id=vlad_v3.id,
            file_path=f"slate/shows/{vlad.id}/music/{vlad_v3.id}/old-country-reprise.mp3",
            original_filename="03-old-country-reprise-piano-vocal.mp3",
            track_name="Old Country (Reprise)",
            track_type_id=_lv(session, "track_type", "piano_vocal_score").id,
            description="Finale. Vlad reflects on what America means. Callbacks to Act I.",
            sort_order=2,
            processing_status="complete",
        ),
    ])

    # Vlad milestones
    session.add_all([
        SlateMilestone(
            show_id=vlad.id,
            title="First internal read",
            date=date(2025, 7, 10),
            description="Read-through with Marc and Husani. Identified structural concerns with "
                        "the three-act structure — too much setup before the political turn.",
            milestone_type_id=_lv(session, "milestone_type", "internal_read").id,
            script_version_id=vlad_v1.id,
        ),
        SlateMilestone(
            show_id=vlad.id,
            title="Workshop — 5 days",
            date=date(2025, 10, 6),
            description="5-day workshop with 10 actors, pianist, and director. Strongest response to "
                        "the debate scene and 'Democracy Is a Bloodsport'. Second act pacing flagged.",
            milestone_type_id=_lv(session, "milestone_type", "workshop").id,
            script_version_id=vlad_v1.id,
        ),
        SlateMilestone(
            show_id=vlad.id,
            title="Staged reading at Joe's Pub",
            date=date(2026, 3, 15),
            description="Invited audience of 60. Full cast of 10, music director on piano. "
                        "Post-reading talkback ran 40 minutes. Strong interest from two producers in attendance.",
            milestone_type_id=_lv(session, "milestone_type", "staged_reading").id,
            script_version_id=vlad_v3.id,
        ),
    ])

    # Vlad visual assets
    session.add_all([
        SlateVisualAsset(
            show_id=vlad.id,
            file_path=f"slate/shows/{vlad.id}/visual/logo/vlad-logo-v2.svg",
            original_filename="vlad-logo-v2.svg",
            asset_type_id=_lv(session, "asset_type", "logo").id,
            label="Logo v2",
            version="v2",
            is_current=True,
            processing_status="complete",
        ),
        SlateVisualAsset(
            show_id=vlad.id,
            file_path=f"slate/shows/{vlad.id}/visual/key_art/vlad-key-art-final.jpg",
            original_filename="vlad-key-art-final.jpg",
            asset_type_id=_lv(session, "asset_type", "key_art").id,
            label="Key Art — Final",
            is_current=True,
            processing_status="complete",
        ),
        SlateVisualAsset(
            show_id=vlad.id,
            file_path=f"slate/shows/{vlad.id}/visual/mood_board/vlad-mood-eastern-europe.jpg",
            original_filename="vlad-mood-eastern-europe.jpg",
            asset_type_id=_lv(session, "asset_type", "mood_board").id,
            label="Eastern Europe — Visual References",
            is_current=True,
            processing_status="complete",
        ),
    ])

    # --- Show 2: Stable Geniuses ---
    sg = SlateShow(
        title="Stable Geniuses",
        medium_id=_lv(session, "medium", "play").id,
        genre="comedy, workplace satire",
        logline="Four Nobel laureates are hired to run a Silicon Valley startup — and discover that "
                "being the smartest people in the room doesn't mean you can ship a product.",
        summary="A comedy about the collision between academic brilliance and startup culture. "
                "When a tech billionaire hires four Nobel Prize winners to build 'the world's most "
                "intelligent company,' the result is a workplace where every decision requires peer "
                "review, every meeting becomes a lecture, and nobody can agree on what the product "
                "actually is. A satire of both tech hubris and ivory tower detachment.",
        rights_status_id=_lv(session, "rights_status", "original").id,
        development_stage_id=_lv(session, "development_stage", "workshop").id,
    )
    session.add(sg)
    session.flush()
    print(f"  Created show: Stable Geniuses (id={sg.id})")

    sg_v1 = SlateScriptVersion(
        show_id=sg.id,
        version_label="First Draft",
        file_path=f"slate/shows/{sg.id}/scripts/stable-geniuses-v1.pdf",
        original_filename="stable-geniuses-v1.pdf",
        upload_date=datetime(2025, 9, 1, tzinfo=timezone.utc),
        processing_status="complete",
    )
    sg_v2 = SlateScriptVersion(
        show_id=sg.id,
        version_label="Workshop Draft",
        file_path=f"slate/shows/{sg.id}/scripts/stable-geniuses-workshop.pdf",
        original_filename="stable-geniuses-workshop-v2.pdf",
        upload_date=datetime(2026, 1, 10, tzinfo=timezone.utc),
        change_notes="Sharpened the physicist character. Added the whiteboard scene. "
                     "Cut the investor subplot — it was pulling focus from the core four.",
        processing_status="complete",
    )
    session.add_all([sg_v1, sg_v2])
    session.flush()

    session.add_all([
        SlateMilestone(
            show_id=sg.id,
            title="Table read with actors",
            date=date(2025, 10, 22),
            description="6 actors, cold read. The whiteboard scene doesn't exist yet but the "
                        "core dynamic between the four leads works. Need to find the ending.",
            milestone_type_id=_lv(session, "milestone_type", "table_read").id,
            script_version_id=sg_v1.id,
        ),
        SlateMilestone(
            show_id=sg.id,
            title="Workshop — 3 days",
            date=date(2026, 2, 10),
            description="3-day workshop at Playwrights Horizons. Focused on the second half. "
                        "The ending landed for the first time. Director wants to push for a reading.",
            milestone_type_id=_lv(session, "milestone_type", "workshop").id,
            script_version_id=sg_v2.id,
        ),
    ])

    session.add(SlateVisualAsset(
        show_id=sg.id,
        file_path=f"slate/shows/{sg.id}/visual/logo/sg-logo.png",
        original_filename="sg-logo.png",
        asset_type_id=_lv(session, "asset_type", "logo").id,
        label="Logo — Working",
        is_current=True,
        processing_status="complete",
    ))

    # --- Show 3: Divide Theory ---
    dt = SlateShow(
        title="Divide Theory",
        medium_id=_lv(session, "medium", "limited_series").id,
        genre="thriller, family drama",
        logline="A mathematician discovers her late father's research proves P=NP — and every "
                "intelligence agency in the world wants it before she can publish.",
        summary="A six-episode limited series following Dr. Amara Osei, a number theorist at MIT, "
                "who inherits her estranged father's papers and realizes he solved the most important "
                "unsolved problem in computer science. The proof would break every encryption system "
                "on earth. As she works to verify and publish the proof, she's pulled into a world of "
                "state-sponsored espionage, corporate sabotage, and family secrets. Part thriller, "
                "part meditation on what we owe to truth vs. what we owe to safety.",
        rights_status_id=_lv(session, "rights_status", "original").id,
        development_stage_id=_lv(session, "development_stage", "early_development").id,
    )
    session.add(dt)
    session.flush()
    print(f"  Created show: Divide Theory (id={dt.id})")

    dt_v1 = SlateScriptVersion(
        show_id=dt.id,
        version_label="Pilot — First Draft",
        file_path=f"slate/shows/{dt.id}/scripts/divide-theory-pilot-v1.pdf",
        original_filename="divide-theory-pilot-v1.pdf",
        upload_date=datetime(2026, 3, 1, tzinfo=timezone.utc),
        change_notes=None,
        processing_status="pending",
    )
    session.add(dt_v1)
    session.flush()

    session.add(SlateMilestone(
        show_id=dt.id,
        title="Internal read — pilot",
        date=date(2026, 3, 10),
        description="Read of the pilot script. Strong setup, the math feels authentic. "
                    "Need to figure out the serialized structure for episodes 2-6.",
        milestone_type_id=_lv(session, "milestone_type", "internal_read").id,
        script_version_id=dt_v1.id,
    ))

    # --- Show 4: The Hive ---
    hive = SlateShow(
        title="The Hive",
        medium_id=_lv(session, "medium", "musical").id,
        genre="sci-fi musical, ensemble drama",
        logline="In a future where humans share a neural network, one woman discovers she can "
                "disconnect — and has to decide if individual thought is worth the loneliness.",
        rights_status_id=_lv(session, "rights_status", "original").id,
        development_stage_id=_lv(session, "development_stage", "early_development").id,
    )
    session.add(hive)
    session.flush()
    print(f"  Created show: The Hive (id={hive.id})")

    # --- Show 5: Prospect Park ---
    pp = SlateShow(
        title="Prospect Park",
        medium_id=_lv(session, "medium", "feature_film").id,
        genre="romantic drama",
        logline="Two strangers meet on the same park bench every Sunday for a year — each carrying "
                "a secret that would end the other's marriage.",
        rights_status_id=_lv(session, "rights_status", "original").id,
        development_stage_id=_lv(session, "development_stage", "seeking_production").id,
    )
    session.add(pp)
    session.flush()
    print(f"  Created show: Prospect Park (id={pp.id})")

    pp_v1 = SlateScriptVersion(
        show_id=pp.id,
        version_label="First Draft",
        file_path=f"slate/shows/{pp.id}/scripts/prospect-park-v1.pdf",
        original_filename="prospect-park-v1.pdf",
        upload_date=datetime(2025, 4, 1, tzinfo=timezone.utc),
        processing_status="complete",
    )
    pp_v2 = SlateScriptVersion(
        show_id=pp.id,
        version_label="Final Draft",
        file_path=f"slate/shows/{pp.id}/scripts/prospect-park-final.pdf",
        original_filename="prospect-park-final.pdf",
        upload_date=datetime(2025, 12, 15, tzinfo=timezone.utc),
        change_notes="Final polish. Restructured the reveal in the third act. "
                     "Added the rain scene that ties the seasons together.",
        processing_status="complete",
    )
    session.add_all([pp_v1, pp_v2])
    session.flush()

    session.add_all([
        SlateMilestone(
            show_id=pp.id,
            title="Table read",
            date=date(2025, 5, 8),
            description="Read with two actors. The structure works but the ending needs rethinking.",
            milestone_type_id=_lv(session, "milestone_type", "table_read").id,
            script_version_id=pp_v1.id,
        ),
        SlateMilestone(
            show_id=pp.id,
            title="Submitted to Sundance Labs",
            date=date(2026, 1, 15),
            description="Submitted final draft to the Sundance Screenwriters Lab.",
            milestone_type_id=_lv(session, "milestone_type", "submission").id,
            script_version_id=pp_v2.id,
        ),
        SlateMilestone(
            show_id=pp.id,
            title="Pitch meeting — A24",
            date=date(2026, 3, 5),
            description="General meeting. They liked the concept, asked to read the script.",
            milestone_type_id=_lv(session, "milestone_type", "pitch_meeting").id,
            script_version_id=pp_v2.id,
        ),
    ])

    session.commit()
    print(f"\n  5 shows, scripts, milestones, and assets seeded.")


def main():
    parser = argparse.ArgumentParser(description="Seed Slate test data")
    parser.add_argument("--force", action="store_true", help="Delete existing test data and re-seed")
    args = parser.parse_args()

    engine = create_engine_for("intelligence_slate")
    session_factory = create_session_factory(engine)

    print("Seeding Slate test data...")
    with session_factory() as session:
        seed(session, force=args.force)

    print("Done.")


if __name__ == "__main__":
    main()
