"""
Slate interface — business logic and MCP tool registration.

The interface class owns the session factory and registers MCP tools
as closures that capture self for database access.
"""

from fastmcp import FastMCP
from sqlalchemy.orm import joinedload

from slate.backend.models import (
    BudgetEstimate,
    CastRequirements,
    Character,
    Comparable,
    ContentAdvisory,
    DevelopmentMilestone,
    LoglineDraft,
    MusicFile,
    Pitch,
    RuntimeEstimate,
    Scene,
    ScriptVersion,
    Show,
    SlateLookupValue,
    Song,
    SummaryDraft,
    VersionDiff,
    VisualAsset,
)


class SlateInterface:
    def __init__(self, session_factory, mcp_server: FastMCP):
        self._session_factory = session_factory
        self._mcp_server = mcp_server
        self._register_mcp_tools(mcp_server)

    def _register_mcp_tools(self, mcp_server: FastMCP):
        """Register all MCP tools for LLM + code-to-code access."""

        @mcp_server.tool
        def slate_list_shows(
            search: str = "",
            stage: str = "",
            medium: str = "",
        ) -> list[dict]:
            """List all WN shows with title, medium, genre, logline, development stage.
            Supports search by title, filter by stage value and medium value."""
            return self.list_shows(search=search, stage=stage, medium=medium)

        @mcp_server.tool
        def slate_get_show(show_id: int) -> dict:
            """Full show profile: identity, development stage, current script version,
            milestones, visual identity assets, characters, scenes, songs, runtime,
            cast requirements, budget estimate, comparables, and content advisories."""
            return self.get_show(show_id)

        @mcp_server.tool
        def slate_get_script(version_id: int) -> dict:
            """Script version details including file path, change notes,
            and music files."""
            return self.get_script(version_id)

        @mcp_server.tool
        def slate_get_show_summary(show_id: int) -> dict:
            """The show's current logline, summary, comparables, and development stage —
            the information other tools most commonly need."""
            return self.get_show_summary(show_id)

        @mcp_server.tool
        def slate_get_characters(show_id: int) -> list[dict] | None:
            """Character breakdown for a show."""
            return self.get_characters(show_id)

        @mcp_server.tool
        def slate_get_structure(show_id: int) -> list[dict] | None:
            """Scene breakdown for a show."""
            return self.get_structure(show_id)

        @mcp_server.tool
        def slate_get_pitch(show_id: int, audience_type: str = "general") -> dict | None:
            """Get the most recent pitch for a show by audience type.
            audience_type can be: producer, investor, grant_maker, festival, general."""
            return self.get_pitch(show_id, audience_type)

        @mcp_server.tool
        def slate_get_budget_estimate(show_id: int) -> dict | None:
            """Budget estimate for a show, including estimated range, cost factors,
            cast size impact, and technical complexity."""
            return self.get_budget_estimate(show_id)

    # --- Business logic methods ---

    def _lookup_dict(self, lv):
        """Serialize a SlateLookupValue or None."""
        if not lv:
            return None
        return {
            "id": lv.id,
            "value": lv.value,
            "display_label": lv.display_label,
            "description": lv.description,
            "css_class": lv.css_class,
        }

    def list_shows(self, search="", stage="", medium=""):
        with self._session_factory() as session:
            query = session.query(Show).options(
                joinedload(Show.medium),
                joinedload(Show.development_stage),
                joinedload(Show.rights_status),
            )

            if search:
                query = query.filter(Show.title.ilike(f"%{search}%"))
            if stage:
                query = query.join(
                    SlateLookupValue,
                    Show.development_stage_id == SlateLookupValue.id,
                ).filter(SlateLookupValue.value == stage)
            if medium:
                query = query.join(
                    SlateLookupValue,
                    Show.medium_id == SlateLookupValue.id,
                ).filter(SlateLookupValue.value == medium)

            shows = query.order_by(Show.updated_at.desc()).all()
            return [
                {
                    "id": s.id,
                    "title": s.title,
                    "medium": self._lookup_dict(s.medium),
                    "genre": s.genre,
                    "logline": s.logline,
                    "development_stage": self._lookup_dict(s.development_stage),
                    "updated_at": s.updated_at.isoformat() if s.updated_at else None,
                }
                for s in shows
            ]

    def get_show(self, show_id):
        with self._session_factory() as session:
            show = (
                session.query(Show)
                .options(
                    joinedload(Show.medium),
                    joinedload(Show.development_stage),
                    joinedload(Show.rights_status),
                    joinedload(Show.script_versions),
                    joinedload(Show.milestones).joinedload(DevelopmentMilestone.milestone_type),
                    joinedload(Show.visual_assets).joinedload(VisualAsset.asset_type),
                    joinedload(Show.characters),
                    joinedload(Show.scenes),
                    joinedload(Show.songs),
                    joinedload(Show.arc_points),
                    joinedload(Show.comparables),
                    joinedload(Show.content_advisories),
                    joinedload(Show.logline_drafts),
                    joinedload(Show.summary_drafts),
                )
                .filter(Show.id == show_id)
                .first()
            )
            if not show:
                return None

            current_version = show.script_versions[0] if show.script_versions else None

            # One-to-one relationships (not eager-loaded via joinedload above
            # because uselist=False + joinedload on the query works, but let's
            # query explicitly for clarity)
            runtime = (
                session.query(RuntimeEstimate)
                .filter(RuntimeEstimate.show_id == show_id)
                .first()
            )
            cast_req = (
                session.query(CastRequirements)
                .filter(CastRequirements.show_id == show_id)
                .first()
            )
            budget = (
                session.query(BudgetEstimate)
                .filter(BudgetEstimate.show_id == show_id)
                .first()
            )

            # Version diffs
            version_diffs = (
                session.query(VersionDiff)
                .filter(VersionDiff.show_id == show_id)
                .order_by(VersionDiff.created_at.desc())
                .all()
            )

            return {
                "id": show.id,
                "title": show.title,
                "medium": self._lookup_dict(show.medium),
                "genre": show.genre,
                "logline": show.logline,
                "summary": show.summary,
                "emotional_arc_summary": show.emotional_arc_summary,
                "rights_status": self._lookup_dict(show.rights_status),
                "development_stage": self._lookup_dict(show.development_stage),
                "created_at": show.created_at.isoformat(),
                "updated_at": show.updated_at.isoformat(),
                "current_script_version": self._version_dict(current_version) if current_version else None,
                "milestones": [
                    {
                        "id": m.id,
                        "title": m.title,
                        "date": m.date.isoformat() if m.date else None,
                        "description": m.description,
                        "milestone_type": self._lookup_dict(m.milestone_type),
                        "script_version_id": m.script_version_id,
                    }
                    for m in show.milestones
                ],
                "visual_assets": [
                    {
                        "id": a.id,
                        "label": a.label,
                        "asset_type": self._lookup_dict(a.asset_type),
                        "version": a.version,
                        "is_current": a.is_current,
                        "original_filename": a.original_filename,
                        "processing_status": a.processing_status,
                    }
                    for a in show.visual_assets
                ],
                "characters": [
                    {
                        "id": c.id,
                        "name": c.name,
                        "description": c.description,
                        "age_range": c.age_range,
                        "gender": c.gender,
                        "line_count": c.line_count,
                        "vocal_range": c.vocal_range,
                        "song_count": c.song_count,
                        "dance_requirements": c.dance_requirements,
                        "notes": c.notes,
                        "sort_order": c.sort_order,
                    }
                    for c in show.characters
                ],
                "scenes": [
                    {
                        "id": s.id,
                        "act_number": s.act_number,
                        "scene_number": s.scene_number,
                        "title": s.title,
                        "location": s.location,
                        "int_ext": s.int_ext,
                        "time_of_day": s.time_of_day,
                        "characters_present": s.characters_present,
                        "description": s.description,
                        "estimated_minutes": s.estimated_minutes,
                        "sort_order": s.sort_order,
                    }
                    for s in show.scenes
                ],
                "songs": [
                    {
                        "id": sg.id,
                        "title": sg.title,
                        "act": sg.act,
                        "scene": sg.scene,
                        "characters": sg.characters,
                        "song_type": sg.song_type,
                        "description": sg.description,
                        "sort_order": sg.sort_order,
                    }
                    for sg in show.songs
                ],
                "arc_points": [
                    {
                        "id": p.id,
                        "position": p.position,
                        "intensity": p.intensity,
                        "label": p.label,
                        "tone": p.tone,
                        "sort_order": p.sort_order,
                    }
                    for p in show.arc_points
                ],
                "runtime_estimate": {
                    "id": runtime.id,
                    "total_minutes": runtime.total_minutes,
                    "act_breakdown": runtime.act_breakdown,
                    "notes": runtime.notes,
                } if runtime else None,
                "cast_requirements": {
                    "id": cast_req.id,
                    "minimum_cast_size": cast_req.minimum_cast_size,
                    "recommended_cast_size": cast_req.recommended_cast_size,
                    "doubling_possibilities": cast_req.doubling_possibilities,
                    "musicians": cast_req.musicians,
                    "musician_instruments": cast_req.musician_instruments,
                    "locations_count": cast_req.locations_count,
                    "notes": cast_req.notes,
                } if cast_req else None,
                "budget_estimate": {
                    "id": budget.id,
                    "estimated_range": budget.estimated_range,
                    "factors": budget.factors,
                    "cast_size_impact": budget.cast_size_impact,
                    "technical_complexity": budget.technical_complexity,
                    "location_complexity": budget.location_complexity,
                    "post_production_notes": budget.post_production_notes,
                    "notes": budget.notes,
                } if budget else None,
                "comparables": [
                    {
                        "id": c.id,
                        "title": c.title,
                        "relationship_type": c.relationship_type,
                        "reasoning": c.reasoning,
                    }
                    for c in show.comparables
                ],
                "content_advisories": [
                    {
                        "id": a.id,
                        "category": a.category,
                        "description": a.description,
                        "severity": a.severity,
                    }
                    for a in show.content_advisories
                ],
                "logline_drafts": [
                    {
                        "id": d.id,
                        "text": d.text,
                        "tone": d.tone,
                        "created_at": d.created_at.isoformat(),
                    }
                    for d in show.logline_drafts
                ],
                "summary_drafts": [
                    {
                        "id": d.id,
                        "summary_text": d.summary_text,
                        "created_at": d.created_at.isoformat(),
                    }
                    for d in show.summary_drafts
                ],
                "version_diffs": [
                    {
                        "id": d.id,
                        "current_version_id": d.current_version_id,
                        "previous_version_id": d.previous_version_id,
                        "summary": d.summary,
                        "created_at": d.created_at.isoformat(),
                    }
                    for d in version_diffs
                ],
            }

    def _version_dict(self, v):
        """Serialize a ScriptVersion."""
        if not v:
            return None
        return {
            "id": v.id,
            "version_label": v.version_label,
            "original_filename": v.original_filename,
            "upload_date": v.upload_date.isoformat() if v.upload_date else None,
            "change_notes": v.change_notes,
            "processing_status": v.processing_status,
        }

    def get_script(self, version_id):
        with self._session_factory() as session:
            version = (
                session.query(ScriptVersion)
                .options(
                    joinedload(ScriptVersion.music_files).joinedload(MusicFile.track_type),
                )
                .filter(ScriptVersion.id == version_id)
                .first()
            )
            if not version:
                return None

            return {
                "id": version.id,
                "show_id": version.show_id,
                "version_label": version.version_label,
                "file_path": version.file_path,
                "original_filename": version.original_filename,
                "upload_date": version.upload_date.isoformat() if version.upload_date else None,
                "change_notes": version.change_notes,
                "processing_status": version.processing_status,
                "processing_error": version.processing_error,
                "music_files": [
                    {
                        "id": m.id,
                        "track_name": m.track_name,
                        "track_type": self._lookup_dict(m.track_type),
                        "description": m.description,
                        "original_filename": m.original_filename,
                        "sort_order": m.sort_order,
                        "processing_status": m.processing_status,
                    }
                    for m in version.music_files
                ],
            }

    def get_show_summary(self, show_id):
        with self._session_factory() as session:
            show = (
                session.query(Show)
                .options(
                    joinedload(Show.medium),
                    joinedload(Show.development_stage),
                    joinedload(Show.comparables),
                )
                .filter(Show.id == show_id)
                .first()
            )
            if not show:
                return None

            return {
                "id": show.id,
                "title": show.title,
                "medium": self._lookup_dict(show.medium),
                "logline": show.logline,
                "summary": show.summary,
                "development_stage": self._lookup_dict(show.development_stage),
                "comparables": [
                    {
                        "id": c.id,
                        "title": c.title,
                        "relationship_type": c.relationship_type,
                        "reasoning": c.reasoning,
                    }
                    for c in show.comparables
                ],
            }

    def get_characters(self, show_id):
        with self._session_factory() as session:
            chars = (
                session.query(Character)
                .filter(Character.show_id == show_id)
                .order_by(Character.sort_order)
                .all()
            )
            if not chars:
                return None
            return [
                {
                    "name": c.name,
                    "description": c.description,
                    "age_range": c.age_range,
                    "gender": c.gender,
                    "line_count": c.line_count,
                    "vocal_range": c.vocal_range,
                    "song_count": c.song_count,
                    "dance_requirements": c.dance_requirements,
                    "notes": c.notes,
                }
                for c in chars
            ]

    def get_structure(self, show_id):
        with self._session_factory() as session:
            scenes = (
                session.query(Scene)
                .filter(Scene.show_id == show_id)
                .order_by(Scene.sort_order)
                .all()
            )
            if not scenes:
                return None
            return [
                {
                    "act_number": s.act_number,
                    "scene_number": s.scene_number,
                    "title": s.title,
                    "location": s.location,
                    "int_ext": s.int_ext,
                    "time_of_day": s.time_of_day,
                    "characters_present": s.characters_present,
                    "description": s.description,
                    "estimated_minutes": s.estimated_minutes,
                }
                for s in scenes
            ]

    def get_pitch(self, show_id, audience_type="general"):
        with self._session_factory() as session:
            # Resolve audience_type string to lookup value
            audience_lv = (
                session.query(SlateLookupValue)
                .filter_by(category="audience_type", entity_type="pitch", value=audience_type)
                .first()
            )

            query = (
                session.query(Pitch)
                .filter(Pitch.show_id == show_id)
            )
            if audience_lv:
                query = query.filter(Pitch.audience_type_id == audience_lv.id)

            pitch = query.order_by(Pitch.created_at.desc()).first()
            if not pitch:
                return None

            return {
                "id": pitch.id,
                "show_id": pitch.show_id,
                "title": pitch.title,
                "content": pitch.content,
                "audience_type": audience_type,
                "target_producer_id": pitch.target_producer_id,
                "generated_by": pitch.generated_by,
                "created_at": pitch.created_at.isoformat() if pitch.created_at else None,
                "updated_at": pitch.updated_at.isoformat() if pitch.updated_at else None,
            }

    def get_budget_estimate(self, show_id):
        with self._session_factory() as session:
            est = (
                session.query(BudgetEstimate)
                .filter(BudgetEstimate.show_id == show_id)
                .first()
            )
            if not est:
                return None
            return {
                "estimated_range": est.estimated_range,
                "factors": est.factors,
                "cast_size_impact": est.cast_size_impact,
                "technical_complexity": est.technical_complexity,
                "location_complexity": est.location_complexity,
                "post_production_notes": est.post_production_notes,
                "notes": est.notes,
            }
