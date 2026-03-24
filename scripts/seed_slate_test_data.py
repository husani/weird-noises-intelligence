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
    SlateCharacter,
    SlateScene,
    SlateSong,
    SlateArcPoint,
    SlateRuntimeEstimate,
    SlateCastRequirements,
    SlateBudgetEstimate,
    SlateComparable,
    SlateContentAdvisory,
    SlateLoglineDraft,
    SlateSummaryDraft,
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
        session.query(SlateCharacter).delete()
        session.query(SlateScene).delete()
        session.query(SlateSong).delete()
        session.query(SlateArcPoint).delete()
        session.query(SlateRuntimeEstimate).delete()
        session.query(SlateCastRequirements).delete()
        session.query(SlateBudgetEstimate).delete()
        session.query(SlateComparable).delete()
        session.query(SlateContentAdvisory).delete()
        session.query(SlateLoglineDraft).delete()
        session.query(SlateSummaryDraft).delete()
        session.query(SlateMilestone).delete()
        session.query(SlateMusicFile).delete()
        session.query(SlateVisualAsset).delete()
        session.query(SlateScriptVersion).delete()
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

    # --- Vlad: Show Data (derived from script v3) ---

    # Emotional arc summary on the show itself
    vlad.emotional_arc_summary = "The arc builds steadily through Act I to a triumphant debate climax, drops into Act II's emotional and political complications, hits a devastating low with the exposure, then recovers through the eleven o'clock number to a bittersweet, hopeful finale. The emotional shape is a classic musical comedy arc with a darker second act than the first act promises."

    # Characters
    session.add_all([
        SlateCharacter(show_id=vlad.id, script_version_id=vlad_v3.id, name="Vlad", description="Count Vladimir Drăculea. A 500-year-old vampire who emigrates to America and stumbles into politics. Charismatic, brutally honest, bewildered by modern culture but a natural orator. The role demands charm, comic timing, and a commanding stage presence.", age_range="Appears 40s", gender="Male", line_count=380, vocal_range="Baritone, B2-G4", song_count=7, dance_requirements="Moderate movement, one major dance break in Act I finale", notes="Must sustain a Transylvanian accent throughout. Stage combat in Act II.", sort_order=0),
        SlateCharacter(show_id=vlad.id, script_version_id=vlad_v3.id, name="Elena", description="Vlad's campaign manager. A sharp, disillusioned political operative who sees Vlad as either the future of democracy or its final joke — she's not sure which. The heart of the show.", age_range="30s", gender="Female", line_count=290, vocal_range="Alto/Mezzo, G3-E5", song_count=5, dance_requirements="Light movement", notes="Bilingual English/Spanish a plus but not required.", sort_order=1),
        SlateCharacter(show_id=vlad.id, script_version_id=vlad_v3.id, name="Senator Hargrove", description="The incumbent. A polished, hollow career politician who represents everything wrong with the system — and knows it. His unraveling is both comedic and tragic.", age_range="50s-60s", gender="Male", line_count=180, vocal_range="Tenor, C3-A4", song_count=3, dance_requirements="None", notes="Strong comedic actor.", sort_order=2),
        SlateCharacter(show_id=vlad.id, script_version_id=vlad_v3.id, name="Mina", description="Vlad's daughter, born in the 1600s but passing as a millennial. Works in tech. Mortified by her father's political career. Their relationship is the emotional core of Act II.", age_range="Appears mid-20s", gender="Female", line_count=150, vocal_range="Soprano, C4-C6", song_count=3, dance_requirements="Moderate", notes="Must play both comedy and genuine emotion.", sort_order=3),
        SlateCharacter(show_id=vlad.id, script_version_id=vlad_v3.id, name="Tucker", description="A right-wing media personality who initially mocks Vlad but becomes his unlikely ally. Based on no one in particular.", age_range="40s-50s", gender="Male", line_count=120, vocal_range="Baritone", song_count=2, dance_requirements="None", notes="Strong improviser preferred.", sort_order=4),
        SlateCharacter(show_id=vlad.id, script_version_id=vlad_v3.id, name="Ensemble", description="Voters, reporters, Secret Service agents, debate moderators, social media avatars. 6-8 performers covering all roles.", age_range="20s-40s", gender="Mixed", line_count=None, vocal_range="Mixed", song_count=None, dance_requirements="Heavy — the ensemble carries the production numbers", notes="Strong movers who can sing. Multiple quick changes.", sort_order=5),
    ])

    # Scenes
    session.add_all([
        # Act I
        SlateScene(show_id=vlad.id, script_version_id=vlad_v3.id, act_number=1, scene_number=1, title="Arrival", location="JFK Airport / New York streets", characters_present=["Vlad", "Ensemble"], description="Vlad arrives in America. Culture shock musical number as he navigates customs, taxis, and Times Square.", estimated_minutes=8, sort_order=0),
        SlateScene(show_id=vlad.id, script_version_id=vlad_v3.id, act_number=1, scene_number=2, title="The Diner", location="A diner in Queens", characters_present=["Vlad", "Elena"], description="Vlad and Elena meet. She's running a doomed campaign and he accidentally gives the best stump speech she's ever heard.", estimated_minutes=10, sort_order=1),
        SlateScene(show_id=vlad.id, script_version_id=vlad_v3.id, act_number=1, scene_number=3, title="The Decision", location="Elena's office", characters_present=["Elena", "Vlad"], description="Elena convinces Vlad to run. 'Democracy Is a Bloodsport' begins.", estimated_minutes=6, sort_order=2),
        SlateScene(show_id=vlad.id, script_version_id=vlad_v3.id, act_number=1, scene_number=4, title="The Campaign Trail", location="Various — rallies, diners, TV studios", characters_present=["Vlad", "Elena", "Tucker", "Ensemble"], description="Montage of the campaign. Vlad's radical honesty goes viral.", estimated_minutes=12, sort_order=3),
        SlateScene(show_id=vlad.id, script_version_id=vlad_v3.id, act_number=1, scene_number=5, title="The Debate", location="Debate stage", characters_present=["Vlad", "Senator Hargrove", "Ensemble"], description="Vlad destroys Hargrove in the debate by simply telling the truth. Act I finale — 'Democracy Is a Bloodsport' full company.", estimated_minutes=15, sort_order=4),
        # Act II
        SlateScene(show_id=vlad.id, script_version_id=vlad_v3.id, act_number=2, scene_number=1, title="Victory Night", location="Campaign headquarters", characters_present=["Vlad", "Elena", "Mina", "Tucker", "Ensemble"], description="Vlad wins the primary. Mina confronts him about exposing the family.", estimated_minutes=10, sort_order=5),
        SlateScene(show_id=vlad.id, script_version_id=vlad_v3.id, act_number=2, scene_number=2, title="Father and Daughter", location="Vlad's apartment", characters_present=["Vlad", "Mina"], description="The emotional center. Vlad and Mina's duet about belonging, immortality, and what it means to be seen.", estimated_minutes=8, sort_order=6),
        SlateScene(show_id=vlad.id, script_version_id=vlad_v3.id, act_number=2, scene_number=3, title="The Opposition", location="TV studio / Hargrove's office", characters_present=["Senator Hargrove", "Tucker"], description="Hargrove's team digs into Vlad's past. They discover he's... actually a vampire.", estimated_minutes=7, sort_order=7),
        SlateScene(show_id=vlad.id, script_version_id=vlad_v3.id, act_number=2, scene_number=4, title="Exposure", location="Press conference", characters_present=["Vlad", "Elena", "Ensemble"], description="The truth comes out. Vlad admits everything on live TV. The question becomes: does it matter?", estimated_minutes=10, sort_order=8),
        SlateScene(show_id=vlad.id, script_version_id=vlad_v3.id, act_number=2, scene_number=5, title="Old Country (Reprise) / Finale", location="Election night stage", characters_present=["Full Company"], description="Election results. Vlad's final speech about what democracy actually means. 'Old Country' reprise into full company finale.", estimated_minutes=12, sort_order=9),
    ])

    # Songs
    session.add_all([
        SlateSong(show_id=vlad.id, script_version_id=vlad_v3.id, title="Fresh Blood", act=1, scene=1, characters=["Vlad", "Ensemble"], song_type="opening", description="Vlad arrives in America. Big ensemble number establishing his wonder and confusion.", sort_order=0),
        SlateSong(show_id=vlad.id, script_version_id=vlad_v3.id, title="The Honest Truth", act=1, scene=2, characters=["Vlad"], song_type="I Want", description="Vlad discovers that honesty is his superpower. His I Want song — he wants to be understood.", sort_order=1),
        SlateSong(show_id=vlad.id, script_version_id=vlad_v3.id, title="Spin Cycle", act=1, scene=4, characters=["Elena", "Ensemble"], song_type="comedy", description="Elena tries to manage Vlad's message. Comedic number about political messaging vs. radical truth.", sort_order=2),
        SlateSong(show_id=vlad.id, script_version_id=vlad_v3.id, title="Democracy Is a Bloodsport", act=1, scene=5, characters=["Vlad", "Ensemble"], song_type="finale", description="Act I finale. Vlad wins the debate. Full company production number.", sort_order=3),
        SlateSong(show_id=vlad.id, script_version_id=vlad_v3.id, title="What They Don't See", act=2, scene=1, characters=["Mina"], song_type="ballad", description="Mina's solo about living in her father's shadow for 500 years.", sort_order=4),
        SlateSong(show_id=vlad.id, script_version_id=vlad_v3.id, title="Old Country", act=2, scene=2, characters=["Vlad", "Mina"], song_type="ballad", description="Father-daughter duet about home, belonging, and the cost of immortality. The emotional core of the show.", sort_order=5),
        SlateSong(show_id=vlad.id, script_version_id=vlad_v3.id, title="Nothing to Hide", act=2, scene=4, characters=["Vlad"], song_type="eleven o'clock", description="Vlad admits everything on live TV. Eleven o'clock number — raw, vulnerable, defiant.", sort_order=6),
        SlateSong(show_id=vlad.id, script_version_id=vlad_v3.id, title="Old Country (Reprise)", act=2, scene=5, characters=["Full Company"], song_type="finale", description="The finale. Callbacks to Act I. What does it mean to choose a country?", sort_order=7),
    ])

    # Emotional arc points
    session.add_all([
        SlateArcPoint(show_id=vlad.id, script_version_id=vlad_v3.id, position=0, intensity=40, label="Arrival — wonder and confusion", tone="playful", sort_order=0),
        SlateArcPoint(show_id=vlad.id, script_version_id=vlad_v3.id, position=8, intensity=55, label="Vlad meets Elena", tone="comedic", sort_order=1),
        SlateArcPoint(show_id=vlad.id, script_version_id=vlad_v3.id, position=15, intensity=45, label="The honest truth — I Want", tone="intimate", sort_order=2),
        SlateArcPoint(show_id=vlad.id, script_version_id=vlad_v3.id, position=25, intensity=60, label="Campaign montage builds", tone="energetic", sort_order=3),
        SlateArcPoint(show_id=vlad.id, script_version_id=vlad_v3.id, position=35, intensity=50, label="Elena's spin cycle", tone="comedic", sort_order=4),
        SlateArcPoint(show_id=vlad.id, script_version_id=vlad_v3.id, position=45, intensity=85, label="The debate — Vlad destroys Hargrove", tone="triumphant", sort_order=5),
        SlateArcPoint(show_id=vlad.id, script_version_id=vlad_v3.id, position=50, intensity=90, label="Act I finale — Democracy Is a Bloodsport", tone="triumphant", sort_order=6),
        SlateArcPoint(show_id=vlad.id, script_version_id=vlad_v3.id, position=55, intensity=65, label="Victory — but Mina confronts Vlad", tone="tense", sort_order=7),
        SlateArcPoint(show_id=vlad.id, script_version_id=vlad_v3.id, position=62, intensity=80, label="Old Country duet — father and daughter", tone="intimate", sort_order=8),
        SlateArcPoint(show_id=vlad.id, script_version_id=vlad_v3.id, position=68, intensity=50, label="Hargrove discovers the truth", tone="ominous", sort_order=9),
        SlateArcPoint(show_id=vlad.id, script_version_id=vlad_v3.id, position=75, intensity=70, label="The exposure — truth comes out", tone="tense", sort_order=10),
        SlateArcPoint(show_id=vlad.id, script_version_id=vlad_v3.id, position=82, intensity=90, label="Nothing to Hide — eleven o'clock", tone="devastating", sort_order=11),
        SlateArcPoint(show_id=vlad.id, script_version_id=vlad_v3.id, position=88, intensity=60, label="Election night uncertainty", tone="tense", sort_order=12),
        SlateArcPoint(show_id=vlad.id, script_version_id=vlad_v3.id, position=95, intensity=85, label="Old Country reprise — finale", tone="triumphant", sort_order=13),
        SlateArcPoint(show_id=vlad.id, script_version_id=vlad_v3.id, position=100, intensity=75, label="Curtain — bittersweet hope", tone="melancholic", sort_order=14),
    ])

    # Runtime estimate
    session.add(SlateRuntimeEstimate(
        show_id=vlad.id, script_version_id=vlad_v3.id, total_minutes=135,
        act_breakdown=[{"act": 1, "minutes": 65}, {"act": 2, "minutes": 55}],
        notes="Includes 15 minutes intermission. 8 musical numbers averaging 4-5 minutes each account for roughly 35-40 minutes. Scene transitions estimated at 2-3 minutes total with unit set.",
    ))

    # Cast requirements
    session.add(SlateCastRequirements(
        show_id=vlad.id, script_version_id=vlad_v3.id, minimum_cast_size=8, recommended_cast_size=12,
        doubling_possibilities="Tucker/Debate Moderator, Senator Hargrove can double minor roles in Act I. Ensemble of 6-8 covers all remaining roles with quick changes.",
        musicians=7,
        musician_instruments=["Piano/Conductor", "Guitar/Mandolin", "Bass", "Drums/Percussion", "Violin/Viola", "Trumpet", "Accordion"],
        notes="The accordion is essential for the Eastern European texture. Consider a visible band for the campaign rally scenes.",
    ))

    # Budget estimate
    session.add(SlateBudgetEstimate(
        show_id=vlad.id, script_version_id=vlad_v3.id, estimated_range="$2.5M-$4M",
        factors=["Cast of 12 with strong leads (name casting potential for Vlad)", "7-piece band", "Unit set with projections — moderate scenic", "Period-adjacent costumes with quick-change requirements", "Off-Broadway venue appropriate"],
        cast_size_impact="The show needs strong leads — Vlad especially requires a star-caliber performer. This drives cost. The ensemble is efficient at 6-8.",
        technical_complexity="Moderate. Unit set with projection design handles the multiple locations. No fly system needed. Quick changes require backstage crew.",
        notes="This is an Off-Broadway-scale show that could transfer. Initial production budget assumes a venue like New World Stages or similar. A Broadway transfer would roughly double the budget.",
    ))

    # Comparables
    session.add_all([
        SlateComparable(show_id=vlad.id, script_version_id=vlad_v3.id, title="Bloody Bloody Andrew Jackson", relationship_type="tonal match", reasoning="Same irreverent approach to politics through genre pastiche. Both use rock-inflected scores to tell the story of an outsider who disrupts the political establishment. Vlad has a warmer emotional core."),
        SlateComparable(show_id=vlad.id, script_version_id=vlad_v3.id, title="The Band's Visit", relationship_type="emotional tone", reasoning="The fish-out-of-water immigrant experience, the quiet moments between the comedy. Vlad's relationship with America has the same tender bewilderment."),
        SlateComparable(show_id=vlad.id, script_version_id=vlad_v3.id, title="What We Do in the Shadows", relationship_type="same audience", reasoning="The vampire-as-immigrant comedy. Vlad's audience already exists — they watch this show. The musical earns its emotional moments in a way the TV show doesn't attempt."),
        SlateComparable(show_id=vlad.id, script_version_id=vlad_v3.id, title="Hamilton", relationship_type="structural parallel", reasoning="Immigrant arrives, enters politics, changes everything. But where Hamilton is earnest, Vlad is satirical. The debate scene functions like the cabinet battles."),
        SlateComparable(show_id=vlad.id, script_version_id=vlad_v3.id, title="The Producers", relationship_type="comedic lineage", reasoning="The tradition of musical comedy that's actually about something. Vlad is funnier than it has any right to be, but the father-daughter relationship gives it genuine stakes."),
    ])

    # Content advisories
    session.add_all([
        SlateContentAdvisory(show_id=vlad.id, script_version_id=vlad_v3.id, category="language", description="Moderate profanity throughout, mostly in political dialogue. Several uses of stronger language in Act II.", severity="moderate"),
        SlateContentAdvisory(show_id=vlad.id, script_version_id=vlad_v3.id, category="violence", description="Stylized vampire references — no graphic violence. Brief stage combat in Act II (the 'exposure' scene). Comedic, not threatening.", severity="mild"),
        SlateContentAdvisory(show_id=vlad.id, script_version_id=vlad_v3.id, category="mature themes", description="Political satire that directly references real political dynamics. Immigration, xenophobia, and media manipulation are central themes.", severity="moderate"),
    ])

    # Logline drafts
    session.add_all([
        SlateLoglineDraft(show_id=vlad.id, script_version_id=vlad_v3.id, text="A 500-year-old vampire emigrates to America, accidentally runs for president, and discovers that radical honesty is the most dangerous weapon in politics.", tone="commercial"),
        SlateLoglineDraft(show_id=vlad.id, script_version_id=vlad_v3.id, text="In a political landscape built on lies, the most honest candidate in history has a secret that should disqualify him from everything — except he's already dead.", tone="literary"),
        SlateLoglineDraft(show_id=vlad.id, script_version_id=vlad_v3.id, text="A father who has lived for five centuries finally finds something worth dying for: the messy, beautiful, impossible promise of democracy.", tone="emotional"),
    ])

    # Summary draft
    session.add(SlateSummaryDraft(
        show_id=vlad.id,
        script_version_id=vlad_v3.id,
        summary_text="Vlad is a two-act musical that follows Count Vladimir Drăculea — yes, that Vlad — as he emigrates to modern America, stumbles into a congressional campaign, and discovers that telling the literal truth is the most disruptive force in contemporary politics.\n\nWhat begins as political satire deepens into something more personal when Vlad's daughter Mina, who has been hiding in plain sight for centuries, confronts him about the exposure his campaign brings. The father-daughter relationship becomes the emotional center of the show, asking whether a man who has lived for 500 years can finally learn what it means to belong somewhere.\n\nThe score blends Eastern European folk, contemporary pop-rock, and big Broadway ensemble numbers. The tone walks a razor's edge between absurdist comedy and genuine pathos — you're laughing at the political satire one moment and moved by a vampire's love for his daughter the next.",
    ))

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
