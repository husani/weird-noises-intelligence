# AI Discovery System

The discovery system finds new producers WN should know about. It's a self-improving feedback loop: scan for candidates, review them, and feed review decisions back into future scans so they get smarter over time.

## Overview

```
Monday 5 AM: regenerate intelligence profile (database coverage summary)
Monday 6 AM: run discovery scan (or trigger manually anytime)
    |
    v
LLM searches the internet with context:
  - Focus area (what to look for)
  - Intelligence profile (what we already cover — look elsewhere)
  - Calibration summary (what we've rejected before — don't suggest similar)
    |
    v
Candidates created with structured data:
  name, org, location, emails, socials, productions, reasoning
    |
    v
Multi-signal dedup against existing producers + past dismissals
  - Hard signals (email, LinkedIn, website match) → auto-filtered
  - Soft signals (name similarity) → flagged for review
    |
    v
Review queue: team confirms or dismisses each candidate
  - Confirm → create Producer record, queue dossier research
  - Dismiss → reason logged, feeds calibration for next scan
```

## The Three Supporting Systems

### 1. Intelligence Profile

**What:** A narrative summary of the current database — org coverage, geographic distribution, genre/aesthetic breakdown, scale preferences.

**Why:** Tells the discovery LLM where the gaps are so it explores underrepresented spaces instead of re-finding people we already know about.

**When generated:** Monday 5 AM (one hour before the scan), or manually via `POST /api/producers/discovery/regenerate-profile`.

**How:** Raw stats aggregated from all Producer records → sent to LLM → converted into strategic prose ("Strong Off-Broadway coverage, thin presence in regional theatre...").

**Prompt:** `intelligence_profile` behavior
- System (`prompt_intelligence_profile_system`): Analyze database statistics, produce a strategic coverage summary that directs future searches
- User (`prompt_intelligence_profile_user`): Variables `{producer_count}`, `{org_summary}`, `{geographic_summary}`, `{aesthetic_summary}`, `{scale_summary}`

**Stored in:** `IntelligenceProfile` model — `profile_text`, plus raw breakdowns (`org_coverage`, `geographic_distribution`, `aesthetic_coverage`, `scale_distribution`).

### 2. Discovery Calibration

**What:** A narrative summary of why past candidates were dismissed, distilled into patterns.

**Why:** Tells the discovery LLM what NOT to suggest. "Most rejections cite commercial focus or retired producers" → future scans avoid those types.

**When generated:** After every 10+ new dismissals since last calibration, or manually via `POST /api/producers/discovery/regenerate-calibration`. Only runs if at least 5 total dismissals exist.

**How:** All dismissed candidates + their reasons → sent to LLM → converted into actionable guidance.

**Prompt:** `discovery_calibration` behavior
- System (`prompt_discovery_calibration_system`): Analyze dismissed candidates, produce calibration guidance for future scans
- User (`prompt_discovery_calibration_user`): Variables `{total_count}`, `{dismissals_data}` (list of "Name: reason" entries)

**Stored in:** `DiscoveryCalibration` model — `calibration_text`, `dismissal_count`.

### 3. Focus Areas

**What:** Configured scan directions — "emerging Off-Broadway producers in Chicago," "producers connected to development programs," etc.

**How they're used:** On each scan, the system picks a focus area by one of three methods:
1. **Manual:** User provides a custom focus string when triggering a scan
2. **Rotation:** System picks the focus area with the oldest `last_used_at` (round-robin through configured areas)
3. **Fallback:** If no focus areas are configured, uses a generic scan description

**Stored in:** `DiscoveryFocusArea` model — `name`, `description`, `active`, `last_used_at`, `sort_order`.

## The Discovery Scan

### Trigger

- **Automatic:** Monday 6 AM UTC via APScheduler job `producers_ai_discovery`
- **Manual:** `POST /api/producers/discovery/trigger` with optional `focus` parameter, or "Run Scan" button in the UI

### Flow (in `jobs.py:ai_discovery()`)

1. Create a `DiscoveryScan` record (`status=running`)
2. Determine focus area (manual → rotation → fallback)
3. Ensure an intelligence profile exists (generate if not)
4. Load current intelligence profile text and calibration summary
5. Snapshot both onto the scan record for reproducibility
6. Build LLM prompts

**Prompt:** `ai_discovery` behavior
- System (`prompt_ai_discovery_system`): WN context, discovery criteria (champions new work, shared aesthetic, strategically positioned, emerging, complementary capabilities), what NOT to suggest, `{calibration_summary}` injected at the end
- User (`prompt_ai_discovery_user`): Variables `{focus_area}`, `{intelligence_profile}`, `{slate_info}` (currently stubbed until Shows tool exists)

**LLM call:** Web search enabled (Claude or Gemini), structured output via `DiscoveryCandidateData` schema, returns array of candidates.

7. For each returned candidate:
   - Skip if already pending in the queue (name match)
   - Run multi-signal dedup (see below)
   - Auto-dismiss definite duplicates
   - Store as `DiscoveryCandidate` with `status=pending` (or `dismissed` if auto-filtered)
8. Mark scan complete, record `candidates_found` and `candidates_after_dedup`
9. Check if calibration needs regeneration

### Candidate Data Structure

The LLM returns structured data per candidate (`DiscoveryCandidateData` in `ai.py`):

| Field | Description |
|-------|-------------|
| `first_name`, `last_name` | Required identity |
| `reasoning` | Why this person is interesting for WN |
| `source` | Where the LLM found them |
| `organization`, `organization_role` | Current affiliation |
| `city`, `state_region`, `country` | Location |
| `email_candidates` | Array of `{email, source, confidence}` — confidence is high/medium/low |
| `website` | Personal or company URL |
| `social_links` | Array of `{platform, url}` (LinkedIn, Instagram, etc.) |
| `recent_productions` | Array of `{title, year, venue, role, scale}` |

All fields except name and reasoning are optional. Stored as JSONB in `raw_data` on the candidate record.

## Multi-Signal Deduplication

Runs on every candidate before storage (`dedup_candidate()` in `ai.py`).

### Hard Signals (definite match → auto-filtered)

- LinkedIn URL exact match (normalized)
- Email exact match
- Website exact match
- Discovered email candidates match existing producer's email candidates

### Soft Signals (possible match → flagged for review)

- Name similarity > 85% (SequenceMatcher)

### Match Against

1. **All existing Producer records** — checks all hard and soft signals
2. **Previously dismissed DiscoveryCandidates** — name similarity > 85%, with > 95% escalating to definite duplicate

### Dedup Result

Stored on the candidate as `dedup_status` and `dedup_matches`:

| Status | Meaning |
|--------|---------|
| `clean` | No matches found |
| `potential_duplicate` | Soft matches only — flagged but kept for review |
| `definite_duplicate` | Hard match or very high name similarity — auto-dismissed |

Each match includes: `producer_id`, name, `match_type` (hard/soft/previously_dismissed), `confidence` (definite/possible), and specific `signals` that triggered it.

## The Review Queue

### Frontend (DiscoveryQueue.jsx)

Two tabs: **Review Queue** (pending candidates) and **Scan History** (past scans).

**Review Queue — candidate cards:**
- Collapsed: avatar, name, org, location, reasoning preview, duplicate badge
- Expanded (inline editor):
  - Reasoning and source URL
  - Dedup warning if flagged (matching producer name + signals)
  - Editable identity fields (name, org, role)
  - Editable location (city, state, country)
  - Website and social links (read-only from discovery)
  - Email candidates with checkboxes — each shows confidence level and source
  - Recent productions list

**Actions:**
- **Confirm & Add:** creates a Producer from the (optionally edited) candidate data, queues dossier research
- **Dismiss:** logs the reason, which accumulates toward calibration

### Backend (interface.py: `review_discovery()`)

**On confirm:**
- Merge `raw_data` with any inline edits
- Create Producer record with `intake_source="ai_discovery"` and `intake_ai_reasoning`
- Set email from highest-confidence candidate
- Create org affiliation if provided
- Queue `_run_research()` for full dossier
- Mark candidate `status=confirmed`

**On dismiss:**
- Store `dismissed_reason` on candidate
- Mark candidate `status=dismissed`
- Dismissal patterns accumulate for calibration regeneration

## The Feedback Loop

```
Dismissals accumulate
    → calibration regenerates (every 10+ new dismissals)
    → next scan's system prompt includes updated calibration
    → LLM avoids similar candidates
    → fewer bad suggestions over time

Confirmations expand the database
    → intelligence profile regenerates (weekly)
    → next scan knows about new coverage
    → LLM explores different spaces
```

## Scan Record

Each scan creates a `DiscoveryScan` record tracking:

| Field | Purpose |
|-------|---------|
| `focus_area`, `focus_type` | What the scan looked for and how it was selected |
| `intelligence_profile_snapshot` | Profile text at scan time (reproducibility) |
| `calibration_snapshot` | Calibration text at scan time |
| `started_at`, `completed_at` | Timing |
| `status` | running / complete / failed |
| `candidates_found` | Raw count from LLM |
| `candidates_after_dedup` | Count after auto-filtering duplicates |
| `error_detail` | If scan failed |

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/producers/discovery/candidates?status=pending` | List candidates by status |
| `PUT` | `/api/producers/discovery/candidates/{id}/review` | Confirm or dismiss a candidate |
| `POST` | `/api/producers/discovery/trigger` | Trigger a manual scan (optional `focus` param) |
| `GET` | `/api/producers/discovery/scans` | Scan history with pagination |
| `GET` | `/api/producers/discovery/scans/{id}` | Scan detail with candidates |
| `GET` | `/api/producers/discovery/focus-areas` | List configured focus areas |
| `POST` | `/api/producers/discovery/focus-areas` | Create a focus area |
| `PUT` | `/api/producers/discovery/focus-areas/{id}` | Update a focus area |
| `DELETE` | `/api/producers/discovery/focus-areas/{id}` | Delete a focus area |
| `POST` | `/api/producers/discovery/regenerate-profile` | Manually regenerate intelligence profile |
| `POST` | `/api/producers/discovery/regenerate-calibration` | Manually regenerate calibration |

## Prompt Reference

All prompts are editable at runtime via the AI Configuration page. Defaults live in `producers/backend/prompts.py`.

| Behavior | Setting Keys | Used During |
|----------|-------------|-------------|
| `ai_discovery` | `prompt_ai_discovery_system`, `prompt_ai_discovery_user` | The scan itself — finding candidates |
| `intelligence_profile` | `prompt_intelligence_profile_system`, `prompt_intelligence_profile_user` | Pre-scan — summarizing database coverage |
| `discovery_calibration` | `prompt_discovery_calibration_system`, `prompt_discovery_calibration_user` | Post-review — distilling dismissal patterns |

The `ai_discovery` system prompt includes `{calibration_summary}` which is injected from the latest calibration. The user prompt includes `{intelligence_profile}` from the latest profile and `{focus_area}` from the selected focus.

## Producer Data Model

When a discovery candidate is confirmed (or a producer is added by any other means), this is the data we store. Most fields are populated by AI dossier research after initial creation.

### Core Identity

| Field | Type | Description |
|-------|------|-------------|
| `first_name`, `last_name` | String | Required. Indexed for search. |
| `email` | String | Primary email. Unique constraint. |
| `phone` | String | Phone number. |
| `city`, `state_region`, `country` | String | Location. |
| `website` | String | Personal or company URL. |
| `photo_url` | String | Headshot/avatar URL. |
| `social_links` | JSONB | Array of `{platform, url}` — LinkedIn, Instagram, etc. |
| `email_candidates` | JSONB | Array of `{email, source, confidence}` — all discovered emails with provenance. Confidence is high/medium/low. |

### AI-Written Dossier

Populated by dossier research (`dossier_research` prompt behavior). Refreshed periodically based on the configured cadence.

| Field | Description |
|-------|-------------|
| `genres` | Array of genres they work in (e.g., musical theatre, drama, comedy). |
| `themes` | Array of recurring themes in their work. |
| `scale_preference` | intimate / mid-size / large-scale / mixed. |
| `aesthetic_sensibility` | Prose analysis of their creative taste — what patterns emerge across their productions. |
| `lead_vs_co_producer` | lead / co-producer / both. |
| `typical_capitalization_range` | Description of typical deal sizes. |
| `funding_approach` | individual investors / institutional / mixed. |
| `financial_profile_summary` | Prose analysis of their financial approach. |
| `career_trajectory_summary` | Prose analysis of career direction — scaling up, shifting genres, etc. |
| `current_activity` | Prose on current and announced projects. Refreshed more frequently. |
| `press_presence` | Prose on press coverage, interviews, public statements. |
| `awards_summary` | Prose on industry recognition and what it signals. |
| `network_summary` | Prose on frequent collaborators — co-producers, directors, writers, casting directors. |
| `relationship_summary` | Prose summary of WN's relationship with this producer. Regenerated when interactions change (uses `relationship_summary` prompt behavior). |

### Dossier Metadata

| Field | Description |
|-------|-------------|
| `last_research_date` | When dossier was last refreshed. |
| `research_sources_consulted` | JSONB list of sources checked during research. |
| `research_gaps` | JSONB list of sections where data was thin or absent. |
| `research_status` | pending / in_progress / complete / failed. |
| `research_status_detail` | Current step or error detail. |

### Intake Tracking

| Field | Description |
|-------|-------------|
| `intake_source` | How this producer entered the system: manual, url, spreadsheet, ai_discovery. |
| `intake_source_url` | URL if added from a web page. |
| `intake_ai_reasoning` | AI's explanation if added via discovery. |

### Relationship State

Computed fields, recomputed when interactions change. Not manually entered.

| Field | Description |
|-------|-------------|
| `last_contact_date` | Date of most recent interaction. |
| `interaction_count` | Total number of logged interactions. |
| `interaction_frequency` | Average days between interactions. |
| `next_followup_due` | Earliest pending follow-up due date. |

### Related Entities

Each of these is a separate table linked via foreign keys or junction tables.

**Productions** (many-to-many via `producer_productions`): Theatre productions this producer has worked on. Each link has a `role` (lead producer, co-producer, associate, executive). Productions are their own entity with title, venue, year, dates, scale, run length, and outcome notes.

**Organizations** (many-to-many via `producer_organizations`): Producing offices, non-profits, commercial companies, development programs. Each link has role title, start/end dates, and notes. Organizations are their own entity with name, type, website, location, description, and social links.

**Tags** (many-to-many via `producer_tags`): User-defined tags for categorization.

**Awards** (one-to-many): Award name, category, year, outcome (nominated/won). Optionally linked to a specific production.

**Interactions** (one-to-many): Timestamped touchpoints between WN and the producer. Each has date, content (notes), author (team member), and optional audio URL. Interactions trigger AI extraction of follow-up signals and show connection detection.

**Follow-up Signals** (one-to-many, linked to interactions): AI-extracted from interaction text using `follow_up_extraction` prompt behavior. Each has implied action, timeframe, due date, and resolved status.

**Show Connections** (one-to-many): Links to WN shows with connection type (pitched, interested, passed, attached, other). Detected by AI from interaction text using `show_connection_detection` prompt behavior, or added manually.

**Show Matching Results** (one-to-many): AI-assessed fit between this producer and each WN show — strong/moderate/weak/not a fit, with reasoning. Generated using `show_matching` prompt behavior. Includes a `team_notes` field for manual annotation.

### Change History

Separate `change_history` table tracks field-level changes across all entity types: entity type, entity ID, field name, old value, new value, who changed it (user email or "AI research"/"AI refresh"), and when. Covers both human edits and AI-driven updates.
