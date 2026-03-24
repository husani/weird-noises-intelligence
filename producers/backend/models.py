"""
Producers data models.

All tables for the Producers tool — producer records, productions, organizations,
venues, awards, interactions, follow-up signals, tags, change history, settings,
discovery (scans, candidates, focus areas, intelligence profiles, calibration),
and managed research sources.
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

class Show(Base):
    """A theatrical work as intellectual property — the work itself, independent of any mounting."""
    __tablename__ = "shows"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=False, index=True)
    medium_id = Column(Integer, ForeignKey("lookup_values.id"), nullable=True)
    original_year = Column(Integer, nullable=True)
    description = Column(Text, nullable=True)
    genre = Column(Text, nullable=True)
    themes = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    plot_synopsis = Column(Text, nullable=True)
    work_origin_id = Column(Integer, ForeignKey("lookup_values.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    medium = relationship("LookupValue", foreign_keys=[medium_id])
    work_origin = relationship("LookupValue", foreign_keys=[work_origin_id])
    productions = relationship("Production", back_populates="show")
    producer_shows = relationship("ProducerShow", back_populates="show", cascade="all, delete-orphan")


class ProducerShow(Base):
    """Junction: producer ↔ show with role (IP-level relationship, not production credit)."""
    __tablename__ = "producer_shows"

    id = Column(Integer, primary_key=True, autoincrement=True)
    producer_id = Column(Integer, ForeignKey("producers.id", ondelete="CASCADE"), nullable=False)
    show_id = Column(Integer, ForeignKey("shows.id", ondelete="CASCADE"), nullable=False)
    role_id = Column(Integer, ForeignKey("lookup_values.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    producer = relationship("Producer", back_populates="shows")
    show = relationship("Show", back_populates="producer_shows")
    role = relationship("LookupValue", foreign_keys=[role_id])

    __table_args__ = (
        UniqueConstraint("producer_id", "show_id", "role_id", name="uq_producer_show_role"),
    )


# --- Producer ---

class Producer(Base):
    """Core producer record with identity, dossier fields, and relationship state."""
    __tablename__ = "producers"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Identity
    first_name = Column(String, nullable=False, index=True)
    last_name = Column(String, nullable=False, index=True)
    phone = Column(String, nullable=True)
    city = Column(String, nullable=True)
    state_region = Column(String, nullable=True)
    country = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)
    website = Column(String, nullable=True)
    birthdate = Column(Date, nullable=True)
    pronouns = Column(String, nullable=True)
    nickname = Column(String, nullable=True)
    college = Column(String, nullable=True)
    hometown = Column(String, nullable=True)
    hometown_state = Column(String, nullable=True)
    hometown_country = Column(String, nullable=True)
    spouse_partner = Column(String, nullable=True)
    languages = Column(String, nullable=True)
    seasonal_location = Column(String, nullable=True)
    description = Column(Text, nullable=True)  # Prose summary of who this producer is

    # Dossier metadata
    last_research_date = Column(DateTime(timezone=True), nullable=True)
    research_sources_consulted = Column(JSONB, nullable=True)  # list of source names
    research_gaps = Column(JSONB, nullable=True)  # list of sections with thin/no results

    # Intake source
    intake_source = Column(String, nullable=True)  # manual, url, spreadsheet, ai_discovery
    intake_source_url = Column(String, nullable=True)
    intake_ai_reasoning = Column(Text, nullable=True)

    # Relationship state (stored, recomputed on interaction changes)
    last_contact_date = Column(DateTime(timezone=True), nullable=True)
    interaction_count = Column(Integer, default=0)
    interaction_frequency = Column(Float, nullable=True)  # avg days between interactions
    next_followup_due = Column(DateTime(timezone=True), nullable=True)

    # Research status
    research_status = Column(String, default="pending")  # pending, in_progress, complete, failed
    research_status_detail = Column(Text, nullable=True)  # Current step or error detail

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=_utcnow)

    # Relationships
    productions = relationship("ProducerProduction", back_populates="producer", cascade="all, delete-orphan")
    organizations = relationship("ProducerOrganization", back_populates="producer", cascade="all, delete-orphan")
    interactions = relationship("Interaction", back_populates="producer", cascade="all, delete-orphan", order_by="Interaction.date.desc()")
    tags = relationship("ProducerTag", back_populates="producer", cascade="all, delete-orphan")
    awards = relationship("Award", back_populates="producer", cascade="all, delete-orphan")
    shows = relationship("ProducerShow", back_populates="producer", cascade="all, delete-orphan")
    traits = relationship("ProducerTrait", back_populates="producer", cascade="all, delete-orphan")
    intel = relationship("ProducerIntel", back_populates="producer", cascade="all, delete-orphan")



# --- Productions ---

class Production(Base):
    """A specific mounting of a show — a production run at a venue in a given year."""
    __tablename__ = "productions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    show_id = Column(Integer, ForeignKey("shows.id", ondelete="CASCADE"), nullable=False)
    venue_id = Column(Integer, ForeignKey("venues.id"), nullable=True)
    year = Column(Integer, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    scale_id = Column(Integer, ForeignKey("lookup_values.id"), nullable=True)
    run_length = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    production_type_id = Column(Integer, ForeignKey("lookup_values.id"), nullable=True)
    capitalization = Column(Integer, nullable=True)
    budget_tier_id = Column(Integer, ForeignKey("lookup_values.id"), nullable=True)
    recouped = Column(Boolean, nullable=True)
    funding_type_id = Column(Integer, ForeignKey("lookup_values.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    show = relationship("Show", back_populates="productions")
    venue = relationship("Venue", back_populates="productions")
    scale = relationship("LookupValue", foreign_keys=[scale_id])
    production_type = relationship("LookupValue", foreign_keys=[production_type_id])
    budget_tier = relationship("LookupValue", foreign_keys=[budget_tier_id])
    funding_type = relationship("LookupValue", foreign_keys=[funding_type_id])
    producers = relationship("ProducerProduction", back_populates="production", cascade="all, delete-orphan")


class ProducerProduction(Base):
    """Junction: producer ↔ production with credit role."""
    __tablename__ = "producer_productions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    producer_id = Column(Integer, ForeignKey("producers.id", ondelete="CASCADE"), nullable=False)
    production_id = Column(Integer, ForeignKey("productions.id", ondelete="CASCADE"), nullable=False)
    role_id = Column(Integer, ForeignKey("lookup_values.id"), nullable=True)

    producer = relationship("Producer", back_populates="productions")
    production = relationship("Production", back_populates="producers")
    role = relationship("LookupValue", foreign_keys=[role_id])

    __table_args__ = (
        UniqueConstraint("producer_id", "production_id", name="uq_producer_production"),
    )


# --- Organizations ---

class Organization(Base):
    """A producing organization — its own entity."""
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, index=True)
    org_type_id = Column(Integer, ForeignKey("lookup_values.id"), nullable=True)
    website = Column(String, nullable=True)
    city = Column(String, nullable=True)
    state_region = Column(String, nullable=True)
    country = Column(String, nullable=True)
    description = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    org_type = relationship("LookupValue", foreign_keys=[org_type_id])
    producers = relationship("ProducerOrganization", back_populates="organization", cascade="all, delete-orphan")


class SocialPlatform(Base):
    """A managed social/profile platform (e.g. Instagram, IBDb)."""
    __tablename__ = "social_platforms"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True, index=True)
    base_url = Column(String, nullable=True)
    icon_svg = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=_utcnow)


class LookupValue(Base):
    """Centralized soft-enum values for dropdowns and badge mappings."""
    __tablename__ = "lookup_values"

    id = Column(Integer, primary_key=True, autoincrement=True)
    category = Column(String, nullable=False, index=True)
    entity_type = Column(String, nullable=False, index=True)
    value = Column(String, nullable=False)
    display_label = Column(String, nullable=False)
    sort_order = Column(Integer, default=0)
    description = Column(Text, nullable=True)
    css_class = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("category", "entity_type", "value", name="uq_lookup_category_entity_value"),
    )


class EntitySocialLink(Base):
    """Polymorphic social link — replaces JSONB social_links on Producer/Organization."""
    __tablename__ = "entity_social_links"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_type = Column(String, nullable=False, index=True)
    entity_id = Column(Integer, nullable=False, index=True)
    platform_id = Column(Integer, ForeignKey("social_platforms.id", ondelete="CASCADE"), nullable=False)
    url = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    platform = relationship("SocialPlatform")

    __table_args__ = (
        UniqueConstraint("entity_type", "entity_id", "platform_id", name="uq_entity_social_link"),
    )


class EntityEmail(Base):
    """Polymorphic email — replaces email/email_candidates on Producer."""
    __tablename__ = "entity_emails"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_type = Column(String, nullable=False, index=True)
    entity_id = Column(Integer, nullable=False, index=True)
    email = Column(String, nullable=False, index=True)
    type_id = Column(Integer, ForeignKey("lookup_values.id"), nullable=True)
    source = Column(String, nullable=True)
    confidence = Column(String, nullable=True)
    is_primary = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    email_type = relationship("LookupValue", foreign_keys=[type_id])

    __table_args__ = (
        UniqueConstraint("entity_type", "entity_id", "email", name="uq_entity_email"),
    )


class ProducerOrganization(Base):
    """Junction: producer ↔ organization with role and dates."""
    __tablename__ = "producer_organizations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    producer_id = Column(Integer, ForeignKey("producers.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    role_title = Column(String, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)  # null = current
    notes = Column(Text, nullable=True)

    producer = relationship("Producer", back_populates="organizations")
    organization = relationship("Organization", back_populates="producers")


# --- Venues ---

class Venue(Base):
    """A theatre venue — its own entity."""
    __tablename__ = "venues"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, index=True)
    venue_type_id = Column(Integer, ForeignKey("lookup_values.id"), nullable=True)
    city = Column(String, nullable=True)
    state_region = Column(String, nullable=True)
    country = Column(String, nullable=True)
    capacity = Column(Integer, nullable=True)
    description = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    venue_type = relationship("LookupValue", foreign_keys=[venue_type_id])
    productions = relationship("Production", back_populates="venue")


# --- Awards ---

class Award(Base):
    """An award belonging to a producer, optionally linked to a production."""
    __tablename__ = "awards"

    id = Column(Integer, primary_key=True, autoincrement=True)
    producer_id = Column(Integer, ForeignKey("producers.id", ondelete="CASCADE"), nullable=False)
    production_id = Column(Integer, ForeignKey("productions.id", ondelete="SET NULL"), nullable=True)
    award_name = Column(String, nullable=False)  # Tony, Drama Desk, Outer Critics, Obie, Pulitzer, other
    category = Column(String, nullable=True)
    year = Column(Integer, nullable=True)
    outcome_id = Column(Integer, ForeignKey("lookup_values.id"), nullable=True)

    producer = relationship("Producer", back_populates="awards")
    production = relationship("Production")
    outcome = relationship("LookupValue", foreign_keys=[outcome_id])


# --- Interactions ---

class Interaction(Base):
    """A timestamped touchpoint between WN and a producer."""
    __tablename__ = "interactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    producer_id = Column(Integer, ForeignKey("producers.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(DateTime(timezone=True), default=_utcnow)
    content = Column(Text, nullable=False)
    author = Column(String, nullable=False)  # team member name
    audio_url = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    producer = relationship("Producer", back_populates="interactions")
    follow_up_signals = relationship("FollowUpSignal", back_populates="interaction", cascade="all, delete-orphan")


# --- Follow-up Signals ---

class FollowUpSignal(Base):
    """A follow-up extracted from interaction text by AI."""
    __tablename__ = "follow_up_signals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    interaction_id = Column(Integer, ForeignKey("interactions.id", ondelete="CASCADE"), nullable=False)
    producer_id = Column(Integer, ForeignKey("producers.id", ondelete="CASCADE"), nullable=False, index=True)
    implied_action = Column(Text, nullable=False)
    timeframe = Column(String, nullable=True)  # e.g. "next week", "2 weeks"
    due_date = Column(DateTime(timezone=True), nullable=True)
    resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    interaction = relationship("Interaction", back_populates="follow_up_signals")


# --- Tags ---

class Tag(Base):
    """A reusable tag."""
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ProducerTag(Base):
    """Junction: producer ↔ tag."""
    __tablename__ = "producer_tags"

    id = Column(Integer, primary_key=True, autoincrement=True)
    producer_id = Column(Integer, ForeignKey("producers.id", ondelete="CASCADE"), nullable=False)
    tag_id = Column(Integer, ForeignKey("tags.id", ondelete="CASCADE"), nullable=False)

    producer = relationship("Producer", back_populates="tags")
    tag = relationship("Tag")

    __table_args__ = (
        UniqueConstraint("producer_id", "tag_id", name="uq_producer_tag"),
    )


# --- Change History ---

class ChangeHistory(Base):
    """Field-level change log for audit and institutional knowledge."""
    __tablename__ = "change_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_type = Column(String, nullable=False, index=True)  # producer, production, organization, etc.
    entity_id = Column(Integer, nullable=False, index=True)
    field_name = Column(String, nullable=False)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    changed_by = Column(String, nullable=False)  # user email or "AI research" / "AI refresh"
    changed_at = Column(DateTime(timezone=True), server_default=func.now())


# --- Settings ---

class ProducerSettings(Base):
    """Tool-level configuration for Producers."""
    __tablename__ = "producer_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String, nullable=False, unique=True)
    value = Column(JSONB, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=_utcnow)


# --- AI Discovery ---

class DiscoveryScan(Base):
    """A single discovery scan run — tracks what was searched, what was found."""
    __tablename__ = "discovery_scans"

    id = Column(Integer, primary_key=True, autoincrement=True)
    focus_area = Column(Text, nullable=True)  # what this scan looked for
    focus_type_id = Column(Integer, ForeignKey("lookup_values.id"), nullable=True)
    intelligence_profile_snapshot = Column(Text, nullable=True)  # profile used for this scan
    calibration_snapshot = Column(Text, nullable=True)  # calibration used for this scan
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, default="running")  # running, complete, failed
    candidates_found = Column(Integer, default=0)
    candidates_after_dedup = Column(Integer, default=0)
    error_detail = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    focus_type = relationship("LookupValue", foreign_keys=[focus_type_id])
    candidates = relationship("DiscoveryCandidate", back_populates="scan")


class DiscoveryFocusArea(Base):
    """A configured focus area for automated scan rotation."""
    __tablename__ = "discovery_focus_areas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    active = Column(Boolean, default=True)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    sort_order = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class IntelligenceProfile(Base):
    """Auto-generated summary of the database's coverage — used as context for discovery."""
    __tablename__ = "intelligence_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    profile_text = Column(Text, nullable=False)
    producer_count = Column(Integer, default=0)
    org_coverage = Column(Text, nullable=True)
    geographic_distribution = Column(Text, nullable=True)
    aesthetic_coverage = Column(Text, nullable=True)
    scale_distribution = Column(Text, nullable=True)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())


class DiscoveryCalibration(Base):
    """Distilled summary of dismissal patterns — used to calibrate discovery scans."""
    __tablename__ = "discovery_calibrations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    calibration_text = Column(Text, nullable=False)
    dismissal_count = Column(Integer, default=0)  # how many dismissals were summarized
    generated_at = Column(DateTime(timezone=True), server_default=func.now())


class DiscoveryCandidate(Base):
    """A producer discovered by the AI pipeline, pending team review."""
    __tablename__ = "discovery_candidates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scan_id = Column(Integer, ForeignKey("discovery_scans.id"), nullable=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    reasoning = Column(Text, nullable=False)  # why flagged
    source = Column(String, nullable=True)  # what triggered the discovery
    raw_data = Column(JSONB, nullable=True)  # full enriched data from the LLM
    status = Column(String, default="pending")  # pending, confirmed, dismissed
    dismissed_reason = Column(Text, nullable=True)
    dedup_status = Column(String, nullable=True)  # clean, potential_duplicate, definite_duplicate
    dedup_matches = Column(JSONB, nullable=True)  # [{producer_id, match_type, confidence, signals}]

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by = Column(String, nullable=True)

    scan = relationship("DiscoveryScan", back_populates="candidates")


# --- Research Sources ---

class ResearchSource(Base):
    """A managed source the AI should always check when researching."""
    __tablename__ = "research_sources"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    url = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ProducerTrait(Base):
    """An analytical trait observation about a producer."""
    __tablename__ = "producer_traits"

    id = Column(Integer, primary_key=True, autoincrement=True)
    producer_id = Column(Integer, ForeignKey("producers.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(Integer, ForeignKey("lookup_values.id"), nullable=False)
    value = Column(Text, nullable=False)
    confidence = Column(Integer, nullable=True)
    computed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    producer = relationship("Producer", back_populates="traits")
    category = relationship("LookupValue", foreign_keys=[category_id])


class ProducerIntel(Base):
    """An intelligence observation about a producer."""
    __tablename__ = "producer_intel"

    id = Column(Integer, primary_key=True, autoincrement=True)
    producer_id = Column(Integer, ForeignKey("producers.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(Integer, ForeignKey("lookup_values.id"), nullable=False)
    observation = Column(Text, nullable=False)
    confidence = Column(Integer, nullable=True)
    source_url = Column(String, nullable=True)
    discovered_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    producer = relationship("Producer", back_populates="intel")
    category = relationship("LookupValue", foreign_keys=[category_id])


# --- AI Configuration ---

class AIBehavior(Base):
    """Configuration for an AI behavior — prompt templates and model selection."""
    __tablename__ = "ai_behaviors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True, index=True)
    display_label = Column(String, nullable=False)
    system_prompt = Column(Text, nullable=False)
    user_prompt = Column(Text, nullable=False)
    model = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=_utcnow)


# All models for create_tables
ALL_MODELS = [
    Show,
    Producer,
    ProducerShow,
    Production,
    ProducerProduction,
    Organization,
    SocialPlatform,
    LookupValue,
    EntitySocialLink,
    EntityEmail,
    ProducerOrganization,
    Venue,
    Award,
    Interaction,
    FollowUpSignal,
    Tag,
    ProducerTag,
    ChangeHistory,
    ProducerSettings,
    DiscoveryScan,
    DiscoveryFocusArea,
    IntelligenceProfile,
    DiscoveryCalibration,
    DiscoveryCandidate,
    ResearchSource,
    ProducerTrait,
    ProducerIntel,
    AIBehavior,
]
