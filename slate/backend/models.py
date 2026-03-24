"""
Slate data models.

All tables for the Slate tool — shows, script versions, music files,
characters, scenes, songs, emotional arcs, runtime estimates, cast requirements,
budget estimates, comparables, content advisories, logline/summary drafts,
version diffs, development milestones, visual identity assets, pitches,
pitch materials, lookup values, change history, AI behaviors, and settings.

All class names are prefixed with "Slate" to avoid collisions with
Producers' models (both tools share the same SQLAlchemy Base).
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from shared.backend.db import Base


def _utcnow():
    return datetime.now(timezone.utc)


# --- Shows ---

class SlateShow(Base):
    """A WN project — the top-level entity in Slate."""
    __tablename__ = "slate_shows"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=False, index=True)
    medium_id = Column(Integer, ForeignKey("slate_lookup_values.id"), nullable=True)
    genre = Column(Text, nullable=True)
    logline = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    emotional_arc_summary = Column(Text, nullable=True)  # narrative summary of the emotional arc
    rights_status_id = Column(Integer, ForeignKey("slate_lookup_values.id"), nullable=True)
    development_stage_id = Column(Integer, ForeignKey("slate_lookup_values.id"), nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    # Lookup relationships
    medium = relationship("SlateLookupValue", foreign_keys=[medium_id])
    rights_status = relationship("SlateLookupValue", foreign_keys=[rights_status_id])
    development_stage = relationship("SlateLookupValue", foreign_keys=[development_stage_id])

    # One-to-many relationships
    script_versions = relationship("SlateScriptVersion", back_populates="show", cascade="all, delete-orphan", order_by="SlateScriptVersion.created_at.desc()")
    milestones = relationship("SlateMilestone", back_populates="show", cascade="all, delete-orphan", order_by="SlateMilestone.date.desc()")
    visual_assets = relationship("SlateVisualAsset", back_populates="show", cascade="all, delete-orphan")
    pitches = relationship("SlatePitch", back_populates="show", cascade="all, delete-orphan")
    characters = relationship("SlateCharacter", back_populates="show", cascade="all, delete-orphan", order_by="SlateCharacter.sort_order")
    scenes = relationship("SlateScene", back_populates="show", cascade="all, delete-orphan", order_by="SlateScene.sort_order")
    songs = relationship("SlateSong", back_populates="show", cascade="all, delete-orphan", order_by="SlateSong.sort_order")
    arc_points = relationship("SlateArcPoint", back_populates="show", cascade="all, delete-orphan", order_by="SlateArcPoint.sort_order")
    comparables = relationship("SlateComparable", back_populates="show", cascade="all, delete-orphan")
    content_advisories = relationship("SlateContentAdvisory", back_populates="show", cascade="all, delete-orphan")
    logline_drafts = relationship("SlateLoglineDraft", back_populates="show", cascade="all, delete-orphan")
    summary_drafts = relationship("SlateSummaryDraft", back_populates="show", cascade="all, delete-orphan")

    # One-to-one relationships
    runtime_estimates = relationship("SlateRuntimeEstimate", back_populates="show", cascade="all, delete-orphan")
    cast_requirements = relationship("SlateCastRequirements", back_populates="show", cascade="all, delete-orphan")
    budget_estimates = relationship("SlateBudgetEstimate", back_populates="show", cascade="all, delete-orphan")


# --- Script Versions ---

class SlateScriptVersion(Base):
    """An uploaded script file — each show has an ordered history."""
    __tablename__ = "slate_script_versions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    show_id = Column(Integer, ForeignKey("slate_shows.id", ondelete="CASCADE"), nullable=False, index=True)
    version_label = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    upload_date = Column(DateTime, default=_utcnow, nullable=False)
    change_notes = Column(Text, nullable=True)
    processing_status = Column(String, default="pending", nullable=False)
    processing_error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    # Relationships
    show = relationship("SlateShow", back_populates="script_versions")
    music_files = relationship("SlateMusicFile", back_populates="script_version", cascade="all, delete-orphan", order_by="SlateMusicFile.sort_order")


# --- Music Files ---

class SlateMusicFile(Base):
    """Music file tied to a script version."""
    __tablename__ = "slate_music_files"

    id = Column(Integer, primary_key=True, autoincrement=True)
    script_version_id = Column(Integer, ForeignKey("slate_script_versions.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    track_name = Column(String, nullable=False)
    track_type_id = Column(Integer, ForeignKey("slate_lookup_values.id"), nullable=True)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    processing_status = Column(String, default="pending", nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    # Analysis fields (populated by AI, editable)
    analysis_key = Column(String, nullable=True)
    analysis_tempo = Column(String, nullable=True)
    analysis_mood = Column(String, nullable=True)
    analysis_instrumentation = Column(JSONB, nullable=True)  # array of strings
    analysis_vocal_range = Column(String, nullable=True)
    analysis_function = Column(String, nullable=True)
    analysis_emotional_quality = Column(String, nullable=True)
    analysis_notes = Column(Text, nullable=True)

    # Relationships
    script_version = relationship("SlateScriptVersion", back_populates="music_files")
    track_type = relationship("SlateLookupValue", foreign_keys=[track_type_id])


# --- Characters ---

class SlateCharacter(Base):
    """A character in a version of a show's script."""
    __tablename__ = "slate_characters"

    id = Column(Integer, primary_key=True, autoincrement=True)
    show_id = Column(Integer, ForeignKey("slate_shows.id", ondelete="CASCADE"), nullable=False, index=True)
    script_version_id = Column(Integer, ForeignKey("slate_script_versions.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    age_range = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    line_count = Column(Integer, nullable=True)
    vocal_range = Column(String, nullable=True)  # musicals
    song_count = Column(Integer, nullable=True)  # musicals
    dance_requirements = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    show = relationship("SlateShow", foreign_keys=[show_id])
    script_version = relationship("SlateScriptVersion", foreign_keys=[script_version_id])


# --- Scenes ---

class SlateScene(Base):
    """A scene in a version of a show's script."""
    __tablename__ = "slate_scenes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    show_id = Column(Integer, ForeignKey("slate_shows.id", ondelete="CASCADE"), nullable=False, index=True)
    script_version_id = Column(Integer, ForeignKey("slate_script_versions.id"), nullable=False, index=True)
    act_number = Column(Integer, nullable=True)  # nullable for film/TV
    scene_number = Column(Integer, nullable=False)
    title = Column(String, nullable=True)
    location = Column(String, nullable=True)
    int_ext = Column(String, nullable=True)  # film/TV only: "INT", "EXT", "INT/EXT"
    time_of_day = Column(String, nullable=True)  # film/TV only
    characters_present = Column(JSONB, nullable=True)  # array of character names
    description = Column(Text, nullable=True)
    estimated_minutes = Column(Float, nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    show = relationship("SlateShow", foreign_keys=[show_id])
    script_version = relationship("SlateScriptVersion", foreign_keys=[script_version_id])


# --- Songs ---

class SlateSong(Base):
    """A song in a version of a musical's script."""
    __tablename__ = "slate_songs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    show_id = Column(Integer, ForeignKey("slate_shows.id", ondelete="CASCADE"), nullable=False, index=True)
    script_version_id = Column(Integer, ForeignKey("slate_script_versions.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    act = Column(Integer, nullable=True)
    scene = Column(Integer, nullable=True)
    characters = Column(JSONB, nullable=True)  # array of character names
    song_type = Column(String, nullable=True)  # opening, I Want, ballad, etc.
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    show = relationship("SlateShow", foreign_keys=[show_id])
    script_version = relationship("SlateScriptVersion", foreign_keys=[script_version_id])


# --- Emotional Arc ---

class SlateArcPoint(Base):
    """A point on the emotional arc for a version of a script."""
    __tablename__ = "slate_arc_points"

    id = Column(Integer, primary_key=True, autoincrement=True)
    show_id = Column(Integer, ForeignKey("slate_shows.id", ondelete="CASCADE"), nullable=False, index=True)
    script_version_id = Column(Integer, ForeignKey("slate_script_versions.id"), nullable=False, index=True)
    position = Column(Float, nullable=False)  # 0-100
    intensity = Column(Float, nullable=False)  # 0-100
    label = Column(String, nullable=True)
    tone = Column(String, nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    show = relationship("SlateShow", foreign_keys=[show_id])
    script_version = relationship("SlateScriptVersion", foreign_keys=[script_version_id])


# --- Runtime Estimates ---

class SlateRuntimeEstimate(Base):
    """Runtime estimate for a version of a show's script."""
    __tablename__ = "slate_runtime_estimates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    show_id = Column(Integer, ForeignKey("slate_shows.id", ondelete="CASCADE"), nullable=False, index=True)
    script_version_id = Column(Integer, ForeignKey("slate_script_versions.id"), nullable=False, index=True)
    total_minutes = Column(Integer, nullable=True)
    act_breakdown = Column(JSONB, nullable=True)  # [{act: 1, minutes: 65}, ...]
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    show = relationship("SlateShow", foreign_keys=[show_id])
    script_version = relationship("SlateScriptVersion", foreign_keys=[script_version_id])


# --- Cast Requirements ---

class SlateCastRequirements(Base):
    """Cast and resource requirements for a version of a show's script."""
    __tablename__ = "slate_cast_requirements"

    id = Column(Integer, primary_key=True, autoincrement=True)
    show_id = Column(Integer, ForeignKey("slate_shows.id", ondelete="CASCADE"), nullable=False, index=True)
    script_version_id = Column(Integer, ForeignKey("slate_script_versions.id"), nullable=False, index=True)
    minimum_cast_size = Column(Integer, nullable=True)
    recommended_cast_size = Column(Integer, nullable=True)
    doubling_possibilities = Column(Text, nullable=True)  # theatre
    musicians = Column(Integer, nullable=True)  # musicals
    musician_instruments = Column(JSONB, nullable=True)  # musicals, array
    locations_count = Column(Integer, nullable=True)  # film/TV
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    show = relationship("SlateShow", foreign_keys=[show_id])
    script_version = relationship("SlateScriptVersion", foreign_keys=[script_version_id])


# --- Budget Estimates ---

class SlateBudgetEstimate(Base):
    """Budget estimate for a version of a show's script."""
    __tablename__ = "slate_budget_estimates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    show_id = Column(Integer, ForeignKey("slate_shows.id", ondelete="CASCADE"), nullable=False, index=True)
    script_version_id = Column(Integer, ForeignKey("slate_script_versions.id"), nullable=False, index=True)
    estimated_range = Column(String, nullable=True)  # e.g. "$2M-$4M"
    factors = Column(JSONB, nullable=True)  # array of cost drivers
    cast_size_impact = Column(Text, nullable=True)
    technical_complexity = Column(Text, nullable=True)
    location_complexity = Column(Text, nullable=True)  # film/TV
    post_production_notes = Column(Text, nullable=True)  # film/TV
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    show = relationship("SlateShow", foreign_keys=[show_id])
    script_version = relationship("SlateScriptVersion", foreign_keys=[script_version_id])


# --- Comparables ---

class SlateComparable(Base):
    """A comparable work for a version of a show's script."""
    __tablename__ = "slate_comparables"

    id = Column(Integer, primary_key=True, autoincrement=True)
    show_id = Column(Integer, ForeignKey("slate_shows.id", ondelete="CASCADE"), nullable=False, index=True)
    script_version_id = Column(Integer, ForeignKey("slate_script_versions.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    relationship_type = Column(String, nullable=True)
    reasoning = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    show = relationship("SlateShow", foreign_keys=[show_id])
    script_version = relationship("SlateScriptVersion", foreign_keys=[script_version_id])


# --- Content Advisories ---

class SlateContentAdvisory(Base):
    """Content advisory for a version of a show's script."""
    __tablename__ = "slate_content_advisories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    show_id = Column(Integer, ForeignKey("slate_shows.id", ondelete="CASCADE"), nullable=False, index=True)
    script_version_id = Column(Integer, ForeignKey("slate_script_versions.id"), nullable=False, index=True)
    category = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String, nullable=True)  # mild, moderate, strong
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    show = relationship("SlateShow", foreign_keys=[show_id])
    script_version = relationship("SlateScriptVersion", foreign_keys=[script_version_id])


# --- Logline Drafts ---

class SlateLoglineDraft(Base):
    """Logline option for a version of a show's script."""
    __tablename__ = "slate_logline_drafts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    show_id = Column(Integer, ForeignKey("slate_shows.id", ondelete="CASCADE"), nullable=False, index=True)
    script_version_id = Column(Integer, ForeignKey("slate_script_versions.id"), nullable=False, index=True)
    text = Column(Text, nullable=False)
    tone = Column(String, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    show = relationship("SlateShow", foreign_keys=[show_id])
    script_version = relationship("SlateScriptVersion", foreign_keys=[script_version_id])


# --- Summary Drafts ---

class SlateSummaryDraft(Base):
    """Summary option for a version of a show's script."""
    __tablename__ = "slate_summary_drafts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    show_id = Column(Integer, ForeignKey("slate_shows.id", ondelete="CASCADE"), nullable=False, index=True)
    script_version_id = Column(Integer, ForeignKey("slate_script_versions.id"), nullable=False, index=True)
    summary_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    show = relationship("SlateShow", foreign_keys=[show_id])
    script_version = relationship("SlateScriptVersion", foreign_keys=[script_version_id])


# --- Version Diffs ---

class SlateVersionDiff(Base):
    """Comparison between two script versions."""
    __tablename__ = "slate_version_diffs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    show_id = Column(Integer, ForeignKey("slate_shows.id", ondelete="CASCADE"), nullable=False, index=True)
    current_version_id = Column(Integer, ForeignKey("slate_script_versions.id"), nullable=False)
    previous_version_id = Column(Integer, ForeignKey("slate_script_versions.id"), nullable=False)
    summary = Column(Text, nullable=True)
    structural_changes = Column(JSONB, nullable=True)  # array of strings
    character_changes = Column(JSONB, nullable=True)  # array of strings
    song_changes = Column(JSONB, nullable=True)  # array of strings, musicals only
    tone_shift = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    show = relationship("SlateShow", foreign_keys=[show_id])
    current_version = relationship("SlateScriptVersion", foreign_keys=[current_version_id])
    previous_version = relationship("SlateScriptVersion", foreign_keys=[previous_version_id])


# --- Development Milestones ---

class SlateMilestone(Base):
    """Events in the show's life — readings, workshops, submissions, etc."""
    __tablename__ = "slate_milestones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    show_id = Column(Integer, ForeignKey("slate_shows.id", ondelete="CASCADE"), nullable=False, index=True)
    script_version_id = Column(Integer, ForeignKey("slate_script_versions.id"), nullable=True)
    title = Column(String, nullable=False)
    date = Column(Date, nullable=False)
    description = Column(Text, nullable=True)
    milestone_type_id = Column(Integer, ForeignKey("slate_lookup_values.id"), nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    # Relationships
    show = relationship("SlateShow", back_populates="milestones")
    script_version = relationship("SlateScriptVersion")
    milestone_type = relationship("SlateLookupValue", foreign_keys=[milestone_type_id])


# --- Visual Identity Assets ---

class SlateVisualAsset(Base):
    """Visual brand assets for a show — logos, key art, mood boards, etc."""
    __tablename__ = "slate_visual_assets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    show_id = Column(Integer, ForeignKey("slate_shows.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    asset_type_id = Column(Integer, ForeignKey("slate_lookup_values.id"), nullable=True)
    label = Column(String, nullable=False)
    version = Column(String, nullable=True)
    is_current = Column(Boolean, default=True, nullable=False)
    processing_status = Column(String, default="pending", nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    # Analysis fields (populated by AI, editable)
    analysis_color_palette = Column(JSONB, nullable=True)  # array of strings
    analysis_mood = Column(String, nullable=True)
    analysis_tone = Column(String, nullable=True)
    analysis_typography = Column(String, nullable=True)
    analysis_visual_themes = Column(JSONB, nullable=True)  # array of strings
    analysis_communicates = Column(Text, nullable=True)
    analysis_notes = Column(Text, nullable=True)

    # Relationships
    show = relationship("SlateShow", back_populates="visual_assets")
    asset_type = relationship("SlateLookupValue", foreign_keys=[asset_type_id])


# --- Pitches ---

class SlatePitch(Base):
    """A pitch document about a show, tailored to an audience type."""
    __tablename__ = "slate_pitches"

    id = Column(Integer, primary_key=True, autoincrement=True)
    show_id = Column(Integer, ForeignKey("slate_shows.id", ondelete="CASCADE"), nullable=False, index=True)
    audience_type_id = Column(Integer, ForeignKey("slate_lookup_values.id"), nullable=True)
    target_producer_id = Column(Integer, nullable=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=True)
    status_id = Column(Integer, ForeignKey("slate_lookup_values.id"), nullable=True)
    generated_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    # Relationships
    show = relationship("SlateShow", back_populates="pitches")
    audience_type = relationship("SlateLookupValue", foreign_keys=[audience_type_id])
    status = relationship("SlateLookupValue", foreign_keys=[status_id])
    materials = relationship("SlatePitchMaterial", back_populates="pitch", cascade="all, delete-orphan")


# --- Pitch Materials ---

class SlatePitchMaterial(Base):
    """File attachments to a pitch."""
    __tablename__ = "slate_pitch_materials"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pitch_id = Column(Integer, ForeignKey("slate_pitches.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    material_type_id = Column(Integer, ForeignKey("slate_lookup_values.id"), nullable=True)
    label = Column(String, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    # Relationships
    pitch = relationship("SlatePitch", back_populates="materials")
    material_type = relationship("SlateLookupValue", foreign_keys=[material_type_id])


# --- Lookup Values ---

class SlateLookupValue(Base):
    """Soft enums stored in the database, managed via UI."""
    __tablename__ = "slate_lookup_values"

    id = Column(Integer, primary_key=True, autoincrement=True)
    category = Column(String, nullable=False, index=True)
    entity_type = Column(String, nullable=False, index=True)
    value = Column(String, nullable=False)
    display_label = Column(String, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    description = Column(Text, nullable=True)
    css_class = Column(String, nullable=True)
    applies_to = Column(JSONB, nullable=True)  # array of medium values this applies to; null = all

    __table_args__ = (
        UniqueConstraint("category", "entity_type", "value"),
    )


# --- Change History ---

class SlateChangeHistory(Base):
    """Field-level change tracking across all Slate entity types."""
    __tablename__ = "slate_change_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_type = Column(String, nullable=False, index=True)
    entity_id = Column(Integer, nullable=False)
    field_name = Column(String, nullable=False)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    changed_by = Column(String, nullable=False)
    changed_at = Column(DateTime, default=_utcnow, nullable=False)


# --- AI Behaviors ---

class SlateAIBehavior(Base):
    """Runtime-editable prompt configurations for Slate AI features."""
    __tablename__ = "slate_ai_behaviors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True, index=True)
    display_label = Column(String, nullable=False)
    system_prompt = Column(Text, nullable=False)
    user_prompt = Column(Text, nullable=False)
    model = Column(String, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)


# --- Settings ---

class SlateSettings(Base):
    """Tool-level configuration for Slate."""
    __tablename__ = "slate_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String, nullable=False, unique=True, index=True)
    value = Column(JSONB, nullable=True)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)


# Convenience aliases for imports
Show = SlateShow
ScriptVersion = SlateScriptVersion
MusicFile = SlateMusicFile
DevelopmentMilestone = SlateMilestone
VisualAsset = SlateVisualAsset
Pitch = SlatePitch
PitchMaterial = SlatePitchMaterial
Character = SlateCharacter
Scene = SlateScene
Song = SlateSong
ArcPoint = SlateArcPoint
RuntimeEstimate = SlateRuntimeEstimate
CastRequirements = SlateCastRequirements
BudgetEstimate = SlateBudgetEstimate
Comparable = SlateComparable
ContentAdvisory = SlateContentAdvisory
LoglineDraft = SlateLoglineDraft
SummaryDraft = SlateSummaryDraft
VersionDiff = SlateVersionDiff

# All models for table creation
ALL_MODELS = [
    SlateShow,
    SlateScriptVersion,
    SlateMusicFile,
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
    SlateVersionDiff,
    SlateMilestone,
    SlateVisualAsset,
    SlatePitch,
    SlatePitchMaterial,
    SlateLookupValue,
    SlateChangeHistory,
    SlateAIBehavior,
    SlateSettings,
]
