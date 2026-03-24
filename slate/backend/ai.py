"""
AI pipeline for Slate.

Handles script analysis, music analysis, visual asset analysis.
All LLM calls go through call_llm, which reads behavior config
from the slate_ai_behaviors table.

Script analysis populates domain tables (SlateCharacter, SlateScene,
SlateSong, etc.) instead of the old SlateShowData JSONB blob.
Music and visual analysis write fields directly to their respective
file/asset records.
"""

import base64
import json
import logging
from io import BytesIO
from typing import Optional
from xml.etree import ElementTree

from pydantic import BaseModel

from slate.backend.models import (
    SlateAIBehavior,
    SlateArcPoint,
    SlateBudgetEstimate,
    SlateCastRequirements,
    SlateCharacter,
    SlateComparable,
    SlateContentAdvisory,
    SlateLoglineDraft,
    SlateLookupValue,
    SlateMilestone,
    SlateMusicFile,
    SlatePitch,
    SlateRuntimeEstimate,
    SlateScene,
    SlateScriptVersion,
    SlateShow,
    SlateSong,
    SlateSummaryDraft,
    SlateVersionDiff,
    SlateVisualAsset,
)
from shared.backend.ai.clients import get_anthropic_client, get_google_ai_client
from shared.backend.storage.gcs import download_file

logger = logging.getLogger(__name__)

# Module-level session factory — set by init() at startup
_session_factory = None


def init(session_factory):
    """Initialize the AI module with a session factory. Called at app startup."""
    global _session_factory
    _session_factory = session_factory


# --- Core LLM infrastructure ---

# Available models for the AI Configuration UI dropdown
MODEL_OPTIONS = {
    "anthropic": [
        {"id": "claude-opus-4-6", "label": "Claude Opus 4.6", "tier": "high"},
        {"id": "claude-sonnet-4-6", "label": "Claude Sonnet 4.6", "tier": "mid"},
        {"id": "claude-sonnet-4-5-20250929", "label": "Claude Sonnet 4.5", "tier": "mid"},
        {"id": "claude-haiku-4-5-20251001", "label": "Claude Haiku 4.5", "tier": "low"},
    ],
    "google": [
        {"id": "gemini-3.1-pro-preview", "label": "Gemini 3.1 Pro", "tier": "high"},
        {"id": "gemini-3-flash-preview", "label": "Gemini 3 Flash", "tier": "mid"},
        {"id": "gemini-3.1-flash-lite-preview", "label": "Gemini 3.1 Flash-Lite", "tier": "low"},
        {"id": "gemini-2.5-pro", "label": "Gemini 2.5 Pro", "tier": "high"},
        {"id": "gemini-2.5-flash", "label": "Gemini 2.5 Flash", "tier": "mid"},
    ],
}


def _get_provider(model_id: str) -> str:
    """Determine provider from model ID."""
    if model_id.startswith("gemini-"):
        return "google"
    return "anthropic"


async def call_llm(behavior: str, context: dict,
                   file_parts: list[dict] | None = None,
                   use_mcp: bool = False,
                   response_schema=None) -> str:
    """Call an LLM for a named behavior and return the text response.

    Reads prompts and model from the slate_ai_behaviors table, formats prompts
    with the context dict, routes to the correct provider.

    file_parts is an optional list of dicts with 'data' (bytes) and 'mime_type'
    (str) for multimodal inputs (PDFs, audio, images).

    use_mcp enables MCP tool access so the LLM can call Intelligence tools.

    response_schema can be a BaseModel subclass for a single object, or
    list[SomeModel] for an array of objects.
    """
    # Read behavior config from database
    with _session_factory() as session:
        behavior_row = session.query(SlateAIBehavior).filter_by(name=behavior).first()
        if not behavior_row:
            raise ValueError(f"Unknown AI behavior: {behavior}")
        system_prompt = behavior_row.system_prompt
        user_prompt = behavior_row.user_prompt
        model = behavior_row.model

    # Format prompts with context variables
    system = system_prompt.format(**context) if context else system_prompt
    user = user_prompt.format(**context) if context else user_prompt

    provider = _get_provider(model)

    if provider == "google":
        return await _call_gemini(model, system, user, file_parts, use_mcp, response_schema)
    else:
        return await _call_claude(model, system, user, file_parts, use_mcp, response_schema)


async def _call_claude(model: str, system: str, user: str,
                       file_parts: list[dict] | None = None,
                       use_mcp: bool = False,
                       response_schema=None) -> str:
    """Call Claude and return the text response.

    response_schema can be a BaseModel subclass or list[BaseModel].
    If file_parts is provided, the user message content becomes a list with
    document/image blocks plus the text.
    """
    from shared.backend.config import settings

    client = get_anthropic_client()

    # Build user message content
    if file_parts:
        content_blocks = []
        for fp in file_parts:
            mime = fp["mime_type"]
            b64 = base64.b64encode(fp["data"]).decode("utf-8")
            if mime == "application/pdf":
                content_blocks.append({
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": "application/pdf",
                        "data": b64,
                    },
                })
            elif mime.startswith("image/"):
                content_blocks.append({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": mime,
                        "data": b64,
                    },
                })
            else:
                # For audio or other types, encode as document
                content_blocks.append({
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": mime,
                        "data": b64,
                    },
                })
        content_blocks.append({"type": "text", "text": user})
        user_content = content_blocks
    else:
        user_content = user

    kwargs = {
        "model": model,
        "max_tokens": 8192,
        "system": system,
        "messages": [{"role": "user", "content": user_content}],
    }

    tools = []

    if use_mcp and "localhost" not in settings.app_domain:
        mcp_url = f"{settings.app_domain}/mcp/mcp"
        kwargs["mcp_servers"] = [{
            "type": "url",
            "url": mcp_url,
            "name": "intelligence",
            "authorization_token": settings.mcp_secret,
        }]
        tools.append({"type": "mcp_toolset", "mcp_server_name": "intelligence"})
        kwargs["betas"] = kwargs.get("betas", []) + ["mcp-client-2025-11-20"]

    if tools:
        kwargs["tools"] = tools

    if response_schema:
        # Handle list[Model] or plain Model
        origin = getattr(response_schema, "__origin__", None)
        if origin is list:
            item_schema = response_schema.__args__[0]
            json_schema = {"type": "array", "items": item_schema.model_json_schema()}
            schema_name = item_schema.__name__ + "List"
        else:
            json_schema = response_schema.model_json_schema()
            schema_name = response_schema.__name__

        def _clean_schema(s):
            if isinstance(s, dict):
                return {k: _clean_schema(v) for k, v in s.items() if k != "title"}
            if isinstance(s, list):
                return [_clean_schema(i) for i in s]
            return s

        json_schema = _clean_schema(json_schema)
        kwargs.setdefault("betas", []).append("structured-outputs-2025-11-13")
        kwargs["output_format"] = {
            "type": "json_schema",
            "json_schema": {
                "name": schema_name,
                "schema": json_schema,
            },
        }
        response = client.beta.messages.create(**kwargs)
    else:
        if "betas" in kwargs:
            response = client.beta.messages.create(**kwargs)
        else:
            response = client.messages.create(**kwargs)

    text_parts = []
    for block in response.content:
        if hasattr(block, "text"):
            text_parts.append(block.text)
    return "\n".join(text_parts)


async def _call_gemini(model: str, system: str, user: str,
                       file_parts: list[dict] | None = None,
                       use_mcp: bool = False,
                       response_schema=None) -> str:
    """Call Gemini and return the text response.

    response_schema can be a BaseModel subclass or list[BaseModel].
    Gemini's structured output handles list types natively.
    If file_parts is provided, contents becomes a list with Part.from_bytes
    items followed by the user text.
    """
    from google.genai import types

    from shared.backend.config import settings

    client = get_google_ai_client()

    config_kwargs = {"system_instruction": system}
    tools = []

    # Build contents
    if file_parts:
        parts = [
            types.Part.from_bytes(data=fp["data"], mime_type=fp["mime_type"])
            for fp in file_parts
        ]
        contents = [*parts, user]
    else:
        contents = user

    if use_mcp:
        from fastmcp import Client

        if settings.environment == "production":
            mcp_client = Client(f"{settings.app_domain}/mcp/mcp")
        else:
            from shared.backend.mcp import mcp_server
            mcp_client = Client(mcp_server)

        async with mcp_client:
            tools.append(mcp_client.session)
            config_kwargs["tools"] = tools
            config_kwargs["automatic_function_calling"] = (
                types.AutomaticFunctionCallingConfig(maximum_remote_calls=50)
            )

            if response_schema:
                config_kwargs["response_mime_type"] = "application/json"
                config_kwargs["response_schema"] = response_schema

            response = await client.aio.models.generate_content(
                model=model,
                contents=contents,
                config=types.GenerateContentConfig(**config_kwargs),
            )

            if response.candidates:
                parts = []
                for part in response.candidates[0].content.parts:
                    if hasattr(part, "text") and part.text:
                        parts.append(part.text)
                return "\n".join(parts)
            return response.text or ""

    # Non-MCP Gemini call
    if tools:
        config_kwargs["tools"] = tools

    if response_schema:
        config_kwargs["response_mime_type"] = "application/json"
        config_kwargs["response_schema"] = response_schema

    response = await client.aio.models.generate_content(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(**config_kwargs),
    )
    return response.text or ""


# --- Structured output schemas ---

class Character(BaseModel):
    name: str
    description: str
    age_range: Optional[str] = None
    gender: Optional[str] = None
    line_count: Optional[int] = None
    song_count: Optional[int] = None
    vocal_range: Optional[str] = None
    dance_requirements: Optional[str] = None
    notes: Optional[str] = None


class CharacterBreakdown(BaseModel):
    characters: list[Character]


class Scene(BaseModel):
    scene_number: Optional[int] = None
    title: Optional[str] = None
    location: Optional[str] = None
    int_ext: Optional[str] = None
    time_of_day: Optional[str] = None
    characters: Optional[list[str]] = None
    description: Optional[str] = None
    estimated_minutes: Optional[float] = None


class Act(BaseModel):
    act_number: Optional[int] = None
    scenes: list[Scene]


class SceneBreakdown(BaseModel):
    acts: list[Act]


class Song(BaseModel):
    title: str
    act: Optional[int] = None
    scene: Optional[int] = None
    characters: Optional[list[str]] = None
    song_type: Optional[str] = None
    description: Optional[str] = None


class SongList(BaseModel):
    songs: list[Song]


class ArcPoint(BaseModel):
    position: float
    intensity: float
    label: str
    tone: Optional[str] = None


class EmotionalArc(BaseModel):
    arc_points: list[ArcPoint]
    summary: str


class ActRuntime(BaseModel):
    act: Optional[int] = None
    minutes: float


class RuntimeEstimate(BaseModel):
    total_minutes: float
    act_breakdown: Optional[list[ActRuntime]] = None
    notes: Optional[str] = None


class CastRequirements(BaseModel):
    minimum_cast_size: int
    recommended_cast_size: int
    doubling_possibilities: Optional[str] = None
    musicians: Optional[int] = None
    musician_instruments: Optional[list[str]] = None
    locations_count: Optional[int] = None
    notes: Optional[str] = None


class BudgetEstimate(BaseModel):
    estimated_range: str
    factors: Optional[list[str]] = None
    cast_size_impact: Optional[str] = None
    technical_complexity: Optional[str] = None
    location_complexity: Optional[str] = None
    post_production_notes: Optional[str] = None
    notes: Optional[str] = None


class LoglineOption(BaseModel):
    text: str
    tone: Optional[str] = None


class LoglineDraft(BaseModel):
    options: list[LoglineOption]


class SummaryDraft(BaseModel):
    summary: str


class Comparable(BaseModel):
    title: str
    relationship: Optional[str] = None
    reasoning: Optional[str] = None


class Comparables(BaseModel):
    comparables: list[Comparable]


class Advisory(BaseModel):
    category: str
    description: str
    severity: Optional[str] = None


class ContentAdvisories(BaseModel):
    advisories: list[Advisory]


class VersionDiff(BaseModel):
    summary: str
    structural_changes: Optional[list[str]] = None
    character_changes: Optional[list[str]] = None
    song_changes: Optional[list[str]] = None
    tone_shift: Optional[str] = None
    notes: Optional[str] = None


class MusicAnalysisResult(BaseModel):
    key: Optional[str] = None
    tempo: Optional[str] = None
    mood: Optional[str] = None
    instrumentation: Optional[list[str]] = None
    vocal_range_required: Optional[str] = None
    function_in_show: Optional[str] = None
    emotional_quality: Optional[str] = None
    notes: Optional[str] = None


class VisualAnalysisResult(BaseModel):
    color_palette: Optional[list[str]] = None
    mood: Optional[str] = None
    tone: Optional[str] = None
    typography: Optional[str] = None
    visual_themes: Optional[list[str]] = None
    communicates: Optional[str] = None
    notes: Optional[str] = None


# --- Grouped analysis schemas ---

class CoreAnalysis(BaseModel):
    character_breakdown: CharacterBreakdown
    scene_breakdown: SceneBreakdown
    song_list: Optional[SongList] = None
    emotional_arc: EmotionalArc
    runtime_estimate: RuntimeEstimate


class ProductionAnalysis(BaseModel):
    cast_requirements: CastRequirements
    budget_estimate: BudgetEstimate
    content_advisories: ContentAdvisories


class CreativePositioning(BaseModel):
    logline_draft: LoglineDraft
    summary_draft: SummaryDraft
    comparables: Comparables


# --- Analysis configuration ---

# The three grouped analysis calls for script processing
ANALYSIS_GROUPS = [
    {
        "name": "core",
        "label": "Core Analysis",
        "behavior": "script_core_analysis",
        "schema": CoreAnalysis,
        "data_types": ["character_breakdown", "scene_breakdown", "song_list", "emotional_arc", "runtime_estimate"],
    },
    {
        "name": "production",
        "label": "Production Analysis",
        "behavior": "script_production_analysis",
        "schema": ProductionAnalysis,
        "data_types": ["cast_requirements", "budget_estimate", "content_advisories"],
    },
    {
        "name": "creative",
        "label": "Creative Positioning",
        "behavior": "script_creative_positioning",
        "schema": CreativePositioning,
        "data_types": ["logline_draft", "summary_draft", "comparables"],
    },
]


# --- Text extraction ---

def extract_script_content(file_path: str, file_bytes: bytes) -> tuple[str | None, list | None]:
    """Extract text content from a script file.

    Returns (text, file_parts):
    - For PDF: text=None, file_parts=[{'data': bytes, 'mime_type': 'application/pdf'}]
    - For DOCX: text=extracted_text, file_parts=None
    - For FDX: text=extracted_text, file_parts=None
    """
    lower_path = file_path.lower()

    if lower_path.endswith(".pdf"):
        return None, [{"data": file_bytes, "mime_type": "application/pdf"}]
    elif lower_path.endswith(".docx"):
        text = _extract_docx_text(file_bytes)
        return text, None
    elif lower_path.endswith(".fdx"):
        text = _extract_fdx_text(file_bytes)
        return text, None
    else:
        # Assume plain text
        try:
            text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            text = file_bytes.decode("latin-1")
        return text, None


def _extract_docx_text(file_bytes: bytes) -> str:
    """Extract text from a DOCX file using python-docx."""
    from docx import Document

    doc = Document(BytesIO(file_bytes))
    paragraphs = []
    for para in doc.paragraphs:
        if para.text.strip():
            paragraphs.append(para.text)
    return "\n".join(paragraphs)


def _extract_fdx_text(file_bytes: bytes) -> str:
    """Extract text from a Final Draft FDX file.

    FDX format: root element is <FinalDraft>, contains <Content>,
    which has <Paragraph Type="..."> elements. Types include:
    "Scene Heading", "Action", "Character", "Dialogue", "Parenthetical",
    "Transition", "Shot". Each Paragraph contains <Text> elements.
    """
    root = ElementTree.fromstring(file_bytes)
    content = root.find("Content")
    if content is None:
        return ""

    lines = []
    for paragraph in content.findall("Paragraph"):
        para_type = paragraph.get("Type", "")
        texts = []
        for text_elem in paragraph.findall("Text"):
            if text_elem.text:
                texts.append(text_elem.text)
        line_text = "".join(texts).strip()
        if not line_text:
            continue

        if para_type == "Scene Heading":
            lines.append(f"\n[Scene Heading] {line_text}")
        elif para_type == "Action":
            lines.append(f"[Action] {line_text}")
        elif para_type == "Character":
            lines.append(f"\n[Character] {line_text}")
        elif para_type == "Dialogue":
            lines.append(f"[Dialogue] {line_text}")
        elif para_type == "Parenthetical":
            lines.append(f"[Parenthetical] {line_text}")
        elif para_type == "Transition":
            lines.append(f"\n[Transition] {line_text}")
        elif para_type == "Shot":
            lines.append(f"[Shot] {line_text}")
        else:
            lines.append(line_text)

    return "\n".join(lines)


# --- Domain table storage helpers ---

def _store_extraction_results(session_factory, show_id, version_id, data, is_musical):
    """Parse extraction response and create domain entity rows for this version."""
    with session_factory() as session:
        # Clear existing data for this version (in case of reprocessing)
        session.query(SlateCharacter).filter_by(show_id=show_id, script_version_id=version_id).delete()
        session.query(SlateScene).filter_by(show_id=show_id, script_version_id=version_id).delete()
        session.query(SlateSong).filter_by(show_id=show_id, script_version_id=version_id).delete()
        session.query(SlateArcPoint).filter_by(show_id=show_id, script_version_id=version_id).delete()
        session.query(SlateRuntimeEstimate).filter_by(show_id=show_id, script_version_id=version_id).delete()

        # Characters
        characters = data.get("character_breakdown", {}).get("characters", [])
        for i, char in enumerate(characters):
            session.add(SlateCharacter(
                show_id=show_id,
                script_version_id=version_id,
                name=char.get("name", ""),
                description=char.get("description"),
                age_range=char.get("age_range"),
                gender=char.get("gender"),
                line_count=char.get("line_count"),
                vocal_range=char.get("vocal_range"),
                song_count=char.get("song_count"),
                dance_requirements=char.get("dance_requirements"),
                notes=char.get("notes"),
                sort_order=i,
            ))

        # Scenes
        acts = data.get("scene_breakdown", {}).get("acts", [])
        sort_idx = 0
        for act in acts:
            act_num = act.get("act_number")
            for scene in act.get("scenes", []):
                session.add(SlateScene(
                    show_id=show_id,
                    script_version_id=version_id,
                    act_number=act_num,
                    scene_number=scene.get("scene_number", sort_idx + 1),
                    title=scene.get("title"),
                    location=scene.get("location"),
                    int_ext=scene.get("int_ext"),
                    time_of_day=scene.get("time_of_day"),
                    characters_present=scene.get("characters"),
                    description=scene.get("description"),
                    estimated_minutes=scene.get("estimated_minutes"),
                    sort_order=sort_idx,
                ))
                sort_idx += 1

        # Songs (musicals only)
        if is_musical:
            songs = data.get("song_list", {}).get("songs", [])
            for i, song in enumerate(songs):
                session.add(SlateSong(
                    show_id=show_id,
                    script_version_id=version_id,
                    title=song.get("title", ""),
                    act=song.get("act"),
                    scene=song.get("scene"),
                    characters=song.get("characters"),
                    song_type=song.get("song_type"),
                    description=song.get("description"),
                    sort_order=i,
                ))

        # Emotional arc
        arc_points = data.get("emotional_arc", {}).get("arc_points", [])
        for i, point in enumerate(arc_points):
            session.add(SlateArcPoint(
                show_id=show_id,
                script_version_id=version_id,
                position=point.get("position", 0),
                intensity=point.get("intensity", 0),
                label=point.get("label"),
                tone=point.get("tone"),
                sort_order=i,
            ))

        # Emotional arc summary on the show
        arc_summary = data.get("emotional_arc", {}).get("summary")
        if arc_summary:
            show = session.query(SlateShow).get(show_id)
            if show:
                show.emotional_arc_summary = arc_summary

        # Runtime estimate
        runtime = data.get("runtime_estimate", {})
        if runtime:
            # Convert act_breakdown from list of dicts to JSON-compatible format
            act_breakdown = runtime.get("act_breakdown")
            if act_breakdown:
                act_breakdown = [
                    {"act": ab.get("act"), "minutes": ab.get("minutes")}
                    for ab in act_breakdown
                ]
            session.add(SlateRuntimeEstimate(
                show_id=show_id,
                script_version_id=version_id,
                total_minutes=runtime.get("total_minutes"),
                act_breakdown=act_breakdown,
                notes=runtime.get("notes"),
            ))

        session.commit()

    logger.info(f"Stored extraction results for show {show_id}")


def _store_assessment_results(session_factory, show_id, version_id, data):
    """Parse assessment response and create domain entity rows for this version."""
    with session_factory() as session:
        session.query(SlateCastRequirements).filter_by(show_id=show_id, script_version_id=version_id).delete()
        session.query(SlateBudgetEstimate).filter_by(show_id=show_id, script_version_id=version_id).delete()
        session.query(SlateContentAdvisory).filter_by(show_id=show_id, script_version_id=version_id).delete()

        # Cast requirements
        cast = data.get("cast_requirements", {})
        if cast:
            session.add(SlateCastRequirements(
                show_id=show_id,
                script_version_id=version_id,
                minimum_cast_size=cast.get("minimum_cast_size"),
                recommended_cast_size=cast.get("recommended_cast_size"),
                doubling_possibilities=cast.get("doubling_possibilities"),
                musicians=cast.get("musicians"),
                musician_instruments=cast.get("musician_instruments"),
                locations_count=cast.get("locations_count"),
                notes=cast.get("notes"),
            ))

        # Budget estimate
        budget = data.get("budget_estimate", {})
        if budget:
            session.add(SlateBudgetEstimate(
                show_id=show_id,
                script_version_id=version_id,
                estimated_range=budget.get("estimated_range"),
                factors=budget.get("factors"),
                cast_size_impact=budget.get("cast_size_impact"),
                technical_complexity=budget.get("technical_complexity"),
                location_complexity=budget.get("location_complexity"),
                post_production_notes=budget.get("post_production_notes"),
                notes=budget.get("notes"),
            ))

        # Content advisories
        advisories = data.get("content_advisories", {}).get("advisories", [])
        for adv in advisories:
            session.add(SlateContentAdvisory(
                show_id=show_id,
                script_version_id=version_id,
                category=adv.get("category", ""),
                description=adv.get("description"),
                severity=adv.get("severity"),
            ))

        session.commit()

    logger.info(f"Stored assessment results for show {show_id}")


def _store_creative_results(session_factory, show_id, version_id, data):
    """Parse creative generation response and create domain entity rows for this version."""
    with session_factory() as session:
        session.query(SlateLoglineDraft).filter_by(show_id=show_id, script_version_id=version_id).delete()
        session.query(SlateSummaryDraft).filter_by(show_id=show_id, script_version_id=version_id).delete()
        session.query(SlateComparable).filter_by(show_id=show_id, script_version_id=version_id).delete()

        # Logline drafts
        logline_data = data.get("logline_draft", {})
        options = logline_data.get("options", [])
        for opt in options:
            session.add(SlateLoglineDraft(
                show_id=show_id,
                script_version_id=version_id,
                text=opt.get("text", ""),
                tone=opt.get("tone"),
            ))

        # Summary draft
        summary_data = data.get("summary_draft", {})
        summary_text = summary_data.get("summary")
        if summary_text:
            session.add(SlateSummaryDraft(
                show_id=show_id,
                script_version_id=version_id,
                summary_text=summary_text,
            ))

        # Comparables
        comp_data = data.get("comparables", {})
        comparables = comp_data.get("comparables", [])
        for comp in comparables:
            session.add(SlateComparable(
                show_id=show_id,
                script_version_id=version_id,
                title=comp.get("title", ""),
                relationship_type=comp.get("relationship"),
                reasoning=comp.get("reasoning"),
            ))

        session.commit()

    logger.info(f"Stored creative results for show {show_id}")


def _store_version_diff(session_factory, show_id, version_id, previous_version_id, data):
    """Store version diff results in the SlateVersionDiff table."""
    with session_factory() as session:
        # Delete any existing diff for this version pair
        session.query(SlateVersionDiff).filter_by(
            show_id=show_id,
            current_version_id=version_id,
            previous_version_id=previous_version_id,
        ).delete()

        session.add(SlateVersionDiff(
            show_id=show_id,
            current_version_id=version_id,
            previous_version_id=previous_version_id,
            summary=data.get("summary"),
            structural_changes=data.get("structural_changes"),
            character_changes=data.get("character_changes"),
            song_changes=data.get("song_changes"),
            tone_shift=data.get("tone_shift"),
            notes=data.get("notes"),
        ))
        session.commit()

    logger.info(f"Stored version diff for version {version_id} vs {previous_version_id}")


# --- Processing pipelines ---

async def process_script(session_factory, version_id: int):
    """Main script processing pipeline.

    Downloads the script, extracts content, and runs 3 grouped analysis
    calls: Core Analysis (reads the script), Production Analysis (derives
    from core), and Creative Positioning (derives from core). Then runs
    version_diff if a previous version exists.

    Results are stored in domain tables (SlateCharacter, SlateScene, etc.)
    instead of the old SlateShowData JSONB blob.
    """
    try:
        # 1. Get version record, set processing status
        with session_factory() as session:
            version = session.query(SlateScriptVersion).get(version_id)
            if not version:
                logger.error(f"Script version {version_id} not found")
                return
            version.processing_status = "processing"
            version.processing_error = None
            show_id = version.show_id
            file_path = version.file_path
            original_filename = version.original_filename
            session.commit()

        # 2. Download file from GCS
        logger.info(f"Downloading script {file_path} for version {version_id}")
        file_bytes = download_file(file_path)

        # 3. Extract content
        text, file_parts = extract_script_content(original_filename, file_bytes)

        # 4. Get show metadata for context
        with session_factory() as session:
            show = session.query(SlateShow).get(show_id)
            if not show:
                logger.error(f"Show {show_id} not found for version {version_id}")
                return
            medium_label = show.medium.display_label if show.medium else "Unknown"
            context = {
                "title": show.title,
                "medium": medium_label,
                "genre": show.genre or "Not specified",
                "script_text": text or "",
            }

        is_musical = medium_label.lower() == "musical"

        # 5. EXTRACTION CALL — read the script, discover structure
        extraction_context = {
            **context,
            "is_musical": "true" if is_musical else "false",
        }
        if not is_musical:
            extraction_context["skip_songs"] = "true"

        logger.info(f"Running core analysis for version {version_id}")
        core_raw = await call_llm(
            behavior="script_core_analysis",
            context=extraction_context,
            file_parts=file_parts,
            response_schema=CoreAnalysis,
        )
        core_data = json.loads(core_raw)
        _store_extraction_results(session_factory, show_id, version_id, core_data, is_musical)

        # 6. ASSESSMENT CALL — read the script, make production judgments
        assessment_context = {
            **context,
            "core_analysis": json.dumps(core_data, indent=2),
        }

        logger.info(f"Running production analysis for version {version_id}")
        prod_raw = await call_llm(
            behavior="script_production_analysis",
            context=assessment_context,
            file_parts=file_parts,
            response_schema=ProductionAnalysis,
        )
        prod_data = json.loads(prod_raw)
        _store_assessment_results(session_factory, show_id, version_id, prod_data)

        # 7. CREATIVE GENERATION CALL — read the script, write positioning
        creative_context = {
            **context,
            "core_analysis": json.dumps(core_data, indent=2),
        }

        logger.info(f"Running creative positioning for version {version_id}")
        creative_raw = await call_llm(
            behavior="script_creative_positioning",
            context=creative_context,
            file_parts=file_parts,
            response_schema=CreativePositioning,
        )
        creative_data = json.loads(creative_raw)
        _store_creative_results(session_factory, show_id, version_id, creative_data)

        # 8. If previous version exists, run version_diff
        with session_factory() as session:
            previous = (
                session.query(SlateScriptVersion)
                .filter(
                    SlateScriptVersion.show_id == show_id,
                    SlateScriptVersion.id < version_id,
                )
                .order_by(SlateScriptVersion.id.desc())
                .first()
            )
            previous_id = previous.id if previous else None
            previous_file_path = previous.file_path if previous else None
            previous_filename = previous.original_filename if previous else None

        if previous_id:
            try:
                prev_bytes = download_file(previous_file_path)
                prev_text, prev_file_parts = extract_script_content(
                    previous_filename, prev_bytes
                )
                diff_context = {
                    **context,
                    "previous_text": prev_text or "",
                }

                logger.info(f"Running version diff for version {version_id} vs {previous_id}")
                diff_raw = await call_llm(
                    behavior="script_version_diff",
                    context=diff_context,
                    file_parts=file_parts,
                    response_schema=VersionDiff,
                )
                diff_data = json.loads(diff_raw)
                _store_version_diff(session_factory, show_id, version_id, previous_id, diff_data)
            except Exception as e:
                logger.error(f"Version diff failed for version {version_id}: {e}")

        # 9. Set processing status to complete
        with session_factory() as session:
            version = session.query(SlateScriptVersion).get(version_id)
            if version:
                version.processing_status = "complete"
                session.commit()
        logger.info(f"Script processing complete for version {version_id}")

    except Exception as e:
        logger.error(f"Script processing failed for version {version_id}: {e}")
        try:
            with session_factory() as session:
                version = session.query(SlateScriptVersion).get(version_id)
                if version:
                    version.processing_status = "failed"
                    version.processing_error = str(e)
                    session.commit()
        except Exception:
            logger.error(f"Failed to record error for version {version_id}")


async def process_music(session_factory, music_id: int):
    """Process a music file — download, analyze with LLM, write results to SlateMusicFile."""
    try:
        # 1. Get music record and show context
        with session_factory() as session:
            music = session.query(SlateMusicFile).get(music_id)
            if not music:
                logger.error(f"Music file {music_id} not found")
                return
            music.processing_status = "processing"
            script_version_id = music.script_version_id
            file_path = music.file_path
            original_filename = music.original_filename
            track_name = music.track_name or ""
            session.commit()

        with session_factory() as session:
            version = session.query(SlateScriptVersion).get(script_version_id)
            if not version:
                logger.error(f"Script version {script_version_id} not found for music {music_id}")
                return
            show = session.query(SlateShow).get(version.show_id)
            show_id = show.id
            medium_value = show.medium.value if show.medium else ""
            medium_label = show.medium.display_label if show.medium else "Unknown"

            # For musicals, get the song list so the LLM can connect this track to the show's structure
            song_context = ""
            if medium_value == "musical":
                songs = (
                    session.query(SlateSong)
                    .filter_by(show_id=show_id)
                    .order_by(SlateSong.sort_order)
                    .all()
                )
                if songs:
                    song_list = []
                    for s in songs:
                        song_list.append({
                            "title": s.title,
                            "act": s.act,
                            "scene": s.scene,
                            "characters": s.characters,
                            "song_type": s.song_type,
                            "description": s.description,
                        })
                    song_context = (
                        "SONG LIST FROM SCRIPT ANALYSIS (connect this track to the song it corresponds to):\n"
                        + json.dumps(song_list, indent=2)
                    )

            context = {
                "title": show.title,
                "medium": medium_label,
                "genre": show.genre or "Not specified",
                "track_name": track_name,
                "song_context": song_context,
            }

        # 2. Download audio from GCS
        logger.info(f"Downloading music file {file_path} for music {music_id}")
        audio_bytes = download_file(file_path)

        # Determine MIME type from filename
        lower_name = original_filename.lower()
        if lower_name.endswith(".mp3"):
            mime_type = "audio/mpeg"
        elif lower_name.endswith(".wav"):
            mime_type = "audio/wav"
        elif lower_name.endswith(".m4a"):
            mime_type = "audio/mp4"
        elif lower_name.endswith(".ogg"):
            mime_type = "audio/ogg"
        elif lower_name.endswith(".flac"):
            mime_type = "audio/flac"
        else:
            mime_type = "audio/mpeg"

        file_parts = [{"data": audio_bytes, "mime_type": mime_type}]

        # 3. Call LLM with music_analysis behavior
        raw = await call_llm(
            behavior="music_analysis",
            context=context,
            file_parts=file_parts,
            response_schema=MusicAnalysisResult,
        )

        try:
            content = json.loads(raw)
        except json.JSONDecodeError:
            content = {}

        # 4. Write analysis fields directly to the SlateMusicFile record
        with session_factory() as session:
            music = session.query(SlateMusicFile).get(music_id)
            if music and content:
                music.analysis_key = content.get("key")
                music.analysis_tempo = content.get("tempo")
                music.analysis_mood = content.get("mood")
                music.analysis_instrumentation = content.get("instrumentation")
                music.analysis_vocal_range = content.get("vocal_range_required")
                music.analysis_function = content.get("function_in_show")
                music.analysis_emotional_quality = content.get("emotional_quality")
                music.analysis_notes = content.get("notes")
                music.processing_status = "complete"
                session.commit()

        logger.info(f"Music processing complete for music {music_id}")

    except Exception as e:
        logger.error(f"Music processing failed for music {music_id}: {e}")
        try:
            with session_factory() as session:
                music = session.query(SlateMusicFile).get(music_id)
                if music:
                    music.processing_status = "failed"
                    session.commit()
        except Exception:
            logger.error(f"Failed to record error for music {music_id}")


async def process_visual(session_factory, asset_id: int):
    """Process a visual asset — download, analyze with LLM, write results to SlateVisualAsset."""
    try:
        # 1. Get asset record
        with session_factory() as session:
            asset = session.query(SlateVisualAsset).get(asset_id)
            if not asset:
                logger.error(f"Visual asset {asset_id} not found")
                return
            asset.processing_status = "processing"
            show_id = asset.show_id
            file_path = asset.file_path
            original_filename = asset.original_filename
            session.commit()

        # Get show context
        with session_factory() as session:
            show = session.query(SlateShow).get(show_id)
            if not show:
                logger.error(f"Show {show_id} not found for asset {asset_id}")
                return
            medium_label = show.medium.display_label if show.medium else "Unknown"
            context = {
                "title": show.title,
                "medium": medium_label,
                "genre": show.genre or "Not specified",
            }

        # 2. Download image from GCS
        logger.info(f"Downloading visual asset {file_path} for asset {asset_id}")
        image_bytes = download_file(file_path)

        # Determine MIME type from filename
        lower_name = original_filename.lower()
        if lower_name.endswith(".png"):
            mime_type = "image/png"
        elif lower_name.endswith(".jpg") or lower_name.endswith(".jpeg"):
            mime_type = "image/jpeg"
        elif lower_name.endswith(".gif"):
            mime_type = "image/gif"
        elif lower_name.endswith(".webp"):
            mime_type = "image/webp"
        elif lower_name.endswith(".svg"):
            mime_type = "image/svg+xml"
        else:
            mime_type = "image/png"

        file_parts = [{"data": image_bytes, "mime_type": mime_type}]

        # 3. Call LLM with visual_analysis behavior
        raw = await call_llm(
            behavior="visual_analysis",
            context=context,
            file_parts=file_parts,
            response_schema=VisualAnalysisResult,
        )

        try:
            content = json.loads(raw)
        except json.JSONDecodeError:
            content = {}

        # 4. Write analysis fields directly to the SlateVisualAsset record
        with session_factory() as session:
            asset = session.query(SlateVisualAsset).get(asset_id)
            if asset and content:
                asset.analysis_color_palette = content.get("color_palette")
                asset.analysis_mood = content.get("mood")
                asset.analysis_tone = content.get("tone")
                asset.analysis_typography = content.get("typography")
                asset.analysis_visual_themes = content.get("visual_themes")
                asset.analysis_communicates = content.get("communicates")
                asset.analysis_notes = content.get("notes")
                asset.processing_status = "complete"
                session.commit()

        logger.info(f"Visual processing complete for asset {asset_id}")

    except Exception as e:
        logger.error(f"Visual processing failed for asset {asset_id}: {e}")
        try:
            with session_factory() as session:
                asset = session.query(SlateVisualAsset).get(asset_id)
                if asset:
                    asset.processing_status = "failed"
                    session.commit()
        except Exception:
            logger.error(f"Failed to record error for asset {asset_id}")


# --- Pitch and query functions ---

def _gather_show_context(session, show_id: int) -> dict:
    """Gather comprehensive show data for pitch generation and queries.

    Returns a dict with identity fields and all available show data
    from the domain tables for the current script version.
    """
    show = (
        session.query(SlateShow)
        .filter(SlateShow.id == show_id)
        .first()
    )
    if not show:
        return {}

    medium_label = show.medium.display_label if show.medium else "Unknown"
    stage_label = show.development_stage.display_label if show.development_stage else "Unknown"

    ctx = {
        "title": show.title,
        "medium": medium_label,
        "genre": show.genre or "Not specified",
        "logline": show.logline or "Not available",
        "summary": show.summary or "Not available",
        "development_stage": stage_label,
    }

    show_data_sections = []

    # Characters
    characters = (
        session.query(SlateCharacter)
        .filter_by(show_id=show_id)
        .order_by(SlateCharacter.sort_order)
        .all()
    )
    if characters:
        char_list = []
        for c in characters:
            char_dict = {"name": c.name, "description": c.description}
            if c.age_range:
                char_dict["age_range"] = c.age_range
            if c.gender:
                char_dict["gender"] = c.gender
            if c.line_count:
                char_dict["line_count"] = c.line_count
            if c.vocal_range:
                char_dict["vocal_range"] = c.vocal_range
            if c.song_count:
                char_dict["song_count"] = c.song_count
            if c.dance_requirements:
                char_dict["dance_requirements"] = c.dance_requirements
            if c.notes:
                char_dict["notes"] = c.notes
            char_list.append(char_dict)
        show_data_sections.append(f"## character_breakdown\n{json.dumps({'characters': char_list}, indent=2)}")

    # Scenes
    scenes = (
        session.query(SlateScene)
        .filter_by(show_id=show_id)
        .order_by(SlateScene.sort_order)
        .all()
    )
    if scenes:
        # Group by act
        acts_dict = {}
        for s in scenes:
            act_num = s.act_number
            if act_num not in acts_dict:
                acts_dict[act_num] = []
            scene_dict = {"scene_number": s.scene_number}
            if s.title:
                scene_dict["title"] = s.title
            if s.location:
                scene_dict["location"] = s.location
            if s.int_ext:
                scene_dict["int_ext"] = s.int_ext
            if s.time_of_day:
                scene_dict["time_of_day"] = s.time_of_day
            if s.characters_present:
                scene_dict["characters"] = s.characters_present
            if s.description:
                scene_dict["description"] = s.description
            if s.estimated_minutes:
                scene_dict["estimated_minutes"] = s.estimated_minutes
            acts_dict[act_num].append(scene_dict)
        acts_list = [{"act_number": k, "scenes": v} for k, v in acts_dict.items()]
        show_data_sections.append(f"## scene_breakdown\n{json.dumps({'acts': acts_list}, indent=2)}")

    # Songs
    songs = (
        session.query(SlateSong)
        .filter_by(show_id=show_id)
        .order_by(SlateSong.sort_order)
        .all()
    )
    if songs:
        song_list = []
        for s in songs:
            song_dict = {"title": s.title}
            if s.act:
                song_dict["act"] = s.act
            if s.scene:
                song_dict["scene"] = s.scene
            if s.characters:
                song_dict["characters"] = s.characters
            if s.song_type:
                song_dict["song_type"] = s.song_type
            if s.description:
                song_dict["description"] = s.description
            song_list.append(song_dict)
        show_data_sections.append(f"## song_list\n{json.dumps({'songs': song_list}, indent=2)}")

    # Emotional arc
    arc_points = (
        session.query(SlateArcPoint)
        .filter_by(show_id=show_id)
        .order_by(SlateArcPoint.sort_order)
        .all()
    )
    if arc_points:
        points_list = [
            {"position": p.position, "intensity": p.intensity, "label": p.label, "tone": p.tone}
            for p in arc_points
        ]
        arc_data = {"arc_points": points_list}
        if show.emotional_arc_summary:
            arc_data["summary"] = show.emotional_arc_summary
        show_data_sections.append(f"## emotional_arc\n{json.dumps(arc_data, indent=2)}")

    # Runtime estimate
    runtime = (
        session.query(SlateRuntimeEstimate)
        .filter_by(show_id=show_id)
        .first()
    )
    if runtime:
        runtime_dict = {"total_minutes": runtime.total_minutes}
        if runtime.act_breakdown:
            runtime_dict["act_breakdown"] = runtime.act_breakdown
        if runtime.notes:
            runtime_dict["notes"] = runtime.notes
        show_data_sections.append(f"## runtime_estimate\n{json.dumps(runtime_dict, indent=2)}")

    # Cast requirements
    cast = (
        session.query(SlateCastRequirements)
        .filter_by(show_id=show_id)
        .first()
    )
    if cast:
        cast_dict = {}
        if cast.minimum_cast_size:
            cast_dict["minimum_cast_size"] = cast.minimum_cast_size
        if cast.recommended_cast_size:
            cast_dict["recommended_cast_size"] = cast.recommended_cast_size
        if cast.doubling_possibilities:
            cast_dict["doubling_possibilities"] = cast.doubling_possibilities
        if cast.musicians:
            cast_dict["musicians"] = cast.musicians
        if cast.musician_instruments:
            cast_dict["musician_instruments"] = cast.musician_instruments
        if cast.locations_count:
            cast_dict["locations_count"] = cast.locations_count
        if cast.notes:
            cast_dict["notes"] = cast.notes
        show_data_sections.append(f"## cast_requirements\n{json.dumps(cast_dict, indent=2)}")

    # Budget estimate
    budget = (
        session.query(SlateBudgetEstimate)
        .filter_by(show_id=show_id)
        .first()
    )
    if budget:
        budget_dict = {}
        if budget.estimated_range:
            budget_dict["estimated_range"] = budget.estimated_range
        if budget.factors:
            budget_dict["factors"] = budget.factors
        if budget.cast_size_impact:
            budget_dict["cast_size_impact"] = budget.cast_size_impact
        if budget.technical_complexity:
            budget_dict["technical_complexity"] = budget.technical_complexity
        if budget.location_complexity:
            budget_dict["location_complexity"] = budget.location_complexity
        if budget.post_production_notes:
            budget_dict["post_production_notes"] = budget.post_production_notes
        if budget.notes:
            budget_dict["notes"] = budget.notes
        show_data_sections.append(f"## budget_estimate\n{json.dumps(budget_dict, indent=2)}")

    # Content advisories
    advisories = (
        session.query(SlateContentAdvisory)
        .filter_by(show_id=show_id)
        .all()
    )
    if advisories:
        adv_list = [
            {"category": a.category, "description": a.description, "severity": a.severity}
            for a in advisories
        ]
        show_data_sections.append(f"## content_advisories\n{json.dumps({'advisories': adv_list}, indent=2)}")

    # Comparables
    comparables = (
        session.query(SlateComparable)
        .filter_by(show_id=show_id)
        .all()
    )
    if comparables:
        comp_list = [
            {"title": c.title, "relationship": c.relationship_type, "reasoning": c.reasoning}
            for c in comparables
        ]
        show_data_sections.append(f"## comparables\n{json.dumps({'comparables': comp_list}, indent=2)}")

    # Logline drafts
    loglines = (
        session.query(SlateLoglineDraft)
        .filter_by(show_id=show_id)
        .all()
    )
    if loglines:
        ll_list = [{"text": l.text, "tone": l.tone} for l in loglines]
        show_data_sections.append(f"## logline_drafts\n{json.dumps({'options': ll_list}, indent=2)}")

    # Summary drafts
    summaries = (
        session.query(SlateSummaryDraft)
        .filter_by(show_id=show_id)
        .all()
    )
    if summaries:
        sum_list = [{"summary": s.summary_text} for s in summaries]
        show_data_sections.append(f"## summary_drafts\n{json.dumps(sum_list, indent=2)}")

    # Visual analysis data (from asset records)
    visual_assets = (
        session.query(SlateVisualAsset)
        .filter_by(show_id=show_id)
        .filter(SlateVisualAsset.processing_status == "complete")
        .all()
    )
    for va in visual_assets:
        va_dict = {}
        if va.analysis_color_palette:
            va_dict["color_palette"] = va.analysis_color_palette
        if va.analysis_mood:
            va_dict["mood"] = va.analysis_mood
        if va.analysis_tone:
            va_dict["tone"] = va.analysis_tone
        if va.analysis_typography:
            va_dict["typography"] = va.analysis_typography
        if va.analysis_visual_themes:
            va_dict["visual_themes"] = va.analysis_visual_themes
        if va.analysis_communicates:
            va_dict["communicates"] = va.analysis_communicates
        if va.analysis_notes:
            va_dict["notes"] = va.analysis_notes
        if va_dict:
            show_data_sections.append(
                f"## visual_analysis (asset {va.id}: {va.label})\n{json.dumps(va_dict, indent=2)}"
            )

    # Music analysis data (from music file records)
    current_version = (
        session.query(SlateScriptVersion)
        .filter(SlateScriptVersion.show_id == show_id)
        .order_by(SlateScriptVersion.created_at.desc())
        .first()
    )
    if current_version:
        music_files = (
            session.query(SlateMusicFile)
            .filter_by(script_version_id=current_version.id)
            .filter(SlateMusicFile.processing_status == "complete")
            .order_by(SlateMusicFile.sort_order)
            .all()
        )
        for mf in music_files:
            mf_dict = {}
            if mf.analysis_key:
                mf_dict["key"] = mf.analysis_key
            if mf.analysis_tempo:
                mf_dict["tempo"] = mf.analysis_tempo
            if mf.analysis_mood:
                mf_dict["mood"] = mf.analysis_mood
            if mf.analysis_instrumentation:
                mf_dict["instrumentation"] = mf.analysis_instrumentation
            if mf.analysis_vocal_range:
                mf_dict["vocal_range"] = mf.analysis_vocal_range
            if mf.analysis_function:
                mf_dict["function"] = mf.analysis_function
            if mf.analysis_emotional_quality:
                mf_dict["emotional_quality"] = mf.analysis_emotional_quality
            if mf.analysis_notes:
                mf_dict["notes"] = mf.analysis_notes
            if mf_dict:
                show_data_sections.append(
                    f"## music_analysis (track {mf.id}: {mf.track_name})\n{json.dumps(mf_dict, indent=2)}"
                )

    # Milestones
    milestones = (
        session.query(SlateMilestone)
        .filter(SlateMilestone.show_id == show_id)
        .order_by(SlateMilestone.date.desc())
        .limit(20)
        .all()
    )
    if milestones:
        milestone_lines = []
        for m in milestones:
            date_str = m.date.isoformat() if m.date else "no date"
            type_label = ""
            if m.milestone_type:
                type_label = f" [{m.milestone_type.display_label}]"
            milestone_lines.append(f"- {date_str}{type_label}: {m.title}")
            if m.description:
                milestone_lines.append(f"  {m.description}")
        show_data_sections.append("## recent_milestones\n" + "\n".join(milestone_lines))

    ctx["show_context"] = "\n\n".join(show_data_sections) if show_data_sections else "No analysis data available yet."
    return ctx


async def generate_pitch(session_factory, show_id: int, audience_type: str,
                         target_producer_id: int | None = None) -> dict:
    """Generate a pitch for a show tailored to an audience type.

    Creates a SlatePitch record and populates it with AI-generated content.
    Returns the pitch dict.
    """
    # 1. Gather all show data
    with session_factory() as session:
        ctx = _gather_show_context(session, show_id)
        if not ctx:
            raise ValueError(f"Show {show_id} not found")

        # Resolve audience_type to lookup value for the pitch record
        audience_lv = (
            session.query(SlateLookupValue)
            .filter_by(category="audience_type", entity_type="pitch", value=audience_type)
            .first()
        )
        audience_type_id = audience_lv.id if audience_lv else None

        # Resolve draft status
        draft_lv = (
            session.query(SlateLookupValue)
            .filter_by(category="pitch_status", entity_type="pitch", value="draft")
            .first()
        )
        draft_status_id = draft_lv.id if draft_lv else None

    ctx["audience_type"] = audience_type

    # 2. If target_producer_id, get producer profile via MCP
    producer_profile = "Not targeting a specific producer."
    if target_producer_id:
        try:
            from shared.backend.mcp import mcp_server
            result = await mcp_server.call_tool(
                "producers_get_record",
                {"producer_id": target_producer_id},
            )
            if result:
                # Extract text content from MCP result
                if hasattr(result, "content") and result.content:
                    parts = []
                    for block in result.content:
                        if hasattr(block, "text"):
                            parts.append(block.text)
                    producer_profile = "\n".join(parts) if parts else str(result)
                else:
                    producer_profile = str(result)
        except Exception as e:
            logger.warning(f"Failed to fetch producer {target_producer_id} via MCP: {e}")
            producer_profile = f"(Producer ID {target_producer_id} — profile unavailable)"

    ctx["producer_profile"] = producer_profile

    # 3. Call LLM
    logger.info(f"Generating {audience_type} pitch for show {show_id}")
    raw = await call_llm(behavior="pitch_generate", context=ctx)

    # 4. Create SlatePitch record
    with session_factory() as session:
        pitch = SlatePitch(
            show_id=show_id,
            audience_type_id=audience_type_id,
            target_producer_id=target_producer_id,
            title=f"{ctx['title']} — {audience_type.replace('_', ' ').title()} Pitch",
            content=raw,
            status_id=draft_status_id,
            generated_by="system",
        )
        session.add(pitch)
        session.flush()
        pitch_id = pitch.id
        session.commit()

    logger.info(f"Pitch {pitch_id} generated for show {show_id}")
    return {
        "id": pitch_id,
        "show_id": show_id,
        "audience_type": audience_type,
        "title": f"{ctx['title']} — {audience_type.replace('_', ' ').title()} Pitch",
        "status": "draft",
        "generated_by": "system",
    }


async def generate_one_pager(session_factory, show_id: int, pitch_id: int) -> str:
    """Generate a one-page pitch document from an existing pitch.

    Returns the generated one-pager content as text.
    """
    with session_factory() as session:
        pitch = session.query(SlatePitch).filter(
            SlatePitch.id == pitch_id,
            SlatePitch.show_id == show_id,
        ).first()
        if not pitch:
            raise ValueError(f"Pitch {pitch_id} not found for show {show_id}")

        show = session.query(SlateShow).get(show_id)
        if not show:
            raise ValueError(f"Show {show_id} not found")

        context = {
            "title": show.title,
            "pitch_content": pitch.content or "No pitch content available.",
        }

    raw = await call_llm(behavior="pitch_one_pager", context=context)
    return raw


async def run_show_query(session_factory, show_id: int, query: str) -> str:
    """Answer a natural language question about a specific show using MCP.

    The LLM has access to all Intelligence MCP tools and can look up
    any data about the show to answer the question.
    """
    with session_factory() as session:
        show = session.query(SlateShow).get(show_id)
        if not show:
            raise ValueError(f"Show {show_id} not found")

        context = {
            "show_title": show.title,
            "show_id": str(show_id),
            "query": query,
        }

    logger.info(f"Running show query for show {show_id}: {query[:100]}")
    result = await call_llm(behavior="show_query", context=context, use_mcp=True)
    return result


async def run_slate_query(session_factory, query: str) -> str:
    """Answer a natural language question across the entire slate using MCP.

    The LLM has access to all Intelligence MCP tools and can search
    across shows, compare data, and synthesize answers.
    """
    context = {
        "query": query,
    }

    logger.info(f"Running slate query: {query[:100]}")
    result = await call_llm(behavior="slate_query", context=context, use_mcp=True)
    return result
