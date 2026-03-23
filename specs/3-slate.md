# Intelligence — Slate Tool Spec

System of record for WN's own projects and their development history. The script is the source of truth — upload a script and the system derives everything else.

Slate is not a generic show database. Producers already has that — it tracks any theatrical work a producer has been involved with. Slate is specifically WN's development slate: the projects WN is creating, developing, and producing across theatre, film, and TV. Every show here is a WN project.

## Dependencies

Slate uses the shared infrastructure (auth, DB, MCP, AI clients, GCS, scheduler). It does not depend on any other tool being built first — except that Producers will exist by the time Slate is built, which enables personalized producer pitches.

## Data Model

What Slate owns. Its own database (`intelligence_slate`). All tables defined here are built in Phase 1, even if the features that populate some of them come in later phases. This prevents schema retrofitting.

### Show

The top-level entity. A WN project.

- Title
- Medium — musical, play, screenplay, teleplay, feature film, short film, limited series, other (lookup value)
- Genre — prose
- Logline — one-to-two sentence pitch (can be generated from script, human-refined)
- Summary — longer description (can be generated from script, human-refined)
- Rights status — original, optioned, public domain adaptation (lookup value)
- Development stage — early development, internal read, workshop, staged reading, table read, seeking production, in pre-production, in production, running, in post-production, released, closed (lookup value). Lives on the show, not the script version. A show can have multiple script versions within the same stage. Stages are medium-aware — "running" applies to theatre, "in post-production" applies to film/TV. The lookup values cover all mediums; the frontend can filter by relevance.
- Created, updated timestamps

### Script Versions

Each show has an ordered history of script uploads. A script version is an uploaded file.

- Show reference
- Version label — human-readable ("First Draft", "Post-Workshop Draft", "Pre-Production Draft")
- File path (GCS) and original file name
- Upload date
- Change notes — what changed from the previous version (human-entered on upload)
- Processing status — pending, processing, complete, failed
- Processing error detail
- Created timestamp

### Music Files

For musicals, music is part of the work. For film/TV, a score or temp tracks may be relevant. Music files are tied to the script version they correspond to.

- Script version reference
- File path (GCS) and original file name
- Track name — human-readable label ("Opening Number Demo", "Act 2 Finale Piano/Vocal")
- Track type — demo recording, rehearsal track, piano/vocal score, orchestration, score, temp track, other (lookup value)
- Description — optional notes
- Sort order
- Processing status — pending, processing, complete, failed
- Created timestamp

### Show Data

Structured data derived from scripts, music, and visual assets. Each data type is a separate record tied to a source (script version, music file, or visual asset), so they can be regenerated independently. All data is editable — if the system gets something wrong, the team corrects it.

- Source type — script_version, music_file, visual_asset
- Source ID — reference to the specific script version, music file, or visual asset
- Data type — character_breakdown, scene_breakdown, song_list, runtime_estimate, cast_requirements, budget_estimate, logline_draft, summary_draft, comparables, content_advisories, version_diff, emotional_arc, music_analysis, visual_analysis (lookup value)
- Content — JSONB, structure varies by type (see data type definitions below)
- Generated at timestamp
- Model used — which LLM produced this data

### Development Milestones

Events in the show's life — readings, workshops, submissions, screenings, pitch meetings, shoot days.

- Show reference
- Script version reference (optional — which version was current at this milestone)
- Title — "Internal Read", "Workshop at NYTW", "Submitted to O'Neill", "Table Read via Zoom"
- Date
- Description — notes, outcomes, observations
- Milestone type — internal read, workshop, staged reading, table read, showcase, submission, festival, pitch meeting, location scout, shoot day, screening, other (lookup value)
- Created timestamp

Participant tracking (who was at the milestone) is deferred until the people-tracking tools exist (Audience, Collaborators, Producers). See Deferred Features.

### Visual Identity Assets

Each show has its own visual brand — logo, key art, mood boards, color palette references, typography samples. These are IP brands — Vlad's visual world is completely different from Divide Theory's.

- Show reference
- File path (GCS) and original file name
- Asset type — logo, key_art, mood_board, color_palette, typography, reference_image, other (lookup value)
- Label — human-readable name
- Version — for assets that evolve (logo v1, logo v2)
- Is current — boolean, marks the active version of each asset type
- Processing status — pending, processing, complete, failed
- Created timestamp

When a visual asset is uploaded, the system analyzes it — extracting color palette, mood, tone, typography, visual themes. This understanding becomes part of the show's data (stored in the Show Data table with source_type `visual_asset`).

### Pitches

Slate owns pitch creation. A pitch is a document about a show, tailored to an audience type. The system can draft one from the show's data, or a human can write one from scratch.

- Show reference
- Audience type — producer, investor, grant_maker, festival, general (lookup value)
- Target producer ID — optional, for personalized producer pitches (references a producer in the Producers tool via MCP)
- Title — human-readable label for this pitch
- Content — the pitch text (editable regardless of how it was created)
- Status — draft, final (lookup value)
- Generated by — "system" or user email
- Created, updated timestamps

### Pitch Materials

File attachments to a pitch — one-pagers, decks, supporting documents.

- Pitch reference
- File path (GCS) and original file name
- Material type — one_pager, deck, budget_summary, timeline, other (lookup value)
- Label
- Created timestamp

### Lookup Values

Same pattern as Producers. Soft enums stored in the database, managed via UI.

- Category, entity type, value, display label, sort order, description, CSS class

Categories: medium (show), rights_status (show), development_stage (show), track_type (music_file), data_type (show_data), milestone_type (milestone), asset_type (visual_asset), audience_type (pitch), pitch_status (pitch), material_type (pitch_material).

### Change History

Same pattern as Producers. Field-level change tracking across all entity types.

- Entity type, entity ID, field name, old value, new value, changed by, changed at

### AI Behaviors

Same pattern as Producers. Runtime-editable prompt configurations. Each tool has its own `ai.py` that imports the shared AI clients and reads from its own `ai_behaviors` table.

- Name (unique), display label, system prompt, user prompt, model, created, updated

### Settings

Tool-level configuration.

- Key (unique), value (JSONB), updated at

## GCS Storage Layout

```
slate/
    shows/{show_id}/
        scripts/{version_id}/{filename}
        music/{version_id}/{filename}
        visual/{asset_type}/{filename}
        pitches/{pitch_id}/{filename}
```

## Seed Data

Create `scripts/seed_slate_data.yml` with all Slate lookup values: mediums (musical, play, screenplay, teleplay, feature film, short film, limited series), development stages (all 12), rights statuses, track types, data types, milestone types, asset types, audience types, pitch statuses, material types. Load into the `intelligence_slate` database via `scripts/seed_data.py` or a separate `scripts/seed_slate_data.py`.

## Pre-Build: Shared Component

**Build `EntityNav` shared React component.** The design system spec defines the `entity-nav` CSS/HTML pattern. Build `shared/frontend/components/EntityNav.jsx`. Props: entity title, back link (text + path), nav links (array of {label, path}). Uses React Router's `NavLink` for active state. Shared because other tools (Casting, Talent) will use the same pattern.

## Build Phases

The data model above is complete. All tables are created in Phase 1. Each phase is a complete, working increment.

---

## Phase 1: Core CRUD + File Storage

Shows exist, scripts and assets can be uploaded, milestones are trackable. No processing on upload yet.

### Supported File Formats

**Scripts:** PDF, DOCX, and FDX (Final Draft). The upload route validates the file extension and stores the original file in GCS.

**Music:** MP3, WAV, AIFF, M4A, FLAC. Standard audio formats.

**Visual assets:** PNG, JPG, SVG, PDF. Standard image formats.

### Backend

**Models** — All tables from the data model above. Created at startup.

**Interface** — `SlateInterface` class with session factory and MCP server. Registers initial MCP tools.

**MCP Tools (Phase 1):**

1. `slate_list_shows` — List all WN shows with title, medium, genre, logline, development stage. Supports search by title, filter by stage and medium.
2. `slate_get_show` — Full show profile: identity, development stage, current script version, milestones, visual identity assets, and all show data for the current version.
3. `slate_get_script` — Script version details including file download URL (signed GCS URL), change notes, music files, and show data derived from this version.
4. `slate_get_show_summary` — The show's current logline, summary, comparables, and development stage — the information other tools most commonly need.

**Routes** — All endpoints under `/api/slate/*`:

*Shows:*
- `GET /api/slate/shows` — List shows (search, filter by stage/medium, sort, paginate)
- `POST /api/slate/shows` — Create show
- `GET /api/slate/shows/{show_id}` — Get show (includes current version's data)
- `PUT /api/slate/shows/{show_id}` — Update show (including stage transitions)
- `DELETE /api/slate/shows/{show_id}` — Delete show

*Script Versions:*
- `GET /api/slate/shows/{show_id}/scripts` — List versions for a show
- `POST /api/slate/shows/{show_id}/scripts` — Upload new version (multipart file upload → GCS)
- `GET /api/slate/shows/{show_id}/scripts/{version_id}` — Get version details
- `PUT /api/slate/shows/{show_id}/scripts/{version_id}` — Update version metadata (label, change notes)
- `DELETE /api/slate/shows/{show_id}/scripts/{version_id}` — Delete version
- `GET /api/slate/shows/{show_id}/scripts/{version_id}/download` — Download script (signed URL redirect)

*Music Files:*
- `GET /api/slate/shows/{show_id}/scripts/{version_id}/music` — List music for a script version
- `POST /api/slate/shows/{show_id}/scripts/{version_id}/music` — Upload music file (multipart → GCS)
- `PUT /api/slate/shows/{show_id}/scripts/{version_id}/music/{music_id}` — Update metadata (track name, type, description)
- `DELETE /api/slate/shows/{show_id}/scripts/{version_id}/music/{music_id}` — Delete music file
- `GET /api/slate/shows/{show_id}/scripts/{version_id}/music/{music_id}/download` — Download (signed URL)
- `PUT /api/slate/shows/{show_id}/scripts/{version_id}/music/reorder` — Reorder tracks

*Milestones:*
- `GET /api/slate/milestones/recent` — Recent milestones across all shows (for dashboard)
- `GET /api/slate/shows/{show_id}/milestones` — List milestones for a show
- `POST /api/slate/shows/{show_id}/milestones` — Create milestone
- `PUT /api/slate/shows/{show_id}/milestones/{milestone_id}` — Update milestone
- `DELETE /api/slate/shows/{show_id}/milestones/{milestone_id}` — Delete milestone

*Visual Identity:*
- `GET /api/slate/shows/{show_id}/visual` — List assets for a show
- `POST /api/slate/shows/{show_id}/visual` — Upload asset (multipart → GCS)
- `PUT /api/slate/shows/{show_id}/visual/{asset_id}` — Update metadata (label, version, is_current)
- `DELETE /api/slate/shows/{show_id}/visual/{asset_id}` — Delete asset
- `GET /api/slate/shows/{show_id}/visual/{asset_id}/download` — Download (signed URL)

*Lookup Values:*
- `GET /api/slate/lookup-values` — List by category/entity_type
- `GET /api/slate/lookup-values/{id}` — Get single lookup value
- `POST /api/slate/lookup-values` — Create
- `PUT /api/slate/lookup-values/{id}` — Update
- `PUT /api/slate/lookup-values/reorder` — Reorder
- `DELETE /api/slate/lookup-values/{id}` — Delete (blocked if referenced)

*Settings:*
- `GET /api/slate/settings` — Get settings
- `PUT /api/slate/settings` — Update settings

### Frontend

**Two-level navigation model:**

**Level 1 — Tool sidebar** (same pattern as Producers). Always visible:
- Dashboard
- **Slate:** All Shows
- **Data:** Options
- **Advanced:** AI Configuration (Phase 2)
- **Footer:** Settings

Quick Add (create a show) always available at the top.

**Level 2 — Entity nav bar** (`entity-nav` shared component). Appears when the user enters a show. Persistent horizontal bar at the top of the content area with the show's title on the left, section links on the right. The tool sidebar stays in place. Each link routes to a real page.

Entity nav links (Phase 1):
- Overview, Characters, Structure, Milestones, Visual Identity, Scripts / Book & Score

The page label for scripts adapts to the medium: "Book & Score" for musicals, "Script" for plays and screenplays, "Script" for film/TV.

Added in later phases:
- Pitches (Phase 3), AI Query (Phase 3)

**Version system** is a Phase 2 feature — see Phase 2 Frontend Additions.

**Pages:**

**Dashboard** — The creative portfolio at a glance. Two-column layout: main column shows project cards for each show (title in display type, medium + stage badges, logline as prose, footer with last milestone and current script version; accent border by medium). Sidebar has a "Needs Attention" surfacing panel (shows stalled >60 days, shows with no script) and a "Recent Activity" timeline of milestones across all shows. Not a database report — organized around what matters and what needs attention.

**Show List** — All WN shows, searchable, filterable by development stage and medium, sortable. Each row: title, medium badge, stage progression (compact), current script version, last updated.

**Create Show** — Form: title (required), medium, genre, logline, summary, rights status, initial development stage.

**Show > Overview** — Read-only view of the show's identity and current state. Hero section: title (display-1 typography), medium + stage + rights status badges, ActionMenu (Edit, Delete). Full `stage-progression` indicator below the hero. Two-column layout: main column has logline and summary as readable prose (not form fields), stat grid (empty until Phase 2), and producing info (empty until Phase 2). Sidebar has compact cards for Details (genre, medium, stage, rights status as labeled values), Current Script (version label + date), and Recent Milestones (last 3). Editing happens on a separate Edit page (`/slate/shows/{id}/edit`) — the overview is for reading, not for editing.

**Show > Edit** — Form page for editing a show's metadata. Breadcrumbs (All Shows > show title > Edit). Field stack: title, medium, development stage, rights status, genre, logline, summary. Save navigates back to overview.

**Show > Characters** — Empty state in Phase 1. Populated in Phase 2 when a script is uploaded.

**Show > Structure** — Empty state in Phase 1. Populated in Phase 2 when a script is uploaded.

**Show > Milestones** — Development timeline. Each milestone: title, date, type badge, description, linked script version. Add/edit/delete milestones. Reverse chronological.

**Show > Visual Identity** — The show's brand. Asset gallery (thumbnail grid) grouped by asset type (Logo, Key Art, Mood Board, Reference). Upload card in the grid. "Primary" overlay badge on the current version of each type. Hover actions: download, delete, set as primary.

**Show > Scripts / Book & Score** — Script file management. Version history: each version shows label, date, change notes, download link, processing status. Upload new version. Music files per version: list with upload, reorder, download, delete. This page manages the artifacts — the files themselves and their metadata.

**Options** — Lookup value management, same pattern as Producers.

**Settings** — Tool configuration.

### Wiring in `app.py`

- `intelligence_slate` database and tables created via `scripts/setup_db.py` (handles database creation automatically)
- `SlateInterface` instantiated with session factory and MCP server
- Registered in tool registry: name "Slate", path `/slate`
- Routes mounted at `/api/slate/*`
- Frontend route: `/slate/*` lazy-loads `SlatePage`

### Verification

- App boots with `intelligence_slate` database and all tables created
- 4 MCP tools registered
- All routes registered under `/api/slate/*`
- Can create a show, update it, delete it
- Can upload a script file to GCS and download it via signed URL
- Can upload music files and visual assets to GCS
- Can create, update, delete milestones
- Can manage lookup values
- Frontend builds cleanly with all entity nav pages rendering
- Empty states display correctly on Characters, Structure, Overview stat grid
- Entity nav bar appears when inside a show, sidebar stays in place
- Seed data loaded — all dropdowns populated

---

## Phase 2: Script-Driven Show Data

Upload a script, the show populates. Characters, scenes, songs, runtime, budget picture, comparables — all derived from the script. Upload music or visual assets, the show's understanding deepens. Upload a new script version, the show updates.

### What Happens on Script Upload

When a script version is uploaded, the system reads it and populates the show's data in the background:

1. Set `processing_status = "processing"` on the script version
2. Read the script file from GCS
3. For PDF: pass file bytes directly to Gemini (native PDF support). For DOCX: extract text via python-docx. For FDX: parse the XML (dialogue, action, scene headings are tagged elements).
4. Derive each data type as a separate LLM call (can be parallelized)
5. Store results in the Show Data table
6. If this isn't the first version, generate a version diff against the previous version
7. Set `processing_status = "complete"` (or "failed" with error detail)

### What Happens on Music Upload

When a music file is uploaded, the system listens to it:

1. Set `processing_status = "processing"` on the music file
2. Read the audio file from GCS
3. Derive: key, tempo, mood, instrumentation, vocal range requirements, how the track functions in the show, what it conveys emotionally
4. Store as a `music_analysis` record in Show Data
5. Set `processing_status = "complete"`

### What Happens on Visual Asset Upload

When a visual asset is uploaded, the system looks at it:

1. Set `processing_status = "processing"` on the visual asset
2. Read the image from GCS
3. Derive: color palette, mood, tone, typography (if text is present), visual themes, what the imagery communicates
4. Store as a `visual_analysis` record in Show Data
5. Set `processing_status = "complete"`

### Data Types Derived from Scripts (JSONB)

**character_breakdown:**
```json
{
  "characters": [
    {
      "name": "string",
      "description": "string",
      "age_range": "string",
      "gender": "string",
      "line_count": "number (approximate)",
      "song_count": "number (musicals)",
      "vocal_range": "string (musicals)",
      "dance_requirements": "string",
      "notes": "string"
    }
  ]
}
```

**scene_breakdown:**
```json
{
  "acts": [
    {
      "act_number": "number (null for film/TV without act structure)",
      "scenes": [
        {
          "scene_number": "number",
          "title": "string (if any)",
          "location": "string",
          "int_ext": "string (INT/EXT — film/TV)",
          "time_of_day": "string (film/TV)",
          "characters": ["string"],
          "description": "string",
          "estimated_minutes": "number"
        }
      ]
    }
  ]
}
```

**song_list** (musicals only — skipped for non-musical mediums):
```json
{
  "songs": [
    {
      "title": "string",
      "act": "number",
      "scene": "number",
      "characters": ["string"],
      "song_type": "string (I want, conflict, charm, eleven o'clock, opening, finale, etc.)",
      "description": "string"
    }
  ]
}
```

**emotional_arc:**
```json
{
  "arc_points": [
    {
      "position": "number (0-100, percentage through the show)",
      "intensity": "number (0-100)",
      "label": "string (scene or moment identifier)",
      "tone": "string (comedic, tense, intimate, triumphant, etc.)"
    }
  ],
  "summary": "string"
}
```

**runtime_estimate:**
```json
{
  "total_minutes": "number",
  "act_breakdown": [{"act": "number", "minutes": "number"}],
  "notes": "string"
}
```

**cast_requirements:**
```json
{
  "minimum_cast_size": "number",
  "recommended_cast_size": "number",
  "doubling_possibilities": "string (theatre)",
  "musicians": "number (musicals)",
  "musician_instruments": ["string (musicals)"],
  "locations_count": "number (film/TV)",
  "notes": "string"
}
```

**budget_estimate:**
```json
{
  "estimated_range": "string (e.g. '$2M-$4M')",
  "factors": ["string (what drives the cost)"],
  "cast_size_impact": "string",
  "technical_complexity": "string",
  "location_complexity": "string (film/TV)",
  "post_production_notes": "string (film/TV)",
  "notes": "string"
}
```

**logline_draft:**
```json
{
  "options": [
    {"text": "string", "tone": "string (commercial, literary, etc.)"}
  ]
}
```

**summary_draft:**
```json
{
  "summary": "string (2-3 paragraphs)"
}
```

**comparables:**
```json
{
  "comparables": [
    {
      "title": "string",
      "relationship": "string (structurally similar, thematic overlap, tonal match, etc.)",
      "reasoning": "string"
    }
  ]
}
```

**content_advisories:**
```json
{
  "advisories": [
    {"category": "string", "description": "string", "severity": "string"}
  ]
}
```

**version_diff** (only when previous version exists):
```json
{
  "summary": "string",
  "structural_changes": ["string"],
  "character_changes": ["string"],
  "song_changes": ["string (musicals)"],
  "tone_shift": "string",
  "notes": "string"
}
```

**music_analysis:**
```json
{
  "key": "string",
  "tempo": "string",
  "mood": "string",
  "instrumentation": ["string"],
  "vocal_range_required": "string",
  "function_in_show": "string (opening number, ballad, comedic patter, etc.)",
  "emotional_quality": "string",
  "notes": "string"
}
```

**visual_analysis:**
```json
{
  "color_palette": ["string (descriptive, not hex codes)"],
  "mood": "string",
  "tone": "string",
  "typography": "string (if text present)",
  "visual_themes": ["string"],
  "communicates": "string (what the imagery says about the show)",
  "notes": "string"
}
```

### AI Behaviors (Phase 2)

Stored in `ai_behaviors` table, editable at runtime:

- `script_character_breakdown` — Extract characters with descriptions, age ranges, line counts, vocal ranges
- `script_scene_breakdown` — Extract act/scene structure with locations, characters, timing
- `script_song_list` — Extract song list with placement, characters, song types (musicals only)
- `script_emotional_arc` — Map the emotional trajectory across the show
- `script_runtime_estimate` — Estimate runtime from structural data
- `script_cast_requirements` — Analyze minimum cast, doubling, musician needs
- `script_budget_estimate` — Estimate budget range from structural and technical data
- `script_logline` — Generate logline options from the script
- `script_summary` — Generate a summary from the script
- `script_comparables` — Identify comparable works with reasoning
- `script_content_advisories` — Identify content that may need advisories
- `script_version_diff` — Compare two script versions structurally
- `music_analysis` — Analyze a music track: key, tempo, mood, instrumentation, vocal demands, emotional quality
- `visual_analysis` — Analyze a visual asset: color palette, mood, tone, visual themes, what it communicates

Each behavior has a system prompt and user prompt. The user prompt receives the content plus show metadata (including medium) as context. The system adapts based on the medium — scene breakdown uses INT/EXT for screenplays, song analysis is skipped for non-musicals, budget estimates factor in post-production for film/TV.

### Backend Additions

**Routes:**
- `GET /api/slate/shows/{show_id}/data` — All show data for the current (or specified) version
- `GET /api/slate/shows/{show_id}/data/{data_type}` — Specific data type
- `POST /api/slate/shows/{show_id}/data` — Create show data manually (e.g. add characters before uploading a script)
- `PUT /api/slate/shows/{show_id}/data/{data_id}` — Edit show data
- `DELETE /api/slate/shows/{show_id}/data/{data_id}` — Delete a show data record
- `POST /api/slate/shows/{show_id}/scripts/{version_id}/reprocess` — Re-derive all data from this version
- `POST /api/slate/shows/{show_id}/scripts/{version_id}/reprocess/{data_type}` — Re-derive a single data type

**Modify upload routes** (scripts, music, visual) to trigger background processing.

**MCP Tools (Phase 2 additions):**

5. `slate_get_characters` — Character breakdown for a show's current script version.
6. `slate_get_structure` — Scene breakdown for a show's current script version.

### Frontend Additions

**Version system:**
Every page displays a version label showing which script version the data is based on (e.g. "Based on Post-Workshop Draft · Feb 2026"). Always visible but unobtrusive. Default is always the latest version.

To view the show at a historical version, click the version label on any page. This opens a modal confirming that all pages will switch to the selected version. When viewing a historical version, a persistent visual indicator makes it clear you're not looking at the current state. "Back to latest" always available.

All show data comes from whichever version is selected. If the current version is still being processed, show what's ready and indicate what's still loading.

**Show > Overview — now populated:**
- Stat grid: cast size, runtime, budget range
- Comparables section
- Content advisories as compact alerts
- Producing info: budget estimate with factors, cast requirements, technical complexity
- Logline: if not set, show generated options with "Use this" action
- Summary: if not set, show generated summary with "Use this" action
- Each field: "Edit" and "Regenerate from script" actions

**Show > Characters — now populated:**
- Characters displayed as a table or card list: name, description, age range, gender, vocal range (musicals), dance requirements, line count, song count (musicals), notes
- All editable. Add/remove characters manually.

**Show > Structure — now populated:**
- Act/scene breakdown with locations, characters per scene, estimated timing
- Song list with placement, characters, song types (musicals)
- Read-only emotional arc visualization (custom Slate component)

**Show > Visual Identity updates:**
- Each asset now shows the system's understanding alongside the thumbnail — mood, tone, visual themes
- Editable like everything else

**Show > Scripts / Book & Score updates:**
- Each version shows processing status (ready, updating, failed)
- When the show is updating after an upload, show which parts are ready and which are still loading
- Music files show their analysis (key, tempo, mood, function) inline

**AI Configuration page:**
- Lists all behaviors with model selection and prompt editing
- Same pattern as Producers

### Verification

- Uploading a PDF script populates the show — characters, scenes, runtime, budget, comparables appear
- Uploading a DOCX script works the same way
- Uploading an FDX script works the same way
- Uploading a music file produces analysis (key, tempo, mood, function)
- Uploading a visual asset produces analysis (palette, mood, themes)
- Version label appears on every page, shows the current version
- Switching to a historical version via modal updates all pages
- Characters page shows editable character data
- Structure page shows scene breakdown and emotional arc visualization
- Overview stat grid and producing info populated
- Processing status visible while show is updating
- Can manually edit any show data
- Can regenerate from script per field
- AI Configuration page lists all 14 behaviors with editable prompts

---

## Phase 3: Pitches + On-Demand AI

Pitches are documents about the show tailored to different audiences. The system can draft them from the show's data, or a human can write them from scratch. For the producer audience type, pitches can be personalized to a specific producer using data from the Producers tool (which exists by this point).

### Pitch Drafting

The system drafts pitch content from what Slate knows about the show:
- Identity (logline, summary, genre, development stage)
- Characters and structure
- Budget picture and cast requirements
- Comparables and content advisories
- Milestone history (development progress)
- Visual identity understanding (the show's visual brand and tone)
- Music understanding (the score's character)

The pitch emphasis shifts by audience type:
- **Producer** — creative vision, comparable successes, development maturity. Can be personalized to a specific producer by pulling their profile from Producers via MCP (taste, track record, financial profile, relationship with WN).
- **Investor** — budget, market comparable performances, timeline to production
- **Grant-maker** — artistic merit, social relevance, mission alignment, development plan
- **Festival** — development stage, what the reading/workshop would accomplish
- **General** — balanced overview

### AI Behaviors (Phase 3)

- `pitch_generate` — Draft pitch content for a show tailored to an audience type. Context: show data, audience type, optional producer profile.
- `pitch_one_pager` — Generate a one-page pitch document
- `slate_query` — On-demand querying across the slate. Natural language interface with MCP access to Slate's own tools.
- `show_query` — On-demand querying about a specific show. Same as slate_query but scoped to one show.

### Backend Additions

**Routes:**
- `GET /api/slate/shows/{show_id}/pitches` — List pitches for a show
- `POST /api/slate/shows/{show_id}/pitches` — Create a pitch (manual)
- `POST /api/slate/shows/{show_id}/pitches/generate` — Generate pitch with audience type and optional target producer ID
- `GET /api/slate/shows/{show_id}/pitches/{pitch_id}` — Get pitch
- `PUT /api/slate/shows/{show_id}/pitches/{pitch_id}` — Update pitch content
- `DELETE /api/slate/shows/{show_id}/pitches/{pitch_id}` — Delete pitch
- `GET /api/slate/shows/{show_id}/pitches/{pitch_id}/materials` — List materials for a pitch
- `POST /api/slate/shows/{show_id}/pitches/{pitch_id}/materials` — Upload material (multipart → GCS)
- `DELETE /api/slate/shows/{show_id}/pitches/{pitch_id}/materials/{material_id}` — Delete material
- `GET /api/slate/shows/{show_id}/pitches/{pitch_id}/materials/{material_id}/download` — Download (signed URL)
- `POST /api/slate/query` — Slate-level AI query
- `POST /api/slate/shows/{show_id}/query` — Show-level AI query

**MCP Tools (Phase 3 additions):**

7. `slate_get_pitch` — Get a pitch for a show by audience type.
8. `slate_get_budget_estimate` — Budget estimate for the current script version.

### Frontend Additions

**Show > Pitches** (new entity nav link):
- List of existing pitches using `content-card` compact view, grouped by audience type badge
- "Generate Pitch" button opens the `content-type-selector` for choosing audience type. For producer type, additional field to select a specific producer (searches Producers via API).
- Clicking a pitch opens the `content-workspace` full view: editable content, "Regenerate" action, attribution line, attached materials
- `comparison` (side-by-side) component available for comparing pitches across audience types

**Show > AI Query** (new entity nav link):
- Natural language interface for questions about this show
- "How has the second act changed across versions?"
- "What are the producing challenges?"
- "Give me a pitch paragraph"

**Slate-level AI Query** (sidebar link):
- Natural language interface for questions across the whole slate
- "Compare the structures of our two musicals"
- "Which projects are furthest along?"
- "What do Vlad and Stable Geniuses have in common?"

**Dashboard updates:**
- Shows needing pitches
- Recently generated pitches

### Verification

- Can generate a pitch for any audience type
- Can generate a personalized producer pitch by selecting a producer from the Producers tool
- Can manually write a pitch from scratch
- Can edit generated pitch content
- Can attach materials to a pitch
- Pitches page shows all pitches grouped by audience type
- Show-level AI query answers questions about the specific show
- Slate-level AI query answers questions across all shows
- Dashboard shows pitch status

---

## Deferred Features

Features that depend on tools that don't exist yet. Don't build FPO versions — build these properly when the dependencies are real.

### When Collaborators is built:
- **Team page** in the entity nav. Creative team attachments with linked profiles — writer, director, composer, designers, etc. Role, status (interested/attached/confirmed/departed), dates. Full history.
- **Milestone participants** — structured participant data. A reading pulls participants from Collaborators. A public reading also pulls from Audience. A reading with producers pulls from Producers.

### When Audience is built:
- **Milestone participants** (see above) — audience attendance data
- **Pitch enrichment** — proof of demand, engagement data injected into pitches

### When Funding is built:
- **Financial status on show** — capitalization progress, financial health
- **Pitch enrichment** — budget, capitalization status, financial projections injected into investor pitches

### When Casting is built:
- **Casting status on show** — which roles are filled, in process, open

### When Radar is built:
- **Pitch enrichment** — cultural context injected into pitches ("why this show matters right now")
- **Comparable enrichment** — market data enriching comparable identification

### When Dramaturg is built:
- **Deeper structural analysis** — Dramaturg goes deeper than Slate's own script processing. Could supplement or replace Slate's analysis for structural insight.

### Cross-tool MCP tools:
Build these when the consuming tools need them:
- `slate_search_shows` — Search WN's slate by title, genre, themes, development stage
- `slate_get_roles` — Character breakdown for a show (for Casting)
- `slate_get_themes_and_genres` — Thematic profile of the entire slate (for Radar)
- `slate_get_development_status` — Development stage, milestone history, timeline

---

## Frontend

All frontend implementation uses the design system defined in `specs/mockups/design-system.html`. That file is the source of truth for every visual decision.

**The frontend design process in CLAUDE.md is mandatory.** Before writing any frontend code: identify every visual element needed, read the corresponding design system spec section for each one, write a design plan to the user listing which components you'll use and how they compose. Do not write code until the design plan is sent. Do not invent custom CSS when a design system class exists. Do not use inline styles. Do not treat existing code as the source of truth over the spec.

### Navigation Model

Slate uses a two-level navigation structure:

**Tool sidebar** (persistent, same pattern as Producers):
- Dashboard, AI Query (Phase 3)
- **Slate:** All Shows
- **Data:** Options
- **Advanced:** AI Configuration (Phase 2)
- **Footer:** Settings

Quick Add (create a show) is always available at the top of the sidebar.

**Entity nav bar** (appears when inside a show):
When the user navigates to a specific show, a horizontal `entity-nav` bar appears at the top of the content area. The sidebar remains. The entity nav shows the show title, a back link to the show list, and section links:

- Overview, Characters, Structure, Milestones, Visual Identity, Scripts / Book & Score (Phase 1)
- Pitches, AI Query (Phase 3)

Each link is a real route: `/slate/shows/{id}/overview`, `/slate/shows/{id}/characters`, etc. These are separate pages, not tabs on a single page. The scripts page label adapts to medium: "Book & Score" for musicals, "Script" for everything else.

### Version Display (Phase 2+)

Every page shows a version label indicating which script version the data is based on. Default is always the latest version. Clicking the label opens a modal to switch all pages to a historical version. When viewing a historical version, a persistent indicator makes it clear. "Back to latest" always available. In Phase 1, the Scripts page shows version history as file management but there's no version-scoped data display yet.

### Design System Components Used

| Component | Usage |
|-----------|-------|
| `entity-nav` | Show-level navigation bar |
| `stage-progression` | Development stage (full on overview, compact on dashboard/list) |
| `version-stack` | Script version history on the Scripts page |
| `asset-gallery` | Visual identity assets |
| `processing-panel` | Show updating state — which parts are ready, which are still loading |
| `content-card` / `content-workspace` | Pitch display and editing |
| `content-type-selector` | Audience type selection for pitch generation |
| `section-card` | Content grouping throughout, accent variants for project cards |
| `detail-layout` / `detail-hero` | Two-column layout on show overview |
| `surfacing-panel` | Dashboard attention flags (stalled shows, missing scripts) |
| `stat-grid` | Key metrics on overview |
| `timeline` | Milestones (per show and dashboard cross-show feed) |
| `file-upload` / `file-item` | Script, music, and visual uploads |
| `data-table` | Characters, songs, scene list, options workbench |
| `field-stack` / `form-actions` | Form field spacing and button rows |
| `section-stack` | Vertical spacing between page sections |
| `accordion` | Scene breakdown by act |
| `comparison` | Version diff, pitch comparison |
| `query-bar` / `query-result-*` | AI query interface |
| `badge` | Medium, stage, status indicators |
| `editable-field` | Edit page form fields |
| `empty-state` | Empty pages before data exists |
| `ActionMenu` | Kebab dropdown on overview, milestones, options |

### Custom Slate Components

- **Emotional arc visualization** — Read-only graph/curve showing the emotional trajectory across the show. Derived from the script. Not in the shared design system — specific to Slate's Structure page.

## Scheduled Jobs

No scheduled jobs in the initial build. All processing is event-triggered (upload triggers processing). Potential future jobs:

- Periodic pitch freshness check ("this pitch was generated 3 months ago and the script has been updated since")

## What Slate Does NOT Own

**People.** Slate does not own person records. When Collaborators exists, creative team members link to real profiles. Until then, the Team page is not built.

**Casting.** Slate knows what roles a show has (from the script). Casting owns the process of filling those roles.

**Budgeting and finance.** Slate's budget estimate is derived from the script — a rough range based on structural data. Theatre Ops owns real budgeting. Funding owns capitalization tracking.

**Deep script analysis.** Slate derives data from scripts comprehensively. Dramaturg will go deeper — structural insight, dramaturgical observation, craft analysis. Both are useful. They don't compete.

**Producer relationships.** Producers owns everything about the people who produce shows. Slate generates pitches and can personalize them to specific producers via Producers' MCP tools, but the relationship, the interaction history, the taste matching — that's Producers' domain.
