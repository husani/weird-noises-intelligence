"""
Slate data models.

Shows are WN projects. Each show has versions (script uploads).
All domain data (characters, scenes, songs, etc.) belongs to a version.
The show itself is thin — just the project identity.

Table naming: show_* for domain tables, slate_* for tool infrastructure.
Class naming: Slate* prefix to avoid collisions with Producers models
(both tools share the same SQLAlchemy Base).
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
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    """Slate's own declarative base. Independent of other tools."""
    pass


def _utcnow():
    return datetime.now(timezone.utc)


# =========================================================================
# SHOW — the project identity
# =========================================================================

class SlateShow(Base):
    """A WN project. Thin record — just the project identity."""
    __tablename__ = "shows"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=False, index=True)
    medium_id = Column(Integer, ForeignKey("lookup_values.id"), nullable=True)
    rights_status_id = Column(Integer, ForeignKey("lookup_values.id"), nullable=True)
    development_stage_id = Column(Integer, ForeignKey("lookup_values.id"), nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    # Lookup relationships
    medium = relationship("SlateLookupValue", foreign_keys=[medium_id])
    rights_status = relationship("SlateLookupValue", foreign_keys=[rights_status_id])
    development_stage = relationship("SlateLookupValue", foreign_keys=[development_stage_id])

    # Show has versions
    versions = relationship("SlateShowVersion", back_populates="show", cascade="all, delete-orphan", order_by="SlateShowVersion.created_at.desc()")

    # Show has milestones (not versioned — milestones are events in the project's life)
    milestones = relationship("SlateMilestone", back_populates="show", cascade="all, delete-orphan", order_by="SlateMilestone.date.desc()")

    # Show has visual assets (not versioned — visual identity assets belong to the show)
    visual_assets = relationship("SlateVisualAsset", back_populates="show", cascade="all, delete-orphan")

    # Show has pitches
    pitches = relationship("SlatePitch", back_populates="show", cascade="all, delete-orphan")


# =========================================================================
# SHOW VERSION — a version of the script, center of all domain data
# =========================================================================

class SlateShowVersion(Base):
    """A version of a show's script. All domain data connects here."""
    __tablename__ = "show_versions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    show_id = Column(Integer, ForeignKey("shows.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    version_label_id = Column(Integer, ForeignKey("lookup_values.id"), nullable=True)
    file_path = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    upload_date = Column(DateTime, default=_utcnow, nullable=False)
    change_notes = Column(Text, nullable=True)
    processing_status = Column(String, default="pending", nullable=False)
    processing_error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    # Version-level fields (change with each draft)
    logline = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    genre = Column(Text, nullable=True)
    emotional_arc_summary = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("show_id", "version_number"),
    )

    # Relationships
    show = relationship("SlateShow", back_populates="versions")
    version_label = relationship("SlateLookupValue", foreign_keys=[version_label_id])
    music_files = relationship("SlateMusicFile", back_populates="version", cascade="all, delete-orphan", order_by="SlateMusicFile.sort_order")

    # Domain data — all belongs to this version
    characters = relationship("SlateCharacter", back_populates="version", cascade="all, delete-orphan", order_by="SlateCharacter.sort_order")
    scenes = relationship("SlateScene", back_populates="version", cascade="all, delete-orphan", order_by="SlateScene.sort_order")
    songs = relationship("SlateSong", back_populates="version", cascade="all, delete-orphan", order_by="SlateSong.sort_order")
    arc_points = relationship("SlateArcPoint", back_populates="version", cascade="all, delete-orphan", order_by="SlateArcPoint.sort_order")
    credits = relationship("SlateCredit", back_populates="version", cascade="all, delete-orphan", order_by="SlateCredit.sort_order")
    comparables = relationship("SlateComparable", back_populates="version", cascade="all, delete-orphan")
    content_advisories = relationship("SlateContentAdvisory", back_populates="version", cascade="all, delete-orphan")
    logline_drafts = relationship("SlateLoglineDraft", back_populates="version", cascade="all, delete-orphan")
    summary_drafts = relationship("SlateSummaryDraft", back_populates="version", cascade="all, delete-orphan")


# =========================================================================
# MUSIC FILES — tied to a version
# =========================================================================

class SlateMusicFile(Base):
    """Music file tied to a show version."""
    __tablename__ = "show_music_files"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version_id = Column(Integer, ForeignKey("show_versions.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    track_name = Column(String, nullable=False)
    track_type_id = Column(Integer, ForeignKey("lookup_values.id"), nullable=True)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    processing_status = Column(String, default="pending", nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    # Analysis fields (populated by AI, editable)
    analysis_key = Column(String, nullable=True)
    analysis_tempo = Column(String, nullable=True)
    analysis_mood = Column(String, nullable=True)
    analysis_instrumentation = Column(JSONB, nullable=True)
    analysis_vocal_range = Column(String, nullable=True)
    analysis_function = Column(String, nullable=True)
    analysis_emotional_quality = Column(String, nullable=True)
    analysis_notes = Column(Text, nullable=True)

    # Relationships
    version = relationship("SlateShowVersion", back_populates="music_files")
    track_type = relationship("SlateLookupValue", foreign_keys=[track_type_id])


# =========================================================================
# DOMAIN DATA — all connected to a version
# =========================================================================

class SlateCharacter(Base):
    """A character in a version of a show's script."""
    __tablename__ = "show_characters"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version_id = Column(Integer, ForeignKey("show_versions.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    age_range = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    line_count = Column(Integer, nullable=True)
    vocal_range = Column(String, nullable=True)
    song_count = Column(Integer, nullable=True)
    dance_requirements = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    version = relationship("SlateShowVersion", back_populates="characters")


class SlateScene(Base):
    """A scene in a version of a show's script."""
    __tablename__ = "show_scenes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version_id = Column(Integer, ForeignKey("show_versions.id", ondelete="CASCADE"), nullable=False, index=True)
    act_number = Column(Integer, nullable=True)
    scene_number = Column(Integer, nullable=False)
    title = Column(String, nullable=True)
    location = Column(String, nullable=True)
    int_ext = Column(String, nullable=True)
    time_of_day = Column(String, nullable=True)
    characters_present = Column(JSONB, nullable=True)
    description = Column(Text, nullable=True)
    estimated_minutes = Column(Float, nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    version = relationship("SlateShowVersion", back_populates="scenes")


class SlateSong(Base):
    """A song in a version of a musical's script."""
    __tablename__ = "show_songs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version_id = Column(Integer, ForeignKey("show_versions.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String, nullable=False)
    act = Column(Integer, nullable=True)
    scene = Column(Integer, nullable=True)
    characters = Column(JSONB, nullable=True)
    song_type = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    version = relationship("SlateShowVersion", back_populates="songs")


class SlateArcPoint(Base):
    """A point on the emotional arc for a version of a script."""
    __tablename__ = "show_arc_points"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version_id = Column(Integer, ForeignKey("show_versions.id", ondelete="CASCADE"), nullable=False, index=True)
    position = Column(Float, nullable=False)
    intensity = Column(Float, nullable=False)
    label = Column(String, nullable=True)
    tone = Column(String, nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    version = relationship("SlateShowVersion", back_populates="arc_points")


class SlateCredit(Base):
    """A credit on a version of a script (writer, composer, lyricist, etc.)."""
    __tablename__ = "show_credits"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version_id = Column(Integer, ForeignKey("show_versions.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String, nullable=False)  # writer, composer, lyricist, book, director, etc.
    person_name = Column(String, nullable=False)
    credit_text = Column(String, nullable=True)  # "Book by", "Music & Lyrics by", etc.
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    version = relationship("SlateShowVersion", back_populates="credits")


class SlateRuntimeEstimate(Base):
    """Runtime estimate for a version of a show's script."""
    __tablename__ = "show_runtime_estimates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version_id = Column(Integer, ForeignKey("show_versions.id", ondelete="CASCADE"), nullable=False, index=True, unique=True)
    total_minutes = Column(Integer, nullable=True)
    act_breakdown = Column(JSONB, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    version = relationship("SlateShowVersion")


class SlateCastRequirements(Base):
    """Cast and resource requirements for a version of a show's script."""
    __tablename__ = "show_cast_requirements"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version_id = Column(Integer, ForeignKey("show_versions.id", ondelete="CASCADE"), nullable=False, index=True, unique=True)
    minimum_cast_size = Column(Integer, nullable=True)
    recommended_cast_size = Column(Integer, nullable=True)
    doubling_possibilities = Column(Text, nullable=True)
    musicians = Column(Integer, nullable=True)
    musician_instruments = Column(JSONB, nullable=True)
    locations_count = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    version = relationship("SlateShowVersion")


class SlateBudgetEstimate(Base):
    """Budget estimate for a version of a show's script."""
    __tablename__ = "show_budget_estimates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version_id = Column(Integer, ForeignKey("show_versions.id", ondelete="CASCADE"), nullable=False, index=True, unique=True)
    estimated_range = Column(String, nullable=True)
    factors = Column(JSONB, nullable=True)
    cast_size_impact = Column(Text, nullable=True)
    technical_complexity = Column(Text, nullable=True)
    location_complexity = Column(Text, nullable=True)
    post_production_notes = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    version = relationship("SlateShowVersion")


class SlateComparable(Base):
    """A comparable work for a version of a show's script."""
    __tablename__ = "show_comparables"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version_id = Column(Integer, ForeignKey("show_versions.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String, nullable=False)
    relationship_type = Column(String, nullable=True)
    reasoning = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    version = relationship("SlateShowVersion", back_populates="comparables")


class SlateContentAdvisory(Base):
    """Content advisory for a version of a show's script."""
    __tablename__ = "show_content_advisories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version_id = Column(Integer, ForeignKey("show_versions.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    version = relationship("SlateShowVersion", back_populates="content_advisories")


class SlateLoglineDraft(Base):
    """Logline option for a version of a show's script."""
    __tablename__ = "show_logline_drafts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version_id = Column(Integer, ForeignKey("show_versions.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(Text, nullable=False)
    tone = Column(String, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    version = relationship("SlateShowVersion", back_populates="logline_drafts")


class SlateSummaryDraft(Base):
    """Summary option for a version of a show's script."""
    __tablename__ = "show_summary_drafts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version_id = Column(Integer, ForeignKey("show_versions.id", ondelete="CASCADE"), nullable=False, index=True)
    summary_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    version = relationship("SlateShowVersion", back_populates="summary_drafts")


class SlateVersionDiff(Base):
    """Comparison between two script versions."""
    __tablename__ = "show_version_diffs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    current_version_id = Column(Integer, ForeignKey("show_versions.id"), nullable=False)
    previous_version_id = Column(Integer, ForeignKey("show_versions.id"), nullable=False)
    summary = Column(Text, nullable=True)
    structural_changes = Column(JSONB, nullable=True)
    character_changes = Column(JSONB, nullable=True)
    song_changes = Column(JSONB, nullable=True)
    tone_shift = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    current_version = relationship("SlateShowVersion", foreign_keys=[current_version_id])
    previous_version = relationship("SlateShowVersion", foreign_keys=[previous_version_id])


# =========================================================================
# MILESTONES — events in the show's life (not versioned)
# =========================================================================

class SlateMilestone(Base):
    """Events in the show's life — readings, workshops, submissions, etc."""
    __tablename__ = "show_milestones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    show_id = Column(Integer, ForeignKey("shows.id", ondelete="CASCADE"), nullable=False, index=True)
    version_id = Column(Integer, ForeignKey("show_versions.id"), nullable=True)  # which version was current at this milestone
    title = Column(String, nullable=False)
    date = Column(Date, nullable=False)
    description = Column(Text, nullable=True)
    milestone_type_id = Column(Integer, ForeignKey("lookup_values.id"), nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    show = relationship("SlateShow", back_populates="milestones")
    version = relationship("SlateShowVersion")
    milestone_type = relationship("SlateLookupValue", foreign_keys=[milestone_type_id])


# =========================================================================
# VISUAL IDENTITY — show-level assets (not versioned)
# =========================================================================

class SlateVisualAsset(Base):
    """Visual brand assets for a show."""
    __tablename__ = "show_visual_assets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    show_id = Column(Integer, ForeignKey("shows.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    asset_type_id = Column(Integer, ForeignKey("lookup_values.id"), nullable=True)
    label = Column(String, nullable=False)
    version = Column(String, nullable=True)
    is_current = Column(Boolean, default=True, nullable=False)
    processing_status = Column(String, default="pending", nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    # Analysis fields (populated by AI, editable)
    analysis_color_palette = Column(JSONB, nullable=True)
    analysis_mood = Column(String, nullable=True)
    analysis_tone = Column(String, nullable=True)
    analysis_typography = Column(String, nullable=True)
    analysis_visual_themes = Column(JSONB, nullable=True)
    analysis_communicates = Column(Text, nullable=True)
    analysis_notes = Column(Text, nullable=True)

    show = relationship("SlateShow", back_populates="visual_assets")
    asset_type = relationship("SlateLookupValue", foreign_keys=[asset_type_id])


# =========================================================================
# PITCHES — show-level
# =========================================================================

class SlatePitch(Base):
    """A pitch document about a show, tailored to an audience type."""
    __tablename__ = "show_pitches"

    id = Column(Integer, primary_key=True, autoincrement=True)
    show_id = Column(Integer, ForeignKey("shows.id", ondelete="CASCADE"), nullable=False, index=True)
    version_id = Column(Integer, ForeignKey("show_versions.id", ondelete="CASCADE"), nullable=False, index=True)
    audience_type_id = Column(Integer, ForeignKey("lookup_values.id"), nullable=True)
    target_producer_id = Column(Integer, nullable=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=True)
    status_id = Column(Integer, ForeignKey("lookup_values.id"), nullable=True)
    generated_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    show = relationship("SlateShow", back_populates="pitches")
    version = relationship("SlateShowVersion")
    audience_type = relationship("SlateLookupValue", foreign_keys=[audience_type_id])
    status = relationship("SlateLookupValue", foreign_keys=[status_id])
    materials = relationship("SlatePitchMaterial", back_populates="pitch", cascade="all, delete-orphan")


class SlatePitchMaterial(Base):
    """File attachments to a pitch."""
    __tablename__ = "show_pitch_materials"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pitch_id = Column(Integer, ForeignKey("show_pitches.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    material_type_id = Column(Integer, ForeignKey("lookup_values.id"), nullable=True)
    label = Column(String, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    pitch = relationship("SlatePitch", back_populates="materials")
    material_type = relationship("SlateLookupValue", foreign_keys=[material_type_id])


# =========================================================================
# TOOL INFRASTRUCTURE — lookup values, change history, AI behaviors, settings
# =========================================================================

class SlateLookupValue(Base):
    """Soft enums stored in the database, managed via UI."""
    __tablename__ = "lookup_values"

    id = Column(Integer, primary_key=True, autoincrement=True)
    category = Column(String, nullable=False, index=True)
    entity_type = Column(String, nullable=False, index=True)
    value = Column(String, nullable=False)
    display_label = Column(String, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    description = Column(Text, nullable=True)
    css_class = Column(String, nullable=True)
    applies_to = Column(JSONB, nullable=True)

    __table_args__ = (
        UniqueConstraint("category", "entity_type", "value"),
    )


class SlateChangeHistory(Base):
    """Field-level change tracking across all entity types."""
    __tablename__ = "change_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_type = Column(String, nullable=False, index=True)
    entity_id = Column(Integer, nullable=False)
    field_name = Column(String, nullable=False)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    changed_by = Column(String, nullable=False)
    changed_at = Column(DateTime, default=_utcnow, nullable=False)


class SlateAIBehavior(Base):
    """Runtime-editable prompt configurations for Slate AI features."""
    __tablename__ = "ai_behaviors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True, index=True)
    display_label = Column(String, nullable=False)
    system_prompt = Column(Text, nullable=False)
    user_prompt = Column(Text, nullable=False)
    model = Column(String, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)


class SlateSettings(Base):
    """Tool-level configuration for Slate."""
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String, nullable=False, unique=True, index=True)
    value = Column(JSONB, nullable=True)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)


# =========================================================================
# Convenience aliases for imports
# =========================================================================

Show = SlateShow
ShowVersion = SlateShowVersion
MusicFile = SlateMusicFile
Character = SlateCharacter
Scene = SlateScene
Song = SlateSong
ArcPoint = SlateArcPoint
Credit = SlateCredit
RuntimeEstimate = SlateRuntimeEstimate
CastRequirements = SlateCastRequirements
BudgetEstimate = SlateBudgetEstimate
Comparable = SlateComparable
ContentAdvisory = SlateContentAdvisory
LoglineDraft = SlateLoglineDraft
SummaryDraft = SlateSummaryDraft
VersionDiff = SlateVersionDiff
DevelopmentMilestone = SlateMilestone
VisualAsset = SlateVisualAsset
Pitch = SlatePitch
PitchMaterial = SlatePitchMaterial

# All models for table creation
ALL_MODELS = [
    SlateShow,
    SlateShowVersion,
    SlateMusicFile,
    SlateCharacter,
    SlateScene,
    SlateSong,
    SlateArcPoint,
    SlateCredit,
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
