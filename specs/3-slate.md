# Intelligence — Slate Tool Spec

System of record for WN's own projects and their development history. The script is the source of truth — upload a script and the system derives everything else.

Slate is not a generic show database. Producers already has that — it tracks any theatrical work a producer has been involved with. Slate is specifically WN's development slate: the shows WN is creating, developing, and producing. Every show here is a WN project.

## Dependencies

Slate uses the shared infrastructure built in Phase 1 (auth, DB, MCP, AI clients, GCS, scheduler). It does not depend on any other tool being built first. Cross-tool integrations (Producers for show matching, Dramaturg for script analysis, Casting for breakdowns) are additive — they enhance Slate when those tools exist but nothing breaks without them.

## Data Model

What Slate owns. Its own database (`intelligence_slate`). All tables defined here are built in Phase 1, even if the features that populate some of them come in later phases. This prevents schema retrofitting.

### Show

The top-level entity. A WN project.

- Title
- Medium — musical, play, screenplay, teleplay, feature film, short film, limited series, other (lookup value)
- Genre — prose
- Logline — one-to-two sentence pitch (can be AI-generated from script, human-refined)
- Summary — longer description (can be AI-generated from script, human-refined)
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
- Created timestamp

### Script Analysis

Structured data extracted by the LLM on script upload. Each analysis type is a separate record tied to a script version, so they can be regenerated independently.

- Script version reference
- Analysis type — character_breakdown, scene_breakdown, song_list, runtime_estimate, cast_requirements, budget_estimate, logline_draft, summary_draft, comparables, content_advisories, version_diff (lookup value)
- Content — JSONB, structure varies by type (see LLM Extraction below)
- Generated at timestamp
- Model used — which LLM produced this analysis

### Development Milestones

Events in the show's life — readings, workshops, submissions, notable moments.

- Show reference
- Script version reference (optional — which version was current at this milestone)
- Title — "Internal Read", "Workshop at New York Theatre Workshop", "Submitted to O'Neill"
- Date
- Description — notes, outcomes, observations
- Milestone type — internal read, workshop, staged reading, table read, showcase, submission, festival, pitch meeting, location scout, shoot day, screening, other (lookup value)
- Created timestamp

### Milestone Participants

People present at or involved in a milestone.

- Milestone reference
- Name
- Role — "director", "actor (Role Name)", "dramaturg", "observer", "reader"
- Notes

### Creative Team

Per-show, time-aware attachments of people to creative roles on the project.

- Show reference
- Person name
- Role — writer, composer, lyricist, book writer, director, choreographer, music director, dramaturg, designer (set/production, costume, lighting, sound, projection), orchestrator, arranger, producer, executive producer, cinematographer, editor, showrunner, other (lookup value)
- Status — interested, attached, confirmed, departed (lookup value)
- Start date, end date (null if current)
- Notes
- Created, updated timestamps

### Visual Identity Assets

Each show has its own visual brand — logo, key art, mood boards, color palette references, typography samples.

- Show reference
- File path (GCS) and original file name
- Asset type — logo, key_art, mood_board, color_palette, typography, reference_image, other (lookup value)
- Label — human-readable name
- Version — for assets that evolve (logo v1, logo v2)
- Is current — boolean, marks the active version of each asset type
- Created timestamp

### Pitches

Slate owns pitch creation. A pitch is always about a show, tailored to an audience type.

- Show reference
- Audience type — producer, investor, grant_maker, festival, general (lookup value)
- Title — human-readable label for this pitch
- Content — the pitch text (AI-generated, human-editable)
- Status — draft, final (lookup value)
- Generated by — "ai" or user email
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

Categories: medium (show), rights_status (show), development_stage (show), track_type (music_file), analysis_type (script_analysis), milestone_type (milestone), creative_role (creative_team), attachment_status (creative_team), asset_type (visual_asset), audience_type (pitch), pitch_status (pitch), material_type (pitch_material).

### Change History

Same pattern as Producers. Field-level change tracking across all entity types.

- Entity type, entity ID, field name, old value, new value, changed by, changed at

### AI Behaviors

Same pattern as Producers. Runtime-editable prompt configurations.

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

## Build Phases

The data model above is complete. All tables are created in Phase 1. The phases below control which features are built and which tables are actively populated. Each phase is a complete, working increment.

---

## Phase 1: Core CRUD + File Storage

The skeleton of Slate. Shows exist, scripts can be uploaded, the development timeline is trackable. No AI.

### Backend

**Models** — All tables from the data model above. Created at startup.

**Interface** — `SlateInterface` class with session factory and MCP server. Registers initial MCP tools (reads only in Phase 1).

**MCP Tools (Phase 1):**

1. `slate_list_shows` — List all WN shows with title, medium, genre, logline, development stage. Supports search by title, filter by stage and medium.
2. `slate_get_show` — Full show profile: identity, development stage, current script version, creative team, milestones, visual identity assets.
3. `slate_get_script` — Script version details including file download URL (signed GCS URL), change notes, and any completed analyses.
4. `slate_get_creative_team` — Current creative team for a show with roles, status, and dates.

**Routes** — CRUD endpoints under `/api/slate/*`:

*Shows:*
- List shows (search, filter by stage/medium, sort, paginate)
- Create show
- Get show
- Update show (including stage transitions)
- Delete show

*Script Versions:*
- List versions for a show
- Upload new version (multipart file upload → GCS)
- Get version details
- Update version metadata (label, change notes)
- Delete version
- Download script (signed URL redirect)

*Music Files:*
- List music for a script version
- Upload music file (multipart → GCS)
- Update metadata (track name, type, description)
- Delete music file
- Download (signed URL)
- Reorder tracks

*Milestones:*
- List milestones for a show
- Create milestone (with participants)
- Update milestone
- Delete milestone
- Add/remove participants

*Creative Team:*
- List attachments for a show
- Add attachment
- Update attachment (status changes, dates, notes)
- Remove attachment
- History view (all attachments including departed)

*Visual Identity:*
- List assets for a show
- Upload asset (multipart → GCS)
- Update metadata (label, version, is_current)
- Delete asset
- Download (signed URL)

*Lookup Values:*
- Same CRUD pattern as Producers (list, create, update, reorder, delete with protection)

*Settings:*
- Get/update settings

### Frontend

**Navigation** — Sidebar grouped into:
- Dashboard
- **Slate:** All Shows, Milestones
- **Data:** Options
- **Advanced:** AI Configuration
- **Footer:** Settings

Quick Add (create a show) always available at the top.

**Pages:**

**Dashboard** — Overview of WN's development slate. Shows grouped or sorted by development stage. Recent milestones. Shows with no recent activity.

**Show List** — All WN shows, searchable, filterable by development stage and medium, sortable. Each row: title, medium badge, development stage indicator, current script version info, creative team summary, last updated.

**Show Detail** — The complete picture of a WN project. Tabbed or sectioned:
1. Overview — title, medium, genre, logline, summary, rights status, development stage. All editable.
2. Scripts — version history (ordered, most recent first). Each version: label, upload date, change notes, download link. Upload new version button. Music files per version.
3. Creative Team — current attachments with role, status, dates. Add/edit/remove. History of departed members.
4. Milestones — chronological timeline. Each milestone: title, date, type, description, participants, linked script version.
5. Visual Identity — asset gallery grouped by type. Upload, label, version, set as current.
6. Pitches — (placeholder in Phase 1, populated in Phase 3)
7. Analysis — (placeholder in Phase 1, populated in Phase 2)

**Create Show** — Form: title (required), medium, genre, logline, summary, rights status, initial development stage.

**Options** — Lookup value management, same pattern as Producers.

**Settings** — Tool configuration.

**AI Configuration** — (placeholder in Phase 1, populated in Phase 2)

### Wiring in `app.py`

- `intelligence_slate` database created
- All tables initialized
- `SlateInterface` instantiated with session factory and MCP server
- Registered in tool registry: name "Slate", path `/slate`
- Routes mounted at `/api/slate/*`
- Frontend route: `/slate/*` lazy-loads `SlatePage`

---

## Phase 2: LLM Script Processing

The AI reads scripts and extracts structured data. This is Slate's core intelligence — upload a file, get back comprehensive analysis.

### LLM Extraction on Upload

When a script version is uploaded, background processing kicks off. The processing pipeline:

1. Set `processing_status = "processing"` on the script version
2. Read the script file from GCS
3. Run each analysis type as a separate LLM call (can be parallelized)
4. Store results as `ScriptAnalysis` records
5. If this isn't the first version, run version diff against the previous version
6. Set `processing_status = "complete"` (or "failed" with error detail)

**Analysis types and their JSONB structure:**

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

### AI Behaviors (Phase 2)

Stored in `ai_behaviors` table, editable at runtime:

- `script_character_breakdown` — Extract characters with descriptions, age ranges, line counts, vocal ranges
- `script_scene_breakdown` — Extract act/scene structure with locations, characters, timing
- `script_song_list` — Extract song list with placement, characters, song types (musicals only)
- `script_runtime_estimate` — Estimate runtime from structural data
- `script_cast_requirements` — Analyze minimum cast, doubling, musician needs
- `script_budget_estimate` — Estimate budget range from structural and technical data
- `script_logline` — Generate logline options from the script
- `script_summary` — Generate a summary from the script
- `script_comparables` — Identify comparable works with reasoning
- `script_content_advisories` — Identify content that may need advisories
- `script_version_diff` — Compare two script versions structurally

Each behavior has a system prompt and user prompt. The user prompt receives the script text (or relevant excerpt) plus show metadata (including medium) as context variables. The LLM adapts its analysis based on the medium — scene breakdown uses INT/EXT for screenplays, song analysis is skipped for non-musicals, budget estimates factor in post-production for film/TV, etc.

### Backend Additions

**Routes:**
- `POST /api/slate/shows/{show_id}/scripts/{version_id}/reprocess` — Re-run all analyses for a version
- `POST /api/slate/shows/{show_id}/scripts/{version_id}/reprocess/{analysis_type}` — Re-run a single analysis type
- `GET /api/slate/shows/{show_id}/scripts/{version_id}/analyses` — List all analyses for a version
- `GET /api/slate/shows/{show_id}/scripts/{version_id}/analyses/{type}` — Get a specific analysis
- `PUT /api/slate/shows/{show_id}/scripts/{version_id}/analyses/{analysis_id}` — Edit an analysis (human corrections)

**Modify upload route** to trigger background processing on script upload.

**MCP Tools (Phase 2 additions):**

5. `slate_get_analysis` — Get a specific analysis type for a script version. Returns the structured JSONB content.
6. `slate_get_character_breakdown` — Convenience tool: returns character breakdown for the current script version of a show.

### Frontend Additions

**Show Detail — Analysis tab:**
- Displays all completed analyses for the current (or selected) script version
- Each analysis type rendered with appropriate design treatment:
  - Character breakdown → table with name, description, age range, vocal range, notes
  - Scene breakdown → collapsible act/scene tree
  - Song list → ordered table with act, scene, title, characters, type
  - Runtime → compact display with act breakdown
  - Cast requirements → summary card
  - Budget estimate → range display with factors
  - Logline drafts → selectable options (pick one to use as the show's logline)
  - Summary draft → editable text (accept/edit to use as the show's summary)
  - Comparables → card list with title and reasoning
  - Content advisories → alert-style list
  - Version diff → structured comparison view
- "Regenerate" button per analysis type
- "Regenerate All" button
- Processing status indicator while analyses are running

**Show Detail — Scripts tab updates:**
- Each version shows processing status badge
- Expandable inline analysis preview per version

**AI Configuration page:**
- Lists all AI behaviors with model selection and prompt editing
- Same pattern as Producers

### Scheduled Jobs (Phase 2)

None needed. Processing is event-triggered (on upload), not scheduled. But the infrastructure supports adding scheduled jobs later if needed (e.g., periodic re-analysis when AI models improve).

---

## Phase 3: Pitches + Visual Identity System + On-Demand AI

Slate becomes a pitch generation engine. The AI pulls from the show's own data (and eventually from other tools) to create tailored pitch materials.

### Pitch Generation

The AI generates pitch content by assembling data from:
- Show profile (logline, summary, genre, development stage)
- Script analysis (comparables, budget estimate, cast requirements, content advisories)
- Creative team (who's attached, their credentials)
- Milestone history (development progress, workshops, readings)
- Visual identity (when available, referenced in the pitch for context)

The prompt is audience-specific:
- **Producer pitch** — emphasizes creative vision, comparable successes, creative team strength, development maturity
- **Investor pitch** — emphasizes budget, market comparable performances, creative team track record, timeline to production
- **Grant-maker pitch** — emphasizes artistic merit, social relevance, organizational mission alignment, development plan
- **Festival pitch** — emphasizes what stage the work is at, what the reading/workshop would accomplish, creative team
- **General pitch** — balanced overview

### AI Behaviors (Phase 3)

- `pitch_generate` — Generate pitch content for a show tailored to an audience type. Context: show data, analyses, creative team, milestones, audience type.
- `pitch_one_pager` — Generate a one-page pitch document
- `slate_query` — On-demand AI querying across the slate. Natural language interface with MCP access to Slate's own tools.
- `show_producing_challenges` — Analyze producing challenges from script analysis data
- `show_evolution` — Summarize how a show has evolved across script versions

### Backend Additions

**Routes:**
- `GET /api/slate/shows/{show_id}/pitches` — List pitches for a show
- `POST /api/slate/shows/{show_id}/pitches` — Create a pitch (manual or AI-generated)
- `POST /api/slate/shows/{show_id}/pitches/generate` — Generate pitch via AI with audience type
- `GET /api/slate/shows/{show_id}/pitches/{pitch_id}` — Get pitch
- `PUT /api/slate/shows/{show_id}/pitches/{pitch_id}` — Update pitch content
- `DELETE /api/slate/shows/{show_id}/pitches/{pitch_id}` — Delete pitch
- Pitch materials CRUD (upload, list, delete)
- `POST /api/slate/query` — On-demand AI query

**MCP Tools (Phase 3 additions):**

7. `slate_get_pitch` — Get a pitch for a show by audience type. Returns the pitch content and any attached materials.
8. `slate_get_budget_estimate` — Convenience: returns budget estimate for the current script version.
9. `slate_get_show_summary` — Convenience: returns the show's current logline, summary, comparables, and development stage — the information other tools most commonly need.

### Frontend Additions

**Show Detail — Pitches tab:**
- List of existing pitches grouped by audience type
- "Generate Pitch" button with audience type selector
- Each pitch: title, audience type badge, content (editable rich text), status, generated/updated dates
- Attached materials list with upload/download/delete
- Side-by-side comparison of pitches for different audiences

**AI Query page:**
- Natural language interface for querying across the slate
- "What are the producing challenges for Moonshot?"
- "How has Stable Geniuses evolved across versions?"
- "Give me a pitch paragraph for Moonshot"
- "Compare the structures of our two musicals"

**Dashboard updates:**
- Shows needing pitches (no pitch created yet)
- Recently generated pitches

**Navigation update:**
- Add AI Query to sidebar

---

## Phase 4: Cross-Tool MCP Integration

Slate becomes a full platform citizen. Other tools can query WN's slate data. This phase adds MCP tools that other tools consume and builds any inbound integrations from tools that exist at that point.

### MCP Tools (Phase 4 additions)

10. `slate_search_shows` — Search WN's slate by title, genre, themes, development stage. For Producers' show matching: "what shows are in active development?"
11. `slate_get_roles` — Get character breakdown for a show's current script. For Casting: "what roles need to be cast?"
12. `slate_get_themes_and_genres` — Get thematic and genre profile of the entire slate. For Radar: "what themes and genres is WN working on?"
13. `slate_get_development_status` — Get development stage, milestone history, and timeline for a show. For other tools needing project status.

### Inbound Integrations (as other tools come online)

**From Dramaturg (when built):**
- Structural analysis data could supplement or replace Slate's own script processing for deeper analytical work
- Slate's Phase 2 analysis is sufficient on its own but Dramaturg goes deeper

**From Producers:**
- Show matching: Producers' AI calls `slate_search_shows` and `slate_get_show_summary` to find which WN shows fit a producer's profile
- Producer pitch context: when generating a producer pitch, Slate can call `producers_get_record` to include context about the producer being pitched

**From Casting (when built):**
- Casting status updates on show detail ("3 of 8 roles cast")

**From Funding (when built):**
- Financial data on show detail ("$1.2M of $3M raised")

**From Radar (when built):**
- Cultural context injected into pitch generation
- Comparable identification enriched with market data

These integrations are additive. Slate works fully without them. Each one is a small addition when the relevant tool exists.

---

## Frontend

All frontend implementation uses the design system defined in `specs/mockups/design-system.html`. That file is the source of truth for every visual decision.

### Navigation

Slate has a sidebar navigation grouped into sections:

- Dashboard, AI Query (Phase 3)
- **Slate:** All Shows, Milestones
- **Data:** Options
- **Advanced:** AI Configuration (Phase 2)
- **Footer:** Settings

Quick Add (create a show) is always available at the top of the sidebar.

## Scheduled Jobs

No scheduled jobs in the initial build. All processing is event-triggered (script upload triggers analysis). Potential future jobs:

- Re-analyze scripts when AI models are updated (manual trigger sufficient for now)
- Periodic pitch freshness check ("this pitch was generated 3 months ago and the script has been updated since")

## What Slate Does NOT Own

**People.** Slate tracks creative team attachments by name and role, but it does not own person records. When Collaborators exists, creative team members can be linked to Collaborators profiles via MCP. Until then, names are stored as strings.

**Casting.** Slate knows what roles a show has (from script analysis). Casting owns the process of filling those roles. Slate provides the breakdown; Casting runs the workflow.

**Budgeting and finance.** Slate's budget estimate is AI-generated from script analysis — a rough range based on structural data. Theatre Ops owns real budgeting. Funding owns capitalization tracking.

**Script analysis depth.** Slate's Phase 2 analysis is comprehensive but intentionally surface-level compared to what Dramaturg will do. Slate extracts data; Dramaturg provides insight. Both are useful. They don't compete.

**Producer relationships.** Producers owns everything about the people who produce shows. Slate generates pitches that may be sent to producers, but the relationship, the interaction history, the taste matching — that's all Producers' domain.
