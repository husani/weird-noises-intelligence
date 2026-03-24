"""
Slate API routes.

All endpoints under /api/slate/*. Covers shows, script versions,
music files, milestones, visual identity, lookup values, and settings.
"""

import logging
import mimetypes
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import joinedload

from shared.backend.auth.dependencies import get_current_user
from shared.backend.storage.gcs import delete_file, get_signed_url, upload_file
from slate.backend.models import (
    DevelopmentMilestone,
    MusicFile,
    Pitch,
    PitchMaterial,
    ScriptVersion,
    Show,
    ShowData,
    SlateAIBehavior,
    SlateChangeHistory,
    SlateLookupValue,
    SlateSettings,
    VisualAsset,
)

logger = logging.getLogger(__name__)

# Allowed file extensions
SCRIPT_EXTENSIONS = {".pdf", ".docx", ".fdx"}
MUSIC_EXTENSIONS = {".mp3", ".wav", ".aiff", ".m4a", ".flac"}
VISUAL_EXTENSIONS = {".png", ".jpg", ".jpeg", ".svg", ".pdf"}


# --- Request models ---

class CreateShowRequest(BaseModel):
    title: str
    medium_id: Optional[int] = None
    genre: Optional[str] = None
    logline: Optional[str] = None
    summary: Optional[str] = None
    rights_status_id: Optional[int] = None
    development_stage_id: Optional[int] = None


class UpdateShowRequest(BaseModel):
    title: Optional[str] = None
    medium_id: Optional[int] = None
    genre: Optional[str] = None
    logline: Optional[str] = None
    summary: Optional[str] = None
    rights_status_id: Optional[int] = None
    development_stage_id: Optional[int] = None


class UpdateScriptVersionRequest(BaseModel):
    version_label: Optional[str] = None
    change_notes: Optional[str] = None


class UpdateMusicFileRequest(BaseModel):
    track_name: Optional[str] = None
    track_type_id: Optional[int] = None
    description: Optional[str] = None


class CreateMilestoneRequest(BaseModel):
    title: str
    date: str  # ISO date string
    description: Optional[str] = None
    milestone_type_id: Optional[int] = None
    script_version_id: Optional[int] = None


class UpdateMilestoneRequest(BaseModel):
    title: Optional[str] = None
    date: Optional[str] = None
    description: Optional[str] = None
    milestone_type_id: Optional[int] = None
    script_version_id: Optional[int] = None


class UpdateVisualAssetRequest(BaseModel):
    label: Optional[str] = None
    version: Optional[str] = None
    is_current: Optional[bool] = None


class CreateLookupValueRequest(BaseModel):
    category: str
    entity_type: str
    value: str
    display_label: str
    sort_order: Optional[int] = 0
    description: Optional[str] = None
    css_class: Optional[str] = None


class UpdateLookupValueRequest(BaseModel):
    display_label: Optional[str] = None
    sort_order: Optional[int] = None
    description: Optional[str] = None
    css_class: Optional[str] = None


class ReorderLookupValuesRequest(BaseModel):
    ids: list[int]


class CreateShowDataRequest(BaseModel):
    data_type: str
    content: dict
    source_type: str
    source_id: int


class UpdateShowDataRequest(BaseModel):
    content: dict


class UpdateSettingsRequest(BaseModel):
    settings: dict


class CreatePitchRequest(BaseModel):
    title: str
    audience_type_id: Optional[int] = None
    content: Optional[str] = None


class GeneratePitchRequest(BaseModel):
    audience_type: str  # producer, investor, grant_maker, festival, general
    target_producer_id: Optional[int] = None


class UpdatePitchRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    status_id: Optional[int] = None


class QueryRequest(BaseModel):
    query: str


PITCH_MATERIAL_EXTENSIONS = {".pdf", ".docx", ".png", ".jpg", ".jpeg", ".pptx", ".key"}


def _validate_extension(filename: str, allowed: set) -> str | None:
    """Check file extension. Returns the extension or None if invalid."""
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return ext if ext in allowed else None


def _log_change(session, entity_type, entity_id, field, old_val, new_val, user_email):
    """Log a field-level change."""
    if str(old_val) != str(new_val):
        session.add(SlateChangeHistory(
            entity_type=entity_type,
            entity_id=entity_id,
            field_name=field,
            old_value=str(old_val) if old_val is not None else None,
            new_value=str(new_val) if new_val is not None else None,
            changed_by=user_email,
        ))


def _lookup_dict(lv):
    if not lv:
        return None
    d = {
        "id": lv.id,
        "value": lv.value,
        "display_label": lv.display_label,
        "description": lv.description,
        "css_class": lv.css_class,
    }
    if lv.applies_to is not None:
        d["applies_to"] = lv.applies_to
    return d


def create_slate_router(interface, session_factory) -> APIRouter:
    """Create the Slate API router."""
    router = APIRouter(prefix="/api/slate", tags=["slate"])

    # ==================== SHOWS ====================

    @router.get("/shows")
    def list_shows(
        search: str = Query("", description="Search by title"),
        stage: str = Query("", description="Filter by development stage value"),
        medium: str = Query("", description="Filter by medium value"),
        sort: str = Query("updated", description="Sort field: title, updated, created"),
        sort_dir: str = Query("desc", description="Sort direction: asc or desc"),
        limit: int = Query(50, ge=1, le=200),
        offset: int = Query(0, ge=0),
        user: dict = Depends(get_current_user),
    ):
        with session_factory() as session:
            query = session.query(Show).options(
                joinedload(Show.medium),
                joinedload(Show.development_stage),
                joinedload(Show.rights_status),
                joinedload(Show.script_versions),
            )

            if search:
                query = query.filter(Show.title.ilike(f"%{search}%"))
            if stage:
                query = query.join(
                    SlateLookupValue,
                    Show.development_stage_id == SlateLookupValue.id,
                ).filter(SlateLookupValue.value == stage)
            if medium:
                # Need aliased join if stage is also filtered
                from sqlalchemy.orm import aliased
                MediumLV = aliased(SlateLookupValue)
                query = query.join(MediumLV, Show.medium_id == MediumLV.id).filter(MediumLV.value == medium)

            order_map = {
                "title": Show.title,
                "updated": Show.updated_at,
                "created": Show.created_at,
            }
            order_col = order_map.get(sort, Show.updated_at)
            if sort_dir == "asc":
                query = query.order_by(order_col.asc())
            else:
                query = query.order_by(order_col.desc())

            total = query.count()
            shows = query.offset(offset).limit(limit).all()

            return {
                "shows": [
                    {
                        "id": s.id,
                        "title": s.title,
                        "medium": _lookup_dict(s.medium),
                        "genre": s.genre,
                        "logline": s.logline,
                        "development_stage": _lookup_dict(s.development_stage),
                        "rights_status": _lookup_dict(s.rights_status),
                        "current_script_version": s.script_versions[0].version_label if s.script_versions else None,
                        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
                        "created_at": s.created_at.isoformat() if s.created_at else None,
                    }
                    for s in shows
                ],
                "total": total,
            }

    @router.post("/shows")
    def create_show(req: CreateShowRequest, user: dict = Depends(get_current_user)):
        with session_factory() as session:
            show = Show(
                title=req.title,
                medium_id=req.medium_id,
                genre=req.genre,
                logline=req.logline,
                summary=req.summary,
                rights_status_id=req.rights_status_id,
                development_stage_id=req.development_stage_id,
            )
            session.add(show)
            session.flush()
            show_id = show.id
            session.commit()
            return {"id": show_id, "title": req.title}

    @router.get("/shows/{show_id}")
    def get_show(show_id: int, user: dict = Depends(get_current_user)):
        result = interface.get_show(show_id)
        if not result:
            return {"error": "Show not found"}, 404
        return result

    @router.put("/shows/{show_id}")
    def update_show(show_id: int, req: UpdateShowRequest, user: dict = Depends(get_current_user)):
        with session_factory() as session:
            show = session.query(Show).filter(Show.id == show_id).first()
            if not show:
                return {"error": "Show not found"}

            updates = req.model_dump(exclude_unset=True)
            for field, value in updates.items():
                old_value = getattr(show, field)
                if old_value != value:
                    _log_change(session, "show", show_id, field, old_value, value, user["email"])
                    setattr(show, field, value)

            session.commit()
            return {"updated": True, "id": show_id}

    @router.delete("/shows/{show_id}")
    def delete_show(show_id: int, user: dict = Depends(get_current_user)):
        with session_factory() as session:
            show = session.query(Show).filter(Show.id == show_id).first()
            if not show:
                return {"error": "Show not found"}
            session.delete(show)
            session.commit()
            return {"deleted": True}

    # ==================== SCRIPT VERSIONS ====================

    @router.get("/shows/{show_id}/scripts")
    def list_scripts(show_id: int, user: dict = Depends(get_current_user)):
        with session_factory() as session:
            versions = (
                session.query(ScriptVersion)
                .options(joinedload(ScriptVersion.music_files))
                .filter(ScriptVersion.show_id == show_id)
                .order_by(ScriptVersion.created_at.desc())
                .all()
            )
            return {
                "scripts": [
                    {
                        "id": v.id,
                        "version_label": v.version_label,
                        "original_filename": v.original_filename,
                        "upload_date": v.upload_date.isoformat() if v.upload_date else None,
                        "change_notes": v.change_notes,
                        "processing_status": v.processing_status,
                        "music_file_count": len(v.music_files),
                        "created_at": v.created_at.isoformat(),
                    }
                    for v in versions
                ]
            }

    @router.post("/shows/{show_id}/scripts")
    async def upload_script(
        show_id: int,
        background_tasks: BackgroundTasks,
        file: UploadFile = File(...),
        version_label: str = Form(...),
        change_notes: str = Form(""),
        user: dict = Depends(get_current_user),
    ):
        ext = _validate_extension(file.filename, SCRIPT_EXTENSIONS)
        if not ext:
            return {"error": f"Unsupported file type. Allowed: {', '.join(SCRIPT_EXTENSIONS)}"}

        data = await file.read()
        blob_path = f"slate/shows/{show_id}/scripts/{file.filename}"
        content_type = mimetypes.guess_type(file.filename)[0] or "application/octet-stream"
        upload_file(blob_path, data, content_type=content_type)

        with session_factory() as session:
            version = ScriptVersion(
                show_id=show_id,
                version_label=version_label,
                file_path=blob_path,
                original_filename=file.filename,
                change_notes=change_notes or None,
                processing_status="pending",
            )
            session.add(version)
            session.flush()
            version_id = version.id
            session.commit()

        from slate.backend.ai import process_script
        background_tasks.add_task(process_script, session_factory, version_id)

        return {"id": version_id, "version_label": version_label}

    @router.get("/shows/{show_id}/scripts/{version_id}")
    def get_script(show_id: int, version_id: int, user: dict = Depends(get_current_user)):
        return interface.get_script(version_id)

    @router.put("/shows/{show_id}/scripts/{version_id}")
    def update_script(
        show_id: int, version_id: int, req: UpdateScriptVersionRequest,
        user: dict = Depends(get_current_user),
    ):
        with session_factory() as session:
            version = session.query(ScriptVersion).filter(
                ScriptVersion.id == version_id, ScriptVersion.show_id == show_id
            ).first()
            if not version:
                return {"error": "Script version not found"}

            updates = req.model_dump(exclude_unset=True)
            for field, value in updates.items():
                old_value = getattr(version, field)
                if old_value != value:
                    _log_change(session, "script_version", version_id, field, old_value, value, user["email"])
                    setattr(version, field, value)

            session.commit()
            return {"updated": True}

    @router.delete("/shows/{show_id}/scripts/{version_id}")
    def delete_script(show_id: int, version_id: int, user: dict = Depends(get_current_user)):
        with session_factory() as session:
            version = session.query(ScriptVersion).filter(
                ScriptVersion.id == version_id, ScriptVersion.show_id == show_id
            ).first()
            if not version:
                return {"error": "Script version not found"}
            # Delete from GCS
            try:
                delete_file(version.file_path)
            except Exception:
                logger.warning(f"Failed to delete GCS file: {version.file_path}")
            session.delete(version)
            session.commit()
            return {"deleted": True}

    @router.get("/shows/{show_id}/scripts/{version_id}/download")
    def download_script(show_id: int, version_id: int, user: dict = Depends(get_current_user)):
        with session_factory() as session:
            version = session.query(ScriptVersion).filter(
                ScriptVersion.id == version_id, ScriptVersion.show_id == show_id
            ).first()
            if not version:
                return {"error": "Script version not found"}
            url = get_signed_url(version.file_path, expiration_minutes=60)
            return {"url": url}

    # ==================== MUSIC FILES ====================

    @router.get("/shows/{show_id}/scripts/{version_id}/music")
    def list_music(show_id: int, version_id: int, user: dict = Depends(get_current_user)):
        with session_factory() as session:
            files = (
                session.query(MusicFile)
                .options(joinedload(MusicFile.track_type))
                .filter(MusicFile.script_version_id == version_id)
                .order_by(MusicFile.sort_order)
                .all()
            )
            return {
                "music_files": [
                    {
                        "id": f.id,
                        "track_name": f.track_name,
                        "track_type": _lookup_dict(f.track_type),
                        "description": f.description,
                        "original_filename": f.original_filename,
                        "sort_order": f.sort_order,
                        "processing_status": f.processing_status,
                        "created_at": f.created_at.isoformat(),
                    }
                    for f in files
                ]
            }

    @router.post("/shows/{show_id}/scripts/{version_id}/music")
    async def upload_music(
        show_id: int,
        version_id: int,
        background_tasks: BackgroundTasks,
        file: UploadFile = File(...),
        track_name: str = Form(...),
        track_type_id: int = Form(None),
        description: str = Form(""),
        user: dict = Depends(get_current_user),
    ):
        ext = _validate_extension(file.filename, MUSIC_EXTENSIONS)
        if not ext:
            return {"error": f"Unsupported file type. Allowed: {', '.join(MUSIC_EXTENSIONS)}"}

        data = await file.read()
        blob_path = f"slate/shows/{show_id}/music/{version_id}/{file.filename}"
        content_type = mimetypes.guess_type(file.filename)[0] or "audio/mpeg"
        upload_file(blob_path, data, content_type=content_type)

        with session_factory() as session:
            # Get next sort order
            max_order = session.query(MusicFile.sort_order).filter(
                MusicFile.script_version_id == version_id
            ).order_by(MusicFile.sort_order.desc()).first()
            next_order = (max_order[0] + 1) if max_order else 0

            music = MusicFile(
                script_version_id=version_id,
                file_path=blob_path,
                original_filename=file.filename,
                track_name=track_name,
                track_type_id=track_type_id if track_type_id else None,
                description=description or None,
                sort_order=next_order,
                processing_status="pending",
            )
            session.add(music)
            session.flush()
            music_id = music.id
            session.commit()

        from slate.backend.ai import process_music
        background_tasks.add_task(process_music, session_factory, music_id)

        return {"id": music_id, "track_name": track_name}

    @router.put("/shows/{show_id}/scripts/{version_id}/music/{music_id}")
    def update_music(
        show_id: int, version_id: int, music_id: int,
        req: UpdateMusicFileRequest, user: dict = Depends(get_current_user),
    ):
        with session_factory() as session:
            music = session.query(MusicFile).filter(
                MusicFile.id == music_id, MusicFile.script_version_id == version_id
            ).first()
            if not music:
                return {"error": "Music file not found"}

            updates = req.model_dump(exclude_unset=True)
            for field, value in updates.items():
                setattr(music, field, value)

            session.commit()
            return {"updated": True}

    @router.delete("/shows/{show_id}/scripts/{version_id}/music/{music_id}")
    def delete_music(
        show_id: int, version_id: int, music_id: int,
        user: dict = Depends(get_current_user),
    ):
        with session_factory() as session:
            music = session.query(MusicFile).filter(
                MusicFile.id == music_id, MusicFile.script_version_id == version_id
            ).first()
            if not music:
                return {"error": "Music file not found"}
            try:
                delete_file(music.file_path)
            except Exception:
                logger.warning(f"Failed to delete GCS file: {music.file_path}")
            session.delete(music)
            session.commit()
            return {"deleted": True}

    @router.get("/shows/{show_id}/scripts/{version_id}/music/{music_id}/download")
    def download_music(
        show_id: int, version_id: int, music_id: int,
        user: dict = Depends(get_current_user),
    ):
        with session_factory() as session:
            music = session.query(MusicFile).filter(
                MusicFile.id == music_id, MusicFile.script_version_id == version_id
            ).first()
            if not music:
                return {"error": "Music file not found"}
            url = get_signed_url(music.file_path, expiration_minutes=60)
            return {"url": url}

    @router.put("/shows/{show_id}/scripts/{version_id}/music/reorder")
    def reorder_music(
        show_id: int, version_id: int, req: dict,
        user: dict = Depends(get_current_user),
    ):
        ids = req.get("ids", [])
        with session_factory() as session:
            for i, music_id in enumerate(ids):
                session.query(MusicFile).filter(
                    MusicFile.id == music_id, MusicFile.script_version_id == version_id
                ).update({"sort_order": i})
            session.commit()
            return {"reordered": True}

    # ==================== MILESTONES ====================

    @router.get("/milestones/recent")
    def recent_milestones(
        limit: int = Query(10, ge=1, le=50),
        user: dict = Depends(get_current_user),
    ):
        with session_factory() as session:
            milestones = (
                session.query(DevelopmentMilestone)
                .options(
                    joinedload(DevelopmentMilestone.milestone_type),
                    joinedload(DevelopmentMilestone.show),
                )
                .order_by(DevelopmentMilestone.date.desc())
                .limit(limit)
                .all()
            )
            return {
                "milestones": [
                    {
                        "id": m.id,
                        "show_id": m.show_id,
                        "show_title": m.show.title if m.show else None,
                        "title": m.title,
                        "date": m.date.isoformat() if m.date else None,
                        "description": m.description,
                        "milestone_type": _lookup_dict(m.milestone_type),
                    }
                    for m in milestones
                ]
            }

    @router.get("/shows/{show_id}/milestones")
    def list_milestones(show_id: int, user: dict = Depends(get_current_user)):
        with session_factory() as session:
            milestones = (
                session.query(DevelopmentMilestone)
                .options(
                    joinedload(DevelopmentMilestone.milestone_type),
                    joinedload(DevelopmentMilestone.script_version),
                )
                .filter(DevelopmentMilestone.show_id == show_id)
                .order_by(DevelopmentMilestone.date.desc())
                .all()
            )
            return {
                "milestones": [
                    {
                        "id": m.id,
                        "title": m.title,
                        "date": m.date.isoformat() if m.date else None,
                        "description": m.description,
                        "milestone_type": _lookup_dict(m.milestone_type),
                        "script_version_id": m.script_version_id,
                        "script_version_label": m.script_version.version_label if m.script_version else None,
                        "created_at": m.created_at.isoformat(),
                    }
                    for m in milestones
                ]
            }

    @router.post("/shows/{show_id}/milestones")
    def create_milestone(show_id: int, req: CreateMilestoneRequest, user: dict = Depends(get_current_user)):
        with session_factory() as session:
            milestone = DevelopmentMilestone(
                show_id=show_id,
                title=req.title,
                date=datetime.fromisoformat(req.date).date(),
                description=req.description,
                milestone_type_id=req.milestone_type_id,
                script_version_id=req.script_version_id,
            )
            session.add(milestone)
            session.flush()
            milestone_id = milestone.id
            session.commit()
            return {"id": milestone_id, "title": req.title}

    @router.put("/shows/{show_id}/milestones/{milestone_id}")
    def update_milestone(
        show_id: int, milestone_id: int, req: UpdateMilestoneRequest,
        user: dict = Depends(get_current_user),
    ):
        with session_factory() as session:
            milestone = session.query(DevelopmentMilestone).filter(
                DevelopmentMilestone.id == milestone_id,
                DevelopmentMilestone.show_id == show_id,
            ).first()
            if not milestone:
                return {"error": "Milestone not found"}

            updates = req.model_dump(exclude_unset=True)
            for field, value in updates.items():
                if field == "date" and value:
                    value = datetime.fromisoformat(value).date()
                old_value = getattr(milestone, field)
                if old_value != value:
                    _log_change(session, "milestone", milestone_id, field, old_value, value, user["email"])
                    setattr(milestone, field, value)

            session.commit()
            return {"updated": True}

    @router.delete("/shows/{show_id}/milestones/{milestone_id}")
    def delete_milestone(show_id: int, milestone_id: int, user: dict = Depends(get_current_user)):
        with session_factory() as session:
            milestone = session.query(DevelopmentMilestone).filter(
                DevelopmentMilestone.id == milestone_id,
                DevelopmentMilestone.show_id == show_id,
            ).first()
            if not milestone:
                return {"error": "Milestone not found"}
            session.delete(milestone)
            session.commit()
            return {"deleted": True}

    # ==================== VISUAL IDENTITY ====================

    @router.get("/shows/{show_id}/visual")
    def list_visual_assets(show_id: int, user: dict = Depends(get_current_user)):
        with session_factory() as session:
            assets = (
                session.query(VisualAsset)
                .options(joinedload(VisualAsset.asset_type))
                .filter(VisualAsset.show_id == show_id)
                .order_by(VisualAsset.created_at.desc())
                .all()
            )
            return {
                "assets": [
                    {
                        "id": a.id,
                        "label": a.label,
                        "asset_type": _lookup_dict(a.asset_type),
                        "version": a.version,
                        "is_current": a.is_current,
                        "original_filename": a.original_filename,
                        "processing_status": a.processing_status,
                        "file_path": a.file_path,
                        "created_at": a.created_at.isoformat(),
                    }
                    for a in assets
                ]
            }

    @router.post("/shows/{show_id}/visual")
    async def upload_visual_asset(
        show_id: int,
        background_tasks: BackgroundTasks,
        file: UploadFile = File(...),
        label: str = Form(...),
        asset_type_id: int = Form(None),
        version: str = Form(""),
        user: dict = Depends(get_current_user),
    ):
        ext = _validate_extension(file.filename, VISUAL_EXTENSIONS)
        if not ext:
            return {"error": f"Unsupported file type. Allowed: {', '.join(VISUAL_EXTENSIONS)}"}

        data = await file.read()
        # Determine asset type value for path
        asset_type_folder = "other"
        if asset_type_id:
            with session_factory() as session:
                lv = session.get(SlateLookupValue, asset_type_id)
                if lv:
                    asset_type_folder = lv.value

        blob_path = f"slate/shows/{show_id}/visual/{asset_type_folder}/{file.filename}"
        content_type = mimetypes.guess_type(file.filename)[0] or "application/octet-stream"
        upload_file(blob_path, data, content_type=content_type)

        with session_factory() as session:
            asset = VisualAsset(
                show_id=show_id,
                file_path=blob_path,
                original_filename=file.filename,
                asset_type_id=asset_type_id if asset_type_id else None,
                label=label,
                version=version or None,
                is_current=True,
                processing_status="pending",
            )
            session.add(asset)
            session.flush()
            asset_id = asset.id
            session.commit()

        from slate.backend.ai import process_visual
        background_tasks.add_task(process_visual, session_factory, asset_id)

        return {"id": asset_id, "label": label}

    @router.put("/shows/{show_id}/visual/{asset_id}")
    def update_visual_asset(
        show_id: int, asset_id: int, req: UpdateVisualAssetRequest,
        user: dict = Depends(get_current_user),
    ):
        with session_factory() as session:
            asset = session.query(VisualAsset).filter(
                VisualAsset.id == asset_id, VisualAsset.show_id == show_id
            ).first()
            if not asset:
                return {"error": "Visual asset not found"}

            updates = req.model_dump(exclude_unset=True)
            for field, value in updates.items():
                setattr(asset, field, value)

            session.commit()
            return {"updated": True}

    @router.delete("/shows/{show_id}/visual/{asset_id}")
    def delete_visual_asset(show_id: int, asset_id: int, user: dict = Depends(get_current_user)):
        with session_factory() as session:
            asset = session.query(VisualAsset).filter(
                VisualAsset.id == asset_id, VisualAsset.show_id == show_id
            ).first()
            if not asset:
                return {"error": "Visual asset not found"}
            try:
                delete_file(asset.file_path)
            except Exception:
                logger.warning(f"Failed to delete GCS file: {asset.file_path}")
            session.delete(asset)
            session.commit()
            return {"deleted": True}

    @router.get("/shows/{show_id}/visual/{asset_id}/download")
    def download_visual_asset(show_id: int, asset_id: int, user: dict = Depends(get_current_user)):
        with session_factory() as session:
            asset = session.query(VisualAsset).filter(
                VisualAsset.id == asset_id, VisualAsset.show_id == show_id
            ).first()
            if not asset:
                return {"error": "Visual asset not found"}
            url = get_signed_url(asset.file_path, expiration_minutes=60)
            return {"url": url}

    # ==================== SHOW DATA ====================

    @router.get("/shows/{show_id}/data")
    def get_show_data(
        show_id: int,
        version_id: int = Query(None, description="Script version ID (default: latest)"),
        user: dict = Depends(get_current_user),
    ):
        with session_factory() as session:
            # If no version_id, find the latest script version for this show
            if version_id is None:
                latest = (
                    session.query(ScriptVersion)
                    .filter(ScriptVersion.show_id == show_id)
                    .order_by(ScriptVersion.created_at.desc())
                    .first()
                )
                version_id = latest.id if latest else None

            results = {}

            # Script version data
            if version_id is not None:
                script_data = (
                    session.query(ShowData)
                    .filter(
                        ShowData.show_id == show_id,
                        ShowData.source_type == "script_version",
                        ShowData.source_id == version_id,
                    )
                    .all()
                )
                results["script_version"] = [
                    {
                        "id": d.id,
                        "data_type": d.data_type,
                        "content": d.content,
                        "generated_at": d.generated_at.isoformat() if d.generated_at else None,
                        "model_used": d.model_used,
                        "source_type": d.source_type,
                        "source_id": d.source_id,
                    }
                    for d in script_data
                ]

            # Music file data
            music_data = (
                session.query(ShowData)
                .filter(
                    ShowData.show_id == show_id,
                    ShowData.source_type == "music_file",
                )
                .all()
            )
            results["music_file"] = [
                {
                    "id": d.id,
                    "data_type": d.data_type,
                    "content": d.content,
                    "generated_at": d.generated_at.isoformat() if d.generated_at else None,
                    "model_used": d.model_used,
                    "source_type": d.source_type,
                    "source_id": d.source_id,
                }
                for d in music_data
            ]

            # Visual asset data
            visual_data = (
                session.query(ShowData)
                .filter(
                    ShowData.show_id == show_id,
                    ShowData.source_type == "visual_asset",
                )
                .all()
            )
            results["visual_asset"] = [
                {
                    "id": d.id,
                    "data_type": d.data_type,
                    "content": d.content,
                    "generated_at": d.generated_at.isoformat() if d.generated_at else None,
                    "model_used": d.model_used,
                    "source_type": d.source_type,
                    "source_id": d.source_id,
                }
                for d in visual_data
            ]

            return results

    @router.get("/shows/{show_id}/data/{data_type}")
    def get_show_data_by_type(
        show_id: int,
        data_type: str,
        version_id: int = Query(None, description="Script version ID (default: latest)"),
        user: dict = Depends(get_current_user),
    ):
        with session_factory() as session:
            # If no version_id, find the latest script version for this show
            if version_id is None:
                latest = (
                    session.query(ScriptVersion)
                    .filter(ScriptVersion.show_id == show_id)
                    .order_by(ScriptVersion.created_at.desc())
                    .first()
                )
                version_id = latest.id if latest else None

            if version_id is None:
                return None

            data = (
                session.query(ShowData)
                .filter(
                    ShowData.show_id == show_id,
                    ShowData.source_type == "script_version",
                    ShowData.source_id == version_id,
                    ShowData.data_type == data_type,
                )
                .first()
            )
            if not data:
                return None

            return {
                "id": data.id,
                "data_type": data.data_type,
                "content": data.content,
                "generated_at": data.generated_at.isoformat() if data.generated_at else None,
                "model_used": data.model_used,
                "source_type": data.source_type,
                "source_id": data.source_id,
            }

    @router.post("/shows/{show_id}/data")
    def create_show_data(
        show_id: int,
        req: CreateShowDataRequest,
        user: dict = Depends(get_current_user),
    ):
        with session_factory() as session:
            data = ShowData(
                show_id=show_id,
                data_type=req.data_type,
                content=req.content,
                source_type=req.source_type,
                source_id=req.source_id,
            )
            session.add(data)
            session.flush()
            data_id = data.id
            session.commit()
            return {"id": data_id, "data_type": req.data_type}

    @router.put("/shows/{show_id}/data/{data_id}")
    def update_show_data(
        show_id: int,
        data_id: int,
        req: UpdateShowDataRequest,
        user: dict = Depends(get_current_user),
    ):
        with session_factory() as session:
            data = session.query(ShowData).filter(
                ShowData.id == data_id, ShowData.show_id == show_id
            ).first()
            if not data:
                return {"error": "Show data not found"}

            old_content = str(data.content)
            data.content = req.content
            _log_change(session, "show_data", data_id, "content", old_content, str(req.content), user["email"])

            session.commit()
            return {"updated": True}

    @router.delete("/shows/{show_id}/data/{data_id}")
    def delete_show_data(
        show_id: int,
        data_id: int,
        user: dict = Depends(get_current_user),
    ):
        with session_factory() as session:
            data = session.query(ShowData).filter(
                ShowData.id == data_id, ShowData.show_id == show_id
            ).first()
            if not data:
                return {"error": "Show data not found"}
            session.delete(data)
            session.commit()
            return {"deleted": True}

    # ==================== REPROCESSING ====================

    @router.post("/shows/{show_id}/scripts/{version_id}/reprocess")
    async def reprocess_script(
        show_id: int,
        version_id: int,
        background_tasks: BackgroundTasks,
        user: dict = Depends(get_current_user),
    ):
        from slate.backend.ai import process_script
        background_tasks.add_task(process_script, session_factory, version_id)
        return {"status": "processing", "version_id": version_id}

    @router.post("/shows/{show_id}/scripts/{version_id}/reprocess/{data_type}")
    async def reprocess_data_type(
        show_id: int,
        version_id: int,
        data_type: str,
        background_tasks: BackgroundTasks,
        user: dict = Depends(get_current_user),
    ):
        # Delete existing ShowData record for this type/version
        with session_factory() as session:
            session.query(ShowData).filter_by(
                show_id=show_id,
                source_type="script_version",
                source_id=version_id,
                data_type=data_type,
            ).delete()
            session.commit()

        from slate.backend.ai import _run_analysis, extract_script_content, SCRIPT_ANALYSIS_TYPES

        async def _reprocess_one():
            from slate.backend.ai import call_llm
            from slate.backend.models import SlateScriptVersion, SlateShow
            from shared.backend.storage.gcs import download_file as dl_file

            with session_factory() as session:
                version = session.query(ScriptVersion).get(version_id)
                if not version:
                    return
                file_path = version.file_path
                original_filename = version.original_filename

            with session_factory() as session:
                show = session.query(Show).get(show_id)
                if not show:
                    return
                medium_label = show.medium.display_label if show.medium else "Unknown"
                context = {
                    "title": show.title,
                    "medium": medium_label,
                    "genre": show.genre or "Not specified",
                    "script_text": "",
                }

            file_bytes = dl_file(file_path)
            text, file_parts = extract_script_content(original_filename, file_bytes)
            context["script_text"] = text or ""

            await _run_analysis(
                data_type, text, file_parts, context,
                show_id, version_id, session_factory,
            )

        background_tasks.add_task(_reprocess_one)
        return {"status": "processing", "version_id": version_id, "data_type": data_type}

    # ==================== MODEL OPTIONS ====================

    @router.get("/settings/models")
    def get_model_options(user: dict = Depends(get_current_user)):
        from slate.backend.ai import MODEL_OPTIONS
        return MODEL_OPTIONS

    # ==================== LOOKUP VALUES ====================

    @router.get("/lookup-values")
    def list_lookup_values(
        category: str = Query("", description="Filter by category"),
        entity_type: str = Query("", description="Filter by entity type"),
        user: dict = Depends(get_current_user),
    ):
        with session_factory() as session:
            query = session.query(SlateLookupValue)
            if category:
                query = query.filter(SlateLookupValue.category == category)
            if entity_type:
                query = query.filter(SlateLookupValue.entity_type == entity_type)
            values = query.order_by(SlateLookupValue.category, SlateLookupValue.sort_order).all()
            return {
                "lookup_values": [
                    {
                        "id": v.id,
                        "category": v.category,
                        "entity_type": v.entity_type,
                        "value": v.value,
                        "display_label": v.display_label,
                        "sort_order": v.sort_order,
                        "description": v.description,
                        "css_class": v.css_class,
                        "applies_to": v.applies_to,
                    }
                    for v in values
                ]
            }

    @router.post("/lookup-values")
    def create_lookup_value(req: CreateLookupValueRequest, user: dict = Depends(get_current_user)):
        with session_factory() as session:
            lv = SlateLookupValue(
                category=req.category,
                entity_type=req.entity_type,
                value=req.value,
                display_label=req.display_label,
                sort_order=req.sort_order,
                description=req.description,
                css_class=req.css_class,
            )
            session.add(lv)
            session.flush()
            lv_id = lv.id
            session.commit()
            return {"id": lv_id}

    @router.get("/lookup-values/{lv_id}")
    def get_lookup_value(lv_id: int, user: dict = Depends(get_current_user)):
        with session_factory() as session:
            lv = session.get(SlateLookupValue, lv_id)
            if not lv:
                return {"error": "Lookup value not found"}
            return {
                "id": lv.id,
                "category": lv.category,
                "entity_type": lv.entity_type,
                "value": lv.value,
                "display_label": lv.display_label,
                "sort_order": lv.sort_order,
                "description": lv.description,
                "css_class": lv.css_class,
            }

    @router.put("/lookup-values/{lv_id}")
    def update_lookup_value(lv_id: int, req: UpdateLookupValueRequest, user: dict = Depends(get_current_user)):
        with session_factory() as session:
            lv = session.get(SlateLookupValue, lv_id)
            if not lv:
                return {"error": "Lookup value not found"}

            updates = req.model_dump(exclude_unset=True)
            for field, value in updates.items():
                setattr(lv, field, value)

            session.commit()
            return {"updated": True}

    @router.put("/lookup-values/reorder")
    def reorder_lookup_values(req: ReorderLookupValuesRequest, user: dict = Depends(get_current_user)):
        with session_factory() as session:
            for i, lv_id in enumerate(req.ids):
                session.query(SlateLookupValue).filter(
                    SlateLookupValue.id == lv_id
                ).update({"sort_order": i})
            session.commit()
            return {"reordered": True}

    @router.delete("/lookup-values/{lv_id}")
    def delete_lookup_value(lv_id: int, user: dict = Depends(get_current_user)):
        with session_factory() as session:
            lv = session.get(SlateLookupValue, lv_id)
            if not lv:
                return {"error": "Lookup value not found"}

            # Check if referenced by any entity
            from sqlalchemy import or_
            refs = (
                session.query(Show).filter(
                    or_(Show.medium_id == lv_id, Show.rights_status_id == lv_id, Show.development_stage_id == lv_id)
                ).count()
                + session.query(MusicFile).filter(MusicFile.track_type_id == lv_id).count()
                + session.query(DevelopmentMilestone).filter(DevelopmentMilestone.milestone_type_id == lv_id).count()
                + session.query(VisualAsset).filter(VisualAsset.asset_type_id == lv_id).count()
            )
            if refs > 0:
                return {"error": "Cannot delete: this value is referenced by existing records"}

            session.delete(lv)
            session.commit()
            return {"deleted": True}

    # ==================== SETTINGS ====================

    @router.get("/settings")
    def get_settings(user: dict = Depends(get_current_user)):
        with session_factory() as session:
            settings = session.query(SlateSettings).all()
            return {s.key: s.value for s in settings}

    @router.put("/settings")
    def update_settings(req: UpdateSettingsRequest, user: dict = Depends(get_current_user)):
        with session_factory() as session:
            for key, value in req.settings.items():
                existing = session.query(SlateSettings).filter(SlateSettings.key == key).first()
                if existing:
                    existing.value = value
                else:
                    session.add(SlateSettings(key=key, value=value))
            session.commit()
            return {"updated": True}

    # ==================== AI BEHAVIORS ====================

    @router.get("/settings/ai-behaviors")
    def get_ai_behaviors(user: dict = Depends(get_current_user)):
        with session_factory() as session:
            behaviors = session.query(SlateAIBehavior).order_by(SlateAIBehavior.name).all()
            return [
                {
                    "id": b.id,
                    "name": b.name,
                    "display_label": b.display_label,
                    "system_prompt": b.system_prompt,
                    "user_prompt": b.user_prompt,
                    "model": b.model,
                    "updated_at": b.updated_at.isoformat() if b.updated_at else None,
                }
                for b in behaviors
            ]

    @router.put("/settings/ai-behaviors/{behavior_id}")
    def update_ai_behavior(behavior_id: int, req: dict, user: dict = Depends(get_current_user)):
        with session_factory() as session:
            behavior = session.get(SlateAIBehavior, behavior_id)
            if not behavior:
                return {"error": "AI behavior not found"}
            if "system_prompt" in req:
                behavior.system_prompt = req["system_prompt"]
            if "user_prompt" in req:
                behavior.user_prompt = req["user_prompt"]
            if "model" in req:
                behavior.model = req["model"]
            session.commit()
            return {"updated": True}

    # ==================== PITCHES ====================

    @router.get("/shows/{show_id}/pitches")
    def list_pitches(show_id: int, user: dict = Depends(get_current_user)):
        with session_factory() as session:
            pitches = (
                session.query(Pitch)
                .options(
                    joinedload(Pitch.audience_type),
                    joinedload(Pitch.status),
                )
                .filter(Pitch.show_id == show_id)
                .order_by(Pitch.created_at.desc())
                .all()
            )
            return {
                "pitches": [
                    {
                        "id": p.id,
                        "title": p.title,
                        "audience_type": _lookup_dict(p.audience_type),
                        "status": _lookup_dict(p.status),
                        "target_producer_id": p.target_producer_id,
                        "generated_by": p.generated_by,
                        "created_at": p.created_at.isoformat() if p.created_at else None,
                        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
                    }
                    for p in pitches
                ]
            }

    @router.post("/shows/{show_id}/pitches")
    def create_pitch(show_id: int, req: CreatePitchRequest, user: dict = Depends(get_current_user)):
        with session_factory() as session:
            # Resolve draft status
            draft_lv = (
                session.query(SlateLookupValue)
                .filter_by(category="pitch_status", entity_type="pitch", value="draft")
                .first()
            )
            pitch = Pitch(
                show_id=show_id,
                title=req.title,
                audience_type_id=req.audience_type_id,
                content=req.content,
                status_id=draft_lv.id if draft_lv else None,
                generated_by="manual",
            )
            session.add(pitch)
            session.flush()
            pitch_id = pitch.id
            session.commit()
            return {"id": pitch_id, "title": req.title}

    @router.post("/shows/{show_id}/pitches/generate")
    async def generate_pitch_route(
        show_id: int,
        req: GeneratePitchRequest,
        background_tasks: BackgroundTasks,
        user: dict = Depends(get_current_user),
    ):
        from slate.backend.ai import generate_pitch

        async def _run_generate():
            try:
                await generate_pitch(
                    session_factory, show_id, req.audience_type, req.target_producer_id
                )
            except Exception as e:
                logger.error(f"Pitch generation failed for show {show_id}: {e}")

        background_tasks.add_task(_run_generate)
        return {
            "status": "generating",
            "show_id": show_id,
            "audience_type": req.audience_type,
        }

    @router.get("/shows/{show_id}/pitches/{pitch_id}")
    def get_pitch(show_id: int, pitch_id: int, user: dict = Depends(get_current_user)):
        with session_factory() as session:
            pitch = (
                session.query(Pitch)
                .options(
                    joinedload(Pitch.audience_type),
                    joinedload(Pitch.status),
                    joinedload(Pitch.materials).joinedload(PitchMaterial.material_type),
                )
                .filter(Pitch.id == pitch_id, Pitch.show_id == show_id)
                .first()
            )
            if not pitch:
                return {"error": "Pitch not found"}

            return {
                "id": pitch.id,
                "show_id": pitch.show_id,
                "title": pitch.title,
                "content": pitch.content,
                "audience_type": _lookup_dict(pitch.audience_type),
                "status": _lookup_dict(pitch.status),
                "target_producer_id": pitch.target_producer_id,
                "generated_by": pitch.generated_by,
                "materials": [
                    {
                        "id": m.id,
                        "label": m.label,
                        "material_type": _lookup_dict(m.material_type),
                        "original_filename": m.original_filename,
                        "created_at": m.created_at.isoformat() if m.created_at else None,
                    }
                    for m in pitch.materials
                ],
                "created_at": pitch.created_at.isoformat() if pitch.created_at else None,
                "updated_at": pitch.updated_at.isoformat() if pitch.updated_at else None,
            }

    @router.put("/shows/{show_id}/pitches/{pitch_id}")
    def update_pitch(
        show_id: int, pitch_id: int, req: UpdatePitchRequest,
        user: dict = Depends(get_current_user),
    ):
        with session_factory() as session:
            pitch = session.query(Pitch).filter(
                Pitch.id == pitch_id, Pitch.show_id == show_id
            ).first()
            if not pitch:
                return {"error": "Pitch not found"}

            updates = req.model_dump(exclude_unset=True)
            for field, value in updates.items():
                old_value = getattr(pitch, field)
                if old_value != value:
                    _log_change(session, "pitch", pitch_id, field, old_value, value, user["email"])
                    setattr(pitch, field, value)

            session.commit()
            return {"updated": True}

    @router.delete("/shows/{show_id}/pitches/{pitch_id}")
    def delete_pitch(show_id: int, pitch_id: int, user: dict = Depends(get_current_user)):
        with session_factory() as session:
            pitch = session.query(Pitch).filter(
                Pitch.id == pitch_id, Pitch.show_id == show_id
            ).first()
            if not pitch:
                return {"error": "Pitch not found"}
            # Delete associated GCS files for materials
            for mat in pitch.materials:
                try:
                    delete_file(mat.file_path)
                except Exception:
                    logger.warning(f"Failed to delete GCS file: {mat.file_path}")
            session.delete(pitch)
            session.commit()
            return {"deleted": True}

    # ==================== PITCH MATERIALS ====================

    @router.get("/shows/{show_id}/pitches/{pitch_id}/materials")
    def list_pitch_materials(
        show_id: int, pitch_id: int, user: dict = Depends(get_current_user),
    ):
        with session_factory() as session:
            materials = (
                session.query(PitchMaterial)
                .options(joinedload(PitchMaterial.material_type))
                .filter(PitchMaterial.pitch_id == pitch_id)
                .order_by(PitchMaterial.created_at.desc())
                .all()
            )
            return {
                "materials": [
                    {
                        "id": m.id,
                        "label": m.label,
                        "material_type": _lookup_dict(m.material_type),
                        "original_filename": m.original_filename,
                        "created_at": m.created_at.isoformat() if m.created_at else None,
                    }
                    for m in materials
                ]
            }

    @router.post("/shows/{show_id}/pitches/{pitch_id}/materials")
    async def upload_pitch_material(
        show_id: int,
        pitch_id: int,
        file: UploadFile = File(...),
        label: str = Form(...),
        material_type_id: int = Form(None),
        user: dict = Depends(get_current_user),
    ):
        ext = _validate_extension(file.filename, PITCH_MATERIAL_EXTENSIONS)
        if not ext:
            return {"error": f"Unsupported file type. Allowed: {', '.join(PITCH_MATERIAL_EXTENSIONS)}"}

        data = await file.read()
        blob_path = f"slate/shows/{show_id}/pitches/{pitch_id}/{file.filename}"
        content_type = mimetypes.guess_type(file.filename)[0] or "application/octet-stream"
        upload_file(blob_path, data, content_type=content_type)

        with session_factory() as session:
            material = PitchMaterial(
                pitch_id=pitch_id,
                file_path=blob_path,
                original_filename=file.filename,
                material_type_id=material_type_id if material_type_id else None,
                label=label,
            )
            session.add(material)
            session.flush()
            material_id = material.id
            session.commit()

        return {"id": material_id, "label": label}

    @router.delete("/shows/{show_id}/pitches/{pitch_id}/materials/{material_id}")
    def delete_pitch_material(
        show_id: int, pitch_id: int, material_id: int,
        user: dict = Depends(get_current_user),
    ):
        with session_factory() as session:
            material = session.query(PitchMaterial).filter(
                PitchMaterial.id == material_id,
                PitchMaterial.pitch_id == pitch_id,
            ).first()
            if not material:
                return {"error": "Pitch material not found"}
            try:
                delete_file(material.file_path)
            except Exception:
                logger.warning(f"Failed to delete GCS file: {material.file_path}")
            session.delete(material)
            session.commit()
            return {"deleted": True}

    @router.get("/shows/{show_id}/pitches/{pitch_id}/materials/{material_id}/download")
    def download_pitch_material(
        show_id: int, pitch_id: int, material_id: int,
        user: dict = Depends(get_current_user),
    ):
        with session_factory() as session:
            material = session.query(PitchMaterial).filter(
                PitchMaterial.id == material_id,
                PitchMaterial.pitch_id == pitch_id,
            ).first()
            if not material:
                return {"error": "Pitch material not found"}
            url = get_signed_url(material.file_path, expiration_minutes=60)
            return {"url": url}

    # ==================== AI QUERY ====================

    @router.post("/shows/{show_id}/query")
    async def show_query(show_id: int, req: QueryRequest, user: dict = Depends(get_current_user)):
        from slate.backend.ai import run_show_query
        result = await run_show_query(session_factory, show_id, req.query)
        return {"response": result}

    @router.post("/query")
    async def slate_query(req: QueryRequest, user: dict = Depends(get_current_user)):
        from slate.backend.ai import run_slate_query
        result = await run_slate_query(session_factory, req.query)
        return {"response": result}

    return router
