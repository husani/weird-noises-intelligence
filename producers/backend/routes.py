"""
Producers API routes.

All endpoints under /api/producers/*. Each route delegates to the interface
for business logic and to the AI module for async processing.
"""

import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Query, UploadFile
from fastmcp import FastMCP
from pydantic import BaseModel

from shared.backend.auth.dependencies import get_current_user

logger = logging.getLogger(__name__)


# --- Request models ---

class CreateProducerRequest(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    state_region: Optional[str] = None
    country: Optional[str] = None
    website: Optional[str] = None
    organization: Optional[str] = None
    org_role: Optional[str] = None
    intake_source: Optional[str] = "manual"
    intake_source_url: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[list[str]] = []


class UpdateProducerRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    state_region: Optional[str] = None
    country: Optional[str] = None
    photo_url: Optional[str] = None
    website: Optional[str] = None
    birthdate: Optional[str] = None
    pronouns: Optional[str] = None
    nickname: Optional[str] = None
    college: Optional[str] = None
    hometown: Optional[str] = None
    hometown_state: Optional[str] = None
    hometown_country: Optional[str] = None
    spouse_partner: Optional[str] = None
    languages: Optional[str] = None
    seasonal_location: Optional[str] = None


class AddInteractionRequest(BaseModel):
    content: str


class AddTagRequest(BaseModel):
    tag: str


class ReviewDiscoveryRequest(BaseModel):
    action: str  # "confirmed" or "dismissed"
    reason: Optional[str] = None  # dismissal reason
    edited_data: Optional[dict] = None  # curated fields from review UI


class TriggerDiscoveryRequest(BaseModel):
    focus: Optional[str] = None  # ad-hoc focus area


class CreateFocusAreaRequest(BaseModel):
    name: str
    description: Optional[str] = None


class UpdateSettingRequest(BaseModel):
    key: str
    value: dict | list | str | int | float | bool


class CreateSourceRequest(BaseModel):
    name: str
    url: Optional[str] = ""
    description: Optional[str] = None


class UpdateSourceRequest(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None


class CreateTagRequest(BaseModel):
    name: str
    description: Optional[str] = None


class UpdateTagRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ImportRequest(BaseModel):
    rows: list[dict]


class AIQueryRequest(BaseModel):
    query: str


class DuplicateCheckRequest(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = ""
    organization: Optional[str] = ""


class CreateOrganizationRequest(BaseModel):
    name: str
    org_type_id: Optional[int] = None
    website: Optional[str] = None
    city: Optional[str] = None
    state_region: Optional[str] = None
    country: Optional[str] = None
    description: Optional[str] = None


class UpdateOrganizationRequest(BaseModel):
    name: Optional[str] = None
    org_type_id: Optional[int] = None
    website: Optional[str] = None
    city: Optional[str] = None
    state_region: Optional[str] = None
    country: Optional[str] = None
    description: Optional[str] = None


class CreateSocialPlatformRequest(BaseModel):
    name: str
    base_url: Optional[str] = None
    icon_svg: Optional[str] = None
    description: Optional[str] = None

class UpdateSocialPlatformRequest(BaseModel):
    name: Optional[str] = None
    base_url: Optional[str] = None
    icon_svg: Optional[str] = None
    description: Optional[str] = None


class CreateLookupValueRequest(BaseModel):
    category: str
    entity_type: str
    value: str
    display_label: str
    description: Optional[str] = None
    css_class: Optional[str] = None
    sort_order: Optional[int] = 0


class UpdateLookupValueRequest(BaseModel):
    value: Optional[str] = None
    display_label: Optional[str] = None
    description: Optional[str] = None
    css_class: Optional[str] = None
    sort_order: Optional[int] = None


class ReorderLookupValuesRequest(BaseModel):
    category: str
    entity_type: str
    ordered_ids: list[int]


class AddAffiliationRequest(BaseModel):
    organization_id: Optional[int] = None
    organization_name: Optional[str] = None
    role_title: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    notes: Optional[str] = None


class UpdateAffiliationRequest(BaseModel):
    role_title: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    notes: Optional[str] = None


class CreateShowRequest(BaseModel):
    title: str
    medium_id: Optional[int] = None
    original_year: Optional[int] = None
    description: Optional[str] = None
    genre: Optional[str] = None
    themes: Optional[str] = None
    summary: Optional[str] = None
    plot_synopsis: Optional[str] = None
    work_origin_id: Optional[int] = None


class UpdateShowRequest(BaseModel):
    title: Optional[str] = None
    medium_id: Optional[int] = None
    original_year: Optional[int] = None
    description: Optional[str] = None
    genre: Optional[str] = None
    themes: Optional[str] = None
    summary: Optional[str] = None
    plot_synopsis: Optional[str] = None
    work_origin_id: Optional[int] = None


class AddProducerShowRequest(BaseModel):
    producer_id: int
    role_id: Optional[int] = None


class CreateProductionRequest(BaseModel):
    show_id: int
    venue_id: Optional[int] = None
    venue_name: Optional[str] = None
    venue_type_id: Optional[int] = None
    year: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    scale_id: Optional[int] = None
    run_length: Optional[str] = None
    description: Optional[str] = None
    producer_id: Optional[int] = None
    producer_role_id: Optional[int] = None
    production_type_id: Optional[int] = None
    capitalization: Optional[int] = None
    budget_tier_id: Optional[int] = None
    recouped: Optional[bool] = None
    funding_type_id: Optional[int] = None


class UpdateProductionRequest(BaseModel):
    venue_id: Optional[int] = None
    year: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    scale_id: Optional[int] = None
    run_length: Optional[str] = None
    description: Optional[str] = None
    production_type_id: Optional[int] = None
    capitalization: Optional[int] = None
    budget_tier_id: Optional[int] = None
    recouped: Optional[bool] = None
    funding_type_id: Optional[int] = None


class AddProducerToProductionRequest(BaseModel):
    producer_id: int
    role_id: Optional[int] = None


class CreateVenueRequest(BaseModel):
    name: str
    venue_type_id: Optional[int] = None
    city: Optional[str] = None
    state_region: Optional[str] = None
    country: Optional[str] = None
    capacity: Optional[int] = None
    description: Optional[str] = None


class UpdateVenueRequest(BaseModel):
    name: Optional[str] = None
    venue_type_id: Optional[int] = None
    city: Optional[str] = None
    state_region: Optional[str] = None
    country: Optional[str] = None
    capacity: Optional[int] = None
    description: Optional[str] = None


class CreateAwardRequest(BaseModel):
    producer_id: int
    production_id: Optional[int] = None
    award_name: str
    category: Optional[str] = None
    year: Optional[int] = None
    outcome_id: Optional[int] = None


class UpdateAwardRequest(BaseModel):
    award_name: Optional[str] = None
    category: Optional[str] = None
    year: Optional[int] = None
    outcome_id: Optional[int] = None


class UpdateInteractionRequest(BaseModel):
    content: str


class UpdateFollowUpRequest(BaseModel):
    implied_action: Optional[str] = None
    timeframe: Optional[str] = None
    due_date: Optional[str] = None


class MergeTagsRequest(BaseModel):
    source_tag_id: int
    target_tag_id: int


class BatchActionRequest(BaseModel):
    producer_ids: list[int]


class BatchTagRequest(BaseModel):
    producer_ids: list[int]
    tag: str


class AddEmailRequest(BaseModel):
    email: str
    type_id: Optional[int] = None
    source: Optional[str] = None
    confidence: Optional[str] = None
    is_primary: Optional[bool] = False


class AddSocialLinkRequest(BaseModel):
    platform_id: int
    url: str


class CreateTraitRequest(BaseModel):
    category_id: int
    value: str
    confidence: Optional[int] = None

class UpdateTraitRequest(BaseModel):
    category_id: Optional[int] = None
    value: Optional[str] = None
    confidence: Optional[int] = None

class CreateIntelRequest(BaseModel):
    category_id: int
    observation: str
    confidence: Optional[int] = None
    source_url: Optional[str] = None

class UpdateIntelRequest(BaseModel):
    category_id: Optional[int] = None
    observation: Optional[str] = None
    confidence: Optional[int] = None
    source_url: Optional[str] = None


def create_producers_router(interface, mcp_server: FastMCP, session_factory) -> APIRouter:
    """Create the producers API router."""

    router = APIRouter(prefix="/api/producers", tags=["producers"])

    # --- Producer CRUD ---

    @router.get("")
    def list_producers(
        search: str = Query("", description="Search by name or email"),
        state: str = Query("", description="Filter by relationship state"),
        tag: str = Query("", description="Filter by tag"),
        sort: str = Query("name", description="Sort field: name, updated, last_contact, organization, city"),
        sort_dir: str = Query("asc", description="Sort direction: asc or desc"),
        limit: int = Query(50, ge=1, le=200),
        offset: int = Query(0, ge=0),
        user: dict = Depends(get_current_user),
    ):
        return interface.list_producers(search=search, state_filter=state,
                                        tag_filter=tag, sort=sort, sort_dir=sort_dir,
                                        limit=limit, offset=offset)

    @router.post("")
    def create_producer(
        req: CreateProducerRequest,
        background_tasks: BackgroundTasks,
        user: dict = Depends(get_current_user),
    ):
        result = interface.create_producer(req.model_dump(), user["email"])
        # Kick off async research
        background_tasks.add_task(_run_research, session_factory, result["id"])
        return result

    @router.get("/dashboard")
    def dashboard(user: dict = Depends(get_current_user)):
        return interface.get_dashboard_data()

    @router.get("/tags")
    def list_tags(user: dict = Depends(get_current_user)):
        return interface.get_tags()

    @router.post("/tags")
    def create_tag(req: CreateTagRequest, user: dict = Depends(get_current_user)):
        return interface.create_tag(req.name, req.description)

    @router.get("/tags/{tag_id}")
    def get_tag(tag_id: int,
                search: str = Query("", description="Search producers by name or email"),
                sort: str = Query("name", description="Sort field"),
                sort_dir: str = Query("asc", description="Sort direction"),
                limit: int = Query(25, ge=1, le=200),
                offset: int = Query(0, ge=0),
                user: dict = Depends(get_current_user)):
        return interface.get_tag(tag_id, search=search, sort=sort,
                                 sort_dir=sort_dir, limit=limit, offset=offset)

    @router.put("/tags/{tag_id}")
    def update_tag(tag_id: int, req: UpdateTagRequest,
                   user: dict = Depends(get_current_user)):
        return interface.update_tag(tag_id, req.model_dump(exclude_unset=True))

    @router.delete("/tags/{tag_id}")
    def delete_tag(tag_id: int, user: dict = Depends(get_current_user)):
        return interface.delete_tag(tag_id)

    @router.post("/extract-url")
    async def extract_url(req: dict, user: dict = Depends(get_current_user)):
        """Extract producer identity from a URL using AI."""
        url = req.get("url", "")
        if not url:
            return {"error": "URL is required"}
        from producers.backend.ai import extract_from_url
        return await extract_from_url(url)

    @router.post("/check-duplicates")
    def check_duplicates(req: DuplicateCheckRequest,
                         user: dict = Depends(get_current_user)):
        return interface.check_duplicates(req.first_name, req.last_name, req.email or "", req.organization or "")

    @router.post("/import")
    def import_spreadsheet(
        req: ImportRequest,
        background_tasks: BackgroundTasks,
        user: dict = Depends(get_current_user),
    ):
        result = interface.import_spreadsheet(req.rows, user["email"])
        # Kick off research for all created producers
        for created in result["created"]:
            background_tasks.add_task(_run_research, session_factory, created["id"])
        return result

    @router.post("/query")
    async def ai_query(req: AIQueryRequest, user: dict = Depends(get_current_user)):
        from producers.backend.ai import run_ai_query
        with session_factory() as session:
            return {"result": await run_ai_query(session, req.query)}

    # --- Discovery ---

    @router.get("/discovery")
    def list_discovery(status: str = Query("pending"),
                       user: dict = Depends(get_current_user)):
        return interface.get_discovery_candidates(status)

    @router.get("/discovery/schedule")
    def discovery_schedule(user: dict = Depends(get_current_user)):
        from shared.backend.scheduler import scheduler
        job = scheduler.get_job("producers_ai_discovery")
        if job and job.next_run_time:
            return {"next_run": job.next_run_time.isoformat()}
        return {"next_run": None}

    @router.post("/discovery/trigger")
    def trigger_discovery(
        req: TriggerDiscoveryRequest = None,
        background_tasks: BackgroundTasks = None,
        user: dict = Depends(get_current_user),
    ):
        from producers.backend.jobs import ai_discovery
        focus = req.focus if req else None
        background_tasks.add_task(ai_discovery, session_factory, focus)
        return {"triggered": True}

    @router.post("/discovery/{candidate_id}/review")
    def review_discovery(
        candidate_id: int,
        req: ReviewDiscoveryRequest,
        background_tasks: BackgroundTasks,
        user: dict = Depends(get_current_user),
    ):
        result = interface.review_discovery(
            candidate_id, req.action, user["email"],
            reason=req.reason, edited_data=req.edited_data,
        )
        if result.get("producer_id"):
            background_tasks.add_task(_run_research, session_factory, result["producer_id"])
        return result

    # --- Discovery: scan history ---

    @router.get("/discovery/scans")
    def scan_history(limit: int = Query(25), offset: int = Query(0),
                     user: dict = Depends(get_current_user)):
        return interface.get_scan_history(limit, offset)

    @router.get("/discovery/scans/{scan_id}")
    def scan_detail(scan_id: int, user: dict = Depends(get_current_user)):
        result = interface.get_scan_detail(scan_id)
        if not result:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Scan not found")
        return result

    # --- Discovery: focus areas ---

    @router.get("/discovery/focus-areas")
    def list_focus_areas(user: dict = Depends(get_current_user)):
        return interface.get_focus_areas()

    @router.post("/discovery/focus-areas")
    def create_focus_area(req: CreateFocusAreaRequest,
                          user: dict = Depends(get_current_user)):
        return interface.create_focus_area(req.name, req.description)

    @router.put("/discovery/focus-areas/{focus_id}")
    def update_focus_area(focus_id: int, data: dict,
                          user: dict = Depends(get_current_user)):
        return interface.update_focus_area(focus_id, data)

    @router.delete("/discovery/focus-areas/{focus_id}")
    def delete_focus_area(focus_id: int,
                          user: dict = Depends(get_current_user)):
        return interface.delete_focus_area(focus_id)

    # --- Discovery: intelligence profile & calibration ---

    @router.get("/discovery/profile")
    def get_profile(user: dict = Depends(get_current_user)):
        return interface.get_intelligence_profile() or {"profile_text": None}

    @router.post("/discovery/regenerate-profile")
    def regenerate_profile(background_tasks: BackgroundTasks,
                           user: dict = Depends(get_current_user)):
        from producers.backend.jobs import refresh_intelligence_profile
        background_tasks.add_task(refresh_intelligence_profile, session_factory)
        return {"triggered": True}

    @router.get("/discovery/calibration")
    def get_calibration(user: dict = Depends(get_current_user)):
        return interface.get_calibration_summary() or {"calibration_text": None}

    @router.post("/discovery/regenerate-calibration")
    def regenerate_calibration(background_tasks: BackgroundTasks,
                               user: dict = Depends(get_current_user)):
        import asyncio
        from producers.backend.ai import generate_calibration_summary
        def _regen(sf):
            with sf() as session:
                asyncio.run(generate_calibration_summary(session))
        background_tasks.add_task(_regen, session_factory)
        return {"triggered": True}

    # --- Settings ---

    @router.get("/settings")
    def get_settings(user: dict = Depends(get_current_user)):
        return interface.get_settings()

    @router.put("/settings")
    def update_setting(req: UpdateSettingRequest,
                       user: dict = Depends(get_current_user)):
        return interface.update_setting(req.key, req.value)

    @router.get("/settings/ai-behaviors")
    def get_ai_behaviors(user: dict = Depends(get_current_user)):
        """Get all AI behavior configurations from the ai_behaviors table."""
        from producers.backend.models import AIBehavior
        with session_factory() as session:
            behaviors = session.query(AIBehavior).order_by(AIBehavior.name).all()
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
        """Update an AI behavior's prompts or model."""
        from producers.backend.models import AIBehavior
        with session_factory() as session:
            behavior = session.get(AIBehavior, behavior_id)
            if not behavior:
                from fastapi import HTTPException
                raise HTTPException(status_code=404, detail="Behavior not found")
            for field in ("system_prompt", "user_prompt", "model"):
                if field in req:
                    setattr(behavior, field, req[field])
            session.commit()
            return {
                "id": behavior.id,
                "name": behavior.name,
                "display_label": behavior.display_label,
                "system_prompt": behavior.system_prompt,
                "user_prompt": behavior.user_prompt,
                "model": behavior.model,
                "updated_at": behavior.updated_at.isoformat() if behavior.updated_at else None,
            }

    # --- Batch operations ---

    @router.post("/batch/refresh")
    def batch_refresh(
        req: BatchActionRequest,
        background_tasks: BackgroundTasks,
        user: dict = Depends(get_current_user),
    ):
        for pid in req.producer_ids:
            background_tasks.add_task(_run_research, session_factory, pid, is_refresh=True)
        return {"triggered": True, "count": len(req.producer_ids)}

    @router.post("/batch/tag")
    def batch_add_tag(req: BatchTagRequest, user: dict = Depends(get_current_user)):
        return interface.batch_add_tag(req.producer_ids, req.tag, user["email"])

    @router.delete("/batch/tag")
    def batch_remove_tag(req: BatchTagRequest, user: dict = Depends(get_current_user)):
        return interface.batch_remove_tag(req.producer_ids, req.tag, user["email"])

    # --- Tag merge ---

    @router.post("/tags/merge")
    def merge_tags(req: MergeTagsRequest, user: dict = Depends(get_current_user)):
        return interface.merge_tags(req.source_tag_id, req.target_tag_id)

    # --- Lookup Values ---

    @router.get("/lookup-values")
    def get_lookup_values(
        category: str = Query(None, description="Lookup category"),
        entity_type: str = Query(None, description="Entity type"),
        user: dict = Depends(get_current_user),
    ):
        if category and entity_type:
            return interface.get_lookup_values(category, entity_type)
        return interface.get_all_lookup_values()

    @router.get("/lookup-values/{lv_id}")
    def get_lookup_value(lv_id: int, user: dict = Depends(get_current_user)):
        result = interface.get_lookup_value(lv_id)
        if not result:
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=404, content={"detail": f"Lookup value {lv_id} not found"})
        return result

    @router.post("/lookup-values")
    def create_lookup_value(req: CreateLookupValueRequest, user: dict = Depends(get_current_user)):
        return interface.create_lookup_value(req.model_dump())

    @router.put("/lookup-values/reorder")
    def reorder_lookup_values(req: ReorderLookupValuesRequest, user: dict = Depends(get_current_user)):
        return interface.reorder_lookup_values(req.category, req.entity_type, req.ordered_ids)

    @router.put("/lookup-values/{lv_id}")
    def update_lookup_value(lv_id: int, req: UpdateLookupValueRequest, user: dict = Depends(get_current_user)):
        data = {k: v for k, v in req.model_dump().items() if v is not None}
        return interface.update_lookup_value(lv_id, data)

    @router.delete("/lookup-values/{lv_id}")
    def delete_lookup_value(lv_id: int, user: dict = Depends(get_current_user)):
        try:
            return interface.delete_lookup_value(lv_id)
        except ValueError as e:
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=409, content={"detail": str(e)})

    # --- Social Platforms ---

    @router.get("/social-platforms")
    def list_social_platforms(user: dict = Depends(get_current_user)):
        return interface.list_social_platforms()

    @router.post("/social-platforms")
    def create_social_platform(req: CreateSocialPlatformRequest,
                                user: dict = Depends(get_current_user)):
        return interface.create_social_platform(req.model_dump())

    @router.get("/social-platforms/{platform_id}")
    def get_social_platform(platform_id: int, user: dict = Depends(get_current_user)):
        return interface.get_social_platform(platform_id)

    @router.put("/social-platforms/{platform_id}")
    def update_social_platform(platform_id: int, req: UpdateSocialPlatformRequest,
                                user: dict = Depends(get_current_user)):
        return interface.update_social_platform(platform_id, req.model_dump(exclude_unset=True))

    @router.delete("/social-platforms/{platform_id}")
    def delete_social_platform(platform_id: int, user: dict = Depends(get_current_user)):
        return interface.delete_social_platform(platform_id)

    @router.post("/social-platforms/{platform_id}/producers")
    def add_platform_producer(platform_id: int, req: dict,
                               user: dict = Depends(get_current_user)):
        return interface.add_social_link("producer", req["producer_id"], platform_id, req.get("url", ""))

    @router.delete("/social-platforms/{platform_id}/producers/{producer_id}")
    def remove_platform_producer(platform_id: int, producer_id: int,
                                  user: dict = Depends(get_current_user)):
        return interface.remove_social_link("producer", producer_id, platform_id)

    @router.post("/social-platforms/{platform_id}/organizations")
    def add_platform_org(platform_id: int, req: dict,
                          user: dict = Depends(get_current_user)):
        return interface.add_social_link("organization", req["organization_id"], platform_id, req.get("url", ""))

    @router.delete("/social-platforms/{platform_id}/organizations/{org_id}")
    def remove_platform_org(platform_id: int, org_id: int,
                             user: dict = Depends(get_current_user)):
        return interface.remove_social_link("organization", org_id, platform_id)

    @router.post("/social-platforms/{platform_id}/venues")
    def add_platform_venue(platform_id: int, req: dict,
                            user: dict = Depends(get_current_user)):
        return interface.add_social_link("venue", req["venue_id"], platform_id, req.get("url", ""))

    @router.delete("/social-platforms/{platform_id}/venues/{venue_id}")
    def remove_platform_venue(platform_id: int, venue_id: int,
                               user: dict = Depends(get_current_user)):
        return interface.remove_social_link("venue", venue_id, platform_id)

    @router.put("/social-platforms/{platform_id}/link")
    def update_platform_link(platform_id: int, req: dict,
                              user: dict = Depends(get_current_user)):
        return interface.update_social_link(
            req["entity_type"], req["entity_id"], platform_id, req["url"]
        )

    # --- Organizations ---

    @router.get("/organizations")
    def list_organizations(
        search: str = Query(""),
        limit: int = Query(50, ge=1, le=200),
        offset: int = Query(0, ge=0),
        user: dict = Depends(get_current_user),
    ):
        return interface.list_organizations(search=search, limit=limit, offset=offset)

    @router.post("/organizations")
    def create_organization(req: CreateOrganizationRequest,
                             user: dict = Depends(get_current_user)):
        return interface.create_organization(req.model_dump())

    @router.get("/organizations/{org_id}")
    def get_organization(org_id: int, user: dict = Depends(get_current_user)):
        return interface.get_organization(org_id)

    @router.put("/organizations/{org_id}")
    def update_organization(org_id: int, req: UpdateOrganizationRequest,
                             user: dict = Depends(get_current_user)):
        return interface.update_organization(org_id, req.model_dump(exclude_unset=True), user["email"])

    @router.delete("/organizations/{org_id}")
    def delete_organization(org_id: int, user: dict = Depends(get_current_user)):
        return interface.delete_organization(org_id)

    # --- Shows ---

    @router.get("/shows")
    def list_shows(search: str = Query(""), limit: int = Query(50, ge=1, le=200),
                   offset: int = Query(0, ge=0), user: dict = Depends(get_current_user)):
        return interface.list_shows(search=search, limit=limit, offset=offset)

    @router.post("/shows")
    def create_show(req: CreateShowRequest, user: dict = Depends(get_current_user)):
        return interface.create_show(req.model_dump())

    @router.get("/shows/{show_id}")
    def get_show_detail(show_id: int, user: dict = Depends(get_current_user)):
        return interface.get_show(show_id)

    @router.put("/shows/{show_id}")
    def update_show(show_id: int, req: UpdateShowRequest, user: dict = Depends(get_current_user)):
        return interface.update_show(show_id, req.model_dump(exclude_unset=True))

    @router.delete("/shows/{show_id}")
    def delete_show(show_id: int, user: dict = Depends(get_current_user)):
        return interface.delete_show(show_id)

    @router.post("/shows/{show_id}/producers")
    def add_producer_to_show(show_id: int, req: AddProducerShowRequest,
                              user: dict = Depends(get_current_user)):
        return interface.add_producer_show(req.producer_id, show_id, req.role_id, user["email"])

    @router.delete("/shows/{show_id}/producers/{link_id}")
    def remove_producer_from_show(show_id: int, link_id: int,
                                   user: dict = Depends(get_current_user)):
        return interface.remove_producer_show(link_id, user["email"])

    @router.post("/shows/{show_id}/research")
    async def research_show(show_id: int, user: dict = Depends(get_current_user)):
        from producers.backend.ai import run_show_research
        try:
            result = await run_show_research(show_id)
            return {"status": "complete", "result": result}
        except Exception as e:
            logger.exception("Show research failed for show %d", show_id)
            return {"status": "error", "error": str(e)}

    # --- Productions ---

    @router.get("/productions")
    def list_productions(
        search: str = Query(""),
        limit: int = Query(50, ge=1, le=200),
        offset: int = Query(0, ge=0),
        user: dict = Depends(get_current_user),
    ):
        return interface.list_all_productions(search=search, limit=limit, offset=offset)

    @router.post("/productions")
    def create_production(req: CreateProductionRequest,
                           user: dict = Depends(get_current_user)):
        return interface.create_production(req.model_dump(), user["email"])

    @router.get("/productions/{production_id}")
    def get_production_detail(production_id: int, user: dict = Depends(get_current_user)):
        return interface.get_production(production_id)

    @router.put("/productions/{production_id}")
    def update_production(production_id: int, req: UpdateProductionRequest,
                           user: dict = Depends(get_current_user)):
        return interface.update_production(production_id, req.model_dump(exclude_unset=True), user["email"])

    @router.delete("/productions/{production_id}")
    def delete_production(production_id: int, user: dict = Depends(get_current_user)):
        return interface.delete_production(production_id)

    @router.post("/productions/{production_id}/producers")
    def add_producer_to_production(production_id: int, req: AddProducerToProductionRequest,
                                    user: dict = Depends(get_current_user)):
        return interface.add_producer_to_production(production_id, req.producer_id, req.role_id, user["email"])

    @router.put("/productions/{production_id}/producers/{link_id}")
    def update_production_role(production_id: int, link_id: int,
                                req: AddProducerToProductionRequest,
                                user: dict = Depends(get_current_user)):
        return interface.update_producer_production_role(link_id, req.role_id)

    @router.delete("/productions/{production_id}/producers/{link_id}")
    def remove_producer_from_production(production_id: int, link_id: int,
                                         user: dict = Depends(get_current_user)):
        return interface.remove_producer_from_production(link_id, user["email"])

    # --- Venues ---

    @router.get("/venues")
    def list_venues(search: str = Query(""), limit: int = Query(50, ge=1, le=200),
                     offset: int = Query(0, ge=0),
                     user: dict = Depends(get_current_user)):
        return interface.list_venues(search=search, limit=limit, offset=offset)

    @router.get("/venues/{venue_id}")
    def get_venue(venue_id: int, user: dict = Depends(get_current_user)):
        return interface.get_venue(venue_id)

    @router.post("/venues")
    def create_venue(req: CreateVenueRequest, user: dict = Depends(get_current_user)):
        return interface.create_venue(req.model_dump())

    @router.put("/venues/{venue_id}")
    def update_venue(venue_id: int, req: UpdateVenueRequest,
                      user: dict = Depends(get_current_user)):
        return interface.update_venue(venue_id, req.model_dump(exclude_unset=True))

    @router.delete("/venues/{venue_id}")
    def delete_venue(venue_id: int, user: dict = Depends(get_current_user)):
        return interface.delete_venue(venue_id)

    @router.post("/venues/{venue_id}/productions/{production_id}")
    def add_production_to_venue(venue_id: int, production_id: int,
                                 user: dict = Depends(get_current_user)):
        return interface.add_production_to_venue(venue_id, production_id)

    @router.delete("/venues/{venue_id}/productions/{production_id}")
    def remove_production_from_venue(venue_id: int, production_id: int,
                                      user: dict = Depends(get_current_user)):
        return interface.remove_production_from_venue(venue_id, production_id)

    # --- Entity Emails ---

    # Organization emails
    @router.get("/organizations/{org_id}/emails")
    def get_org_emails(org_id: int, user: dict = Depends(get_current_user)):
        return interface.get_entity_emails("organization", org_id)

    @router.post("/organizations/{org_id}/emails")
    def add_org_email(org_id: int, req: AddEmailRequest, user: dict = Depends(get_current_user)):
        return interface.add_entity_email(
            "organization", org_id, req.email,
            type_id=req.type_id, source=req.source,
            confidence=req.confidence, is_primary=req.is_primary,
        )

    @router.delete("/organizations/{org_id}/emails/{email_id}")
    def remove_org_email(org_id: int, email_id: int, user: dict = Depends(get_current_user)):
        return interface.remove_entity_email("organization", org_id, email_id)

    @router.put("/organizations/{org_id}/emails/{email_id}/primary")
    def set_org_primary_email(org_id: int, email_id: int, user: dict = Depends(get_current_user)):
        return interface.set_primary_email("organization", org_id, email_id)

    # Venue emails
    @router.get("/venues/{venue_id}/emails")
    def get_venue_emails(venue_id: int, user: dict = Depends(get_current_user)):
        return interface.get_entity_emails("venue", venue_id)

    @router.post("/venues/{venue_id}/emails")
    def add_venue_email(venue_id: int, req: AddEmailRequest, user: dict = Depends(get_current_user)):
        return interface.add_entity_email(
            "venue", venue_id, req.email,
            type_id=req.type_id, source=req.source,
            confidence=req.confidence, is_primary=req.is_primary,
        )

    @router.delete("/venues/{venue_id}/emails/{email_id}")
    def remove_venue_email(venue_id: int, email_id: int, user: dict = Depends(get_current_user)):
        return interface.remove_entity_email("venue", venue_id, email_id)

    @router.put("/venues/{venue_id}/emails/{email_id}/primary")
    def set_venue_primary_email(venue_id: int, email_id: int, user: dict = Depends(get_current_user)):
        return interface.set_primary_email("venue", venue_id, email_id)

    # --- Awards ---

    @router.post("/awards")
    def create_award(req: CreateAwardRequest, user: dict = Depends(get_current_user)):
        return interface.create_award(req.model_dump())

    @router.put("/awards/{award_id}")
    def update_award(award_id: int, req: UpdateAwardRequest,
                      user: dict = Depends(get_current_user)):
        return interface.update_award(award_id, req.model_dump(exclude_unset=True))

    @router.delete("/awards/{award_id}")
    def delete_award(award_id: int, user: dict = Depends(get_current_user)):
        return interface.delete_award(award_id)

    # --- Traits ---

    @router.get("/{producer_id}/traits")
    def get_traits(producer_id: int, user: dict = Depends(get_current_user)):
        return interface.get_producer_traits(producer_id)

    @router.post("/{producer_id}/traits")
    def create_trait(producer_id: int, req: CreateTraitRequest,
                     user: dict = Depends(get_current_user)):
        return interface.create_producer_trait(producer_id, req.model_dump())

    @router.put("/{producer_id}/traits/{trait_id}")
    def update_trait(producer_id: int, trait_id: int, req: UpdateTraitRequest,
                     user: dict = Depends(get_current_user)):
        return interface.update_producer_trait(trait_id, req.model_dump(exclude_unset=True))

    @router.delete("/{producer_id}/traits/{trait_id}")
    def delete_trait(producer_id: int, trait_id: int,
                     user: dict = Depends(get_current_user)):
        return interface.delete_producer_trait(trait_id)

    # --- Intel ---

    @router.get("/{producer_id}/intel")
    def get_intel(producer_id: int, user: dict = Depends(get_current_user)):
        return interface.get_producer_intel(producer_id)

    @router.post("/{producer_id}/intel")
    def create_intel(producer_id: int, req: CreateIntelRequest,
                     user: dict = Depends(get_current_user)):
        return interface.create_producer_intel(producer_id, req.model_dump())

    @router.put("/{producer_id}/intel/{intel_id}")
    def update_intel(producer_id: int, intel_id: int, req: UpdateIntelRequest,
                     user: dict = Depends(get_current_user)):
        return interface.update_producer_intel(intel_id, req.model_dump(exclude_unset=True))

    @router.delete("/{producer_id}/intel/{intel_id}")
    def delete_intel(producer_id: int, intel_id: int,
                     user: dict = Depends(get_current_user)):
        return interface.delete_producer_intel(intel_id)

    @router.post("/{producer_id}/intel/gather")
    def gather_intel(producer_id: int,
                     background_tasks: BackgroundTasks,
                     user: dict = Depends(get_current_user)):
        """Trigger AI to gather intel about this producer. Pipeline TBD."""
        # TODO: Wire to AI pipeline when ready
        return {"status": "queued", "message": "Intel gathering is not yet implemented."}

    @router.post("/settings/refresh-all")
    def refresh_all_producers(
        background_tasks: BackgroundTasks,
        user: dict = Depends(get_current_user),
    ):
        """Trigger a full re-research across the entire database."""
        from producers.backend.models import Producer
        with session_factory() as session:
            producer_ids = [p.id for p in session.query(Producer.id).all()]
        for pid in producer_ids:
            background_tasks.add_task(_run_research, session_factory, pid, is_refresh=True)
        return {"triggered": True, "count": len(producer_ids)}

    @router.get("/settings/job-status")
    def job_status(user: dict = Depends(get_current_user)):
        """Get status of scheduled jobs — last ran, next run."""
        from shared.backend.scheduler import scheduler
        jobs_info = {}
        for job_id, label in [("producers_ai_discovery", "AI Discovery"),
                               ("producers_dossier_refresh", "Dossier Refresh")]:
            job = scheduler.get_job(job_id)
            jobs_info[job_id] = {
                "label": label,
                "next_run": job.next_run_time.isoformat() if job and job.next_run_time else None,
            }
        return jobs_info

    @router.get("/settings/models")
    def get_model_settings(user: dict = Depends(get_current_user)):
        """Get available models per provider and current model per behavior."""
        from producers.backend.ai import MODEL_OPTIONS
        from producers.backend.models import AIBehavior
        with session_factory() as session:
            behaviors = session.query(AIBehavior).order_by(AIBehavior.name).all()
            return {
                "options": MODEL_OPTIONS,
                "behaviors": [
                    {
                        "id": b.id,
                        "behavior": b.name,
                        "label": b.display_label,
                        "model": b.model,
                    }
                    for b in behaviors
                ],
            }

    @router.get("/data-sources")
    def list_sources(user: dict = Depends(get_current_user)):
        return interface.get_research_sources()

    @router.post("/data-sources")
    def create_source(req: CreateSourceRequest,
                      user: dict = Depends(get_current_user)):
        return interface.create_research_source(req.name, req.url or "", req.description)

    @router.get("/data-sources/{source_id}")
    def get_source(source_id: int, user: dict = Depends(get_current_user)):
        return interface.get_research_source(source_id)

    @router.put("/data-sources/{source_id}")
    def update_source(source_id: int, req: UpdateSourceRequest,
                      user: dict = Depends(get_current_user)):
        return interface.update_research_source(source_id, req.model_dump(exclude_unset=True))

    @router.put("/data-sources/reorder")
    def reorder_sources(req: dict, user: dict = Depends(get_current_user)):
        return interface.reorder_research_sources(req.get("source_ids", []))

    @router.delete("/data-sources/{source_id}")
    def delete_source(source_id: int, user: dict = Depends(get_current_user)):
        return interface.delete_research_source(source_id)

    # --- Individual producer ---

    @router.get("/{producer_id}")
    def get_producer(producer_id: int, user: dict = Depends(get_current_user)):
        return interface.get_record(producer_id)

    @router.put("/{producer_id}")
    def update_producer(producer_id: int, req: UpdateProducerRequest,
                        user: dict = Depends(get_current_user)):
        data = req.model_dump(exclude_unset=True)
        return interface.update_producer(producer_id, data, user["email"])

    @router.delete("/{producer_id}")
    def delete_producer(producer_id: int, user: dict = Depends(get_current_user)):
        return interface.delete_producer(producer_id)

    # Producer emails
    @router.get("/{producer_id}/emails")
    def get_producer_emails(producer_id: int, user: dict = Depends(get_current_user)):
        return interface.get_entity_emails("producer", producer_id)

    @router.post("/{producer_id}/emails")
    def add_producer_email(producer_id: int, req: AddEmailRequest, user: dict = Depends(get_current_user)):
        return interface.add_entity_email(
            "producer", producer_id, req.email,
            type_id=req.type_id, source=req.source,
            confidence=req.confidence, is_primary=req.is_primary,
        )

    @router.delete("/{producer_id}/emails/{email_id}")
    def remove_producer_email(producer_id: int, email_id: int, user: dict = Depends(get_current_user)):
        return interface.remove_entity_email("producer", producer_id, email_id)

    @router.put("/{producer_id}/emails/{email_id}/primary")
    def set_producer_primary_email(producer_id: int, email_id: int, user: dict = Depends(get_current_user)):
        return interface.set_primary_email("producer", producer_id, email_id)

    @router.get("/{producer_id}/productions")
    def get_productions(producer_id: int, user: dict = Depends(get_current_user)):
        return interface.get_productions(producer_id)

    @router.get("/{producer_id}/shows")
    def get_producer_shows(producer_id: int, user: dict = Depends(get_current_user)):
        return interface.get_producer_shows(producer_id)

    @router.get("/{producer_id}/organizations")
    def get_organizations(producer_id: int, user: dict = Depends(get_current_user)):
        return interface.get_organizations(producer_id)

    @router.post("/{producer_id}/organizations")
    def add_affiliation(producer_id: int, req: AddAffiliationRequest,
                         user: dict = Depends(get_current_user)):
        org_id = req.organization_id
        # If org_name given without org_id, resolve or create
        if not org_id and req.organization_name:
            org_id = interface.resolve_or_create_organization(
                req.organization_name, user["email"]
            )
        if not org_id:
            return {"error": "organization_id or organization_name required"}
        return interface.add_producer_affiliation(
            producer_id, org_id,
            req.model_dump(exclude={"organization_id", "organization_name"}), user["email"]
        )

    @router.put("/{producer_id}/organizations/{affiliation_id}")
    def update_affiliation(producer_id: int, affiliation_id: int,
                            req: UpdateAffiliationRequest,
                            user: dict = Depends(get_current_user)):
        return interface.update_producer_affiliation(
            affiliation_id, req.model_dump(exclude_unset=True), user["email"]
        )

    @router.delete("/{producer_id}/organizations/{affiliation_id}")
    def remove_affiliation(producer_id: int, affiliation_id: int,
                            user: dict = Depends(get_current_user)):
        return interface.remove_producer_affiliation(affiliation_id, user["email"])

    @router.get("/{producer_id}/interactions")
    def get_interactions(producer_id: int, user: dict = Depends(get_current_user)):
        return interface.get_interactions(producer_id)

    @router.post("/{producer_id}/interactions/transcribe")
    async def transcribe_audio(
        producer_id: int,
        file: UploadFile = File(...),
        user: dict = Depends(get_current_user),
    ):
        """Transcribe uploaded audio to text using Gemini."""
        import base64
        try:
            audio_bytes = await file.read()
            audio_b64 = base64.b64encode(audio_bytes).decode()
            mime_type = file.content_type or "audio/webm"
            from shared.backend.ai.clients import get_google_ai_client
            from google.genai import types
            client = get_google_ai_client()
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[
                    types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
                    "Transcribe this audio recording. Return ONLY the transcription text, nothing else.",
                ],
            )
            return {"text": response.text.strip() if response.text else ""}
        except Exception as e:
            logger.exception("Audio transcription failed")
            return {"error": str(e)}

    @router.post("/{producer_id}/interactions")
    def add_interaction(
        producer_id: int,
        req: AddInteractionRequest,
        background_tasks: BackgroundTasks,
        user: dict = Depends(get_current_user),
    ):
        result = interface.add_interaction(producer_id, req.content, user["email"])
        if "error" not in result:
            # Run AI processing in background
            background_tasks.add_task(
                _process_interaction, session_factory, result["id"],
                producer_id, req.content, user["email"]
            )
        return result

    @router.put("/{producer_id}/interactions/{interaction_id}")
    def edit_interaction(producer_id: int, interaction_id: int,
                          req: UpdateInteractionRequest,
                          user: dict = Depends(get_current_user)):
        return interface.update_interaction(interaction_id, req.content, user["email"])

    @router.delete("/{producer_id}/interactions/{interaction_id}")
    def delete_interaction(producer_id: int, interaction_id: int,
                            user: dict = Depends(get_current_user)):
        return interface.delete_interaction(interaction_id, producer_id)

    @router.get("/{producer_id}/relationship")
    def get_relationship(producer_id: int, user: dict = Depends(get_current_user)):
        return interface.get_relationship_state(producer_id)

    @router.post("/{producer_id}/tags")
    def add_tag(producer_id: int, req: AddTagRequest,
                user: dict = Depends(get_current_user)):
        return interface.add_tag(producer_id, req.tag, user["email"])

    @router.delete("/{producer_id}/tags/{tag_name}")
    def remove_tag(producer_id: int, tag_name: str,
                   user: dict = Depends(get_current_user)):
        return interface.remove_tag(producer_id, tag_name, user["email"])

    @router.post("/{producer_id}/follow-ups/{signal_id}/resolve")
    def resolve_follow_up(producer_id: int, signal_id: int,
                           user: dict = Depends(get_current_user)):
        return interface.resolve_follow_up(signal_id)

    @router.put("/{producer_id}/follow-ups/{signal_id}")
    def update_follow_up(producer_id: int, signal_id: int,
                          req: UpdateFollowUpRequest,
                          user: dict = Depends(get_current_user)):
        return interface.update_follow_up(signal_id, req.model_dump(exclude_unset=True))

    @router.delete("/{producer_id}/follow-ups/{signal_id}")
    def delete_follow_up(producer_id: int, signal_id: int,
                          user: dict = Depends(get_current_user)):
        return interface.delete_follow_up(signal_id)

    @router.get("/{producer_id}/history")
    def get_history(producer_id: int, user: dict = Depends(get_current_user)):
        return interface.get_change_history("producer", producer_id)

    @router.post("/{producer_id}/refresh")
    def refresh_producer(
        producer_id: int,
        background_tasks: BackgroundTasks,
        user: dict = Depends(get_current_user),
    ):
        background_tasks.add_task(_run_research, session_factory, producer_id, is_refresh=True)
        return {"producer_id": producer_id, "refresh_started": True}

    return router


# --- Background task helpers ---

def _run_research(session_factory, producer_id: int, is_refresh: bool = False):
    """Run dossier research as a background task."""
    import asyncio
    from producers.backend.ai import run_dossier_research
    with session_factory() as session:
        asyncio.run(run_dossier_research(session, producer_id, is_refresh=is_refresh))


def _process_interaction(session_factory, interaction_id: int, producer_id: int,
                         content: str, author: str):
    """Process an interaction after save — extract follow-ups, regenerate summary."""
    import asyncio
    from datetime import datetime, timezone

    from producers.backend.ai import (
        extract_follow_ups,
        recompute_relationship_state,
    )
    from producers.backend.models import Producer

    with session_factory() as session:
        producer = session.get(Producer, producer_id)
        if not producer:
            return

        date_str = str(datetime.now(timezone.utc))

        try:
            producer_name = f"{producer.first_name} {producer.last_name}"
            asyncio.run(extract_follow_ups(session, interaction_id, producer_id,
                                           producer_name, content, date_str, author))
        except Exception:
            logger.exception("Failed to extract follow-ups for interaction %d", interaction_id)

        # TODO: relationship summary regeneration pending pipeline redesign

        try:
            recompute_relationship_state(session, producer_id)
        except Exception:
            logger.exception("Failed to recompute state for producer %d", producer_id)

        session.commit()
