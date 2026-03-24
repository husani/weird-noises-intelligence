"""
Slate interface — business logic and MCP tool registration.

The interface class owns the session factory and registers MCP tools
as closures that capture self for database access.
"""

from fastmcp import FastMCP
from sqlalchemy.orm import joinedload

from slate.backend.models import (
    DevelopmentMilestone,
    MusicFile,
    ScriptVersion,
    Show,
    ShowData,
    SlateLookupValue,
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
            milestones, visual identity assets, and all show data for the current version."""
            return self.get_show(show_id)

        @mcp_server.tool
        def slate_get_script(version_id: int) -> dict:
            """Script version details including file path, change notes,
            music files, and show data derived from this version."""
            return self.get_script(version_id)

        @mcp_server.tool
        def slate_get_show_summary(show_id: int) -> dict:
            """The show's current logline, summary, comparables, and development stage —
            the information other tools most commonly need."""
            return self.get_show_summary(show_id)

        @mcp_server.tool
        def slate_get_characters(show_id: int) -> dict | None:
            """Character breakdown for a show's current script version."""
            return self.get_characters(show_id)

        @mcp_server.tool
        def slate_get_structure(show_id: int) -> dict | None:
            """Scene breakdown for a show's current script version."""
            return self.get_structure(show_id)

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
                )
                .filter(Show.id == show_id)
                .first()
            )
            if not show:
                return None

            current_version = show.script_versions[0] if show.script_versions else None

            # Get show data for current version
            show_data = []
            if current_version:
                show_data = (
                    session.query(ShowData)
                    .filter(
                        ShowData.show_id == show_id,
                        ShowData.source_type == "script_version",
                        ShowData.source_id == current_version.id,
                    )
                    .all()
                )

            return {
                "id": show.id,
                "title": show.title,
                "medium": self._lookup_dict(show.medium),
                "genre": show.genre,
                "logline": show.logline,
                "summary": show.summary,
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
                "show_data": [
                    {
                        "id": d.id,
                        "data_type": d.data_type,
                        "content": d.content,
                        "generated_at": d.generated_at.isoformat() if d.generated_at else None,
                        "model_used": d.model_used,
                    }
                    for d in show_data
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

            show_data = (
                session.query(ShowData)
                .filter(
                    ShowData.source_type == "script_version",
                    ShowData.source_id == version_id,
                )
                .all()
            )

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
                "show_data": [
                    {
                        "id": d.id,
                        "data_type": d.data_type,
                        "content": d.content,
                        "generated_at": d.generated_at.isoformat() if d.generated_at else None,
                        "model_used": d.model_used,
                    }
                    for d in show_data
                ],
            }

    def get_show_summary(self, show_id):
        with self._session_factory() as session:
            show = (
                session.query(Show)
                .options(
                    joinedload(Show.medium),
                    joinedload(Show.development_stage),
                )
                .filter(Show.id == show_id)
                .first()
            )
            if not show:
                return None

            # Get comparables from show data if they exist
            current_version = (
                session.query(ScriptVersion)
                .filter(ScriptVersion.show_id == show_id)
                .order_by(ScriptVersion.created_at.desc())
                .first()
            )
            comparables = None
            if current_version:
                comp_data = (
                    session.query(ShowData)
                    .filter(
                        ShowData.source_type == "script_version",
                        ShowData.source_id == current_version.id,
                        ShowData.data_type == "comparables",
                    )
                    .first()
                )
                if comp_data:
                    comparables = comp_data.content

            return {
                "id": show.id,
                "title": show.title,
                "medium": self._lookup_dict(show.medium),
                "logline": show.logline,
                "summary": show.summary,
                "development_stage": self._lookup_dict(show.development_stage),
                "comparables": comparables,
            }

    def get_characters(self, show_id):
        with self._session_factory() as session:
            # Find current version
            version = (
                session.query(ScriptVersion)
                .filter(ScriptVersion.show_id == show_id)
                .order_by(ScriptVersion.created_at.desc())
                .first()
            )
            if not version:
                return None
            data = (
                session.query(ShowData)
                .filter(
                    ShowData.show_id == show_id,
                    ShowData.source_type == "script_version",
                    ShowData.source_id == version.id,
                    ShowData.data_type == "character_breakdown",
                )
                .first()
            )
            return data.content if data else None

    def get_structure(self, show_id):
        with self._session_factory() as session:
            # Find current version
            version = (
                session.query(ScriptVersion)
                .filter(ScriptVersion.show_id == show_id)
                .order_by(ScriptVersion.created_at.desc())
                .first()
            )
            if not version:
                return None
            data = (
                session.query(ShowData)
                .filter(
                    ShowData.show_id == show_id,
                    ShowData.source_type == "script_version",
                    ShowData.source_id == version.id,
                    ShowData.data_type == "scene_breakdown",
                )
                .first()
            )
            return data.content if data else None
