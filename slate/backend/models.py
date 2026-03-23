"""
Slate data models.

All tables for the Slate tool — shows, script versions, music files,
show data, development milestones, visual identity assets, pitches,
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
    rights_status_id = Column(Integer, ForeignKey("slate_lookup_values.id"), nullable=True)
    development_stage_id = Column(Integer, ForeignKey("slate_lookup_values.id"), nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    # Relationships
    medium = relationship("SlateLookupValue", foreign_keys=[medium_id])
    rights_status = relationship("SlateLookupValue", foreign_keys=[rights_status_id])
    development_stage = relationship("SlateLookupValue", foreign_keys=[development_stage_id])
    script_versions = relationship("SlateScriptVersion", back_populates="show", cascade="all, delete-orphan", order_by="SlateScriptVersion.created_at.desc()")
    milestones = relationship("SlateMilestone", back_populates="show", cascade="all, delete-orphan", order_by="SlateMilestone.date.desc()")
    visual_assets = relationship("SlateVisualAsset", back_populates="show", cascade="all, delete-orphan")
    pitches = relationship("SlatePitch", back_populates="show", cascade="all, delete-orphan")


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

    # Relationships
    script_version = relationship("SlateScriptVersion", back_populates="music_files")
    track_type = relationship("SlateLookupValue", foreign_keys=[track_type_id])


# --- Show Data ---

class SlateShowData(Base):
    """Structured data derived from scripts, music, and visual assets."""
    __tablename__ = "slate_show_data"

    id = Column(Integer, primary_key=True, autoincrement=True)
    show_id = Column(Integer, ForeignKey("slate_shows.id", ondelete="CASCADE"), nullable=False, index=True)
    source_type = Column(String, nullable=False)  # script_version, music_file, visual_asset
    source_id = Column(Integer, nullable=False)
    data_type = Column(String, nullable=False, index=True)  # character_breakdown, scene_breakdown, etc.
    content = Column(JSONB, nullable=False)
    generated_at = Column(DateTime, default=_utcnow, nullable=False)
    model_used = Column(String, nullable=True)

    show = relationship("SlateShow", foreign_keys=[show_id])


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
ShowData = SlateShowData
DevelopmentMilestone = SlateMilestone
VisualAsset = SlateVisualAsset
Pitch = SlatePitch
PitchMaterial = SlatePitchMaterial

# All models for table creation
ALL_MODELS = [
    SlateShow,
    SlateScriptVersion,
    SlateMusicFile,
    SlateShowData,
    SlateMilestone,
    SlateVisualAsset,
    SlatePitch,
    SlatePitchMaterial,
    SlateLookupValue,
    SlateChangeHistory,
    SlateAIBehavior,
    SlateSettings,
]
