# Intelligence — Producers Tool Spec

WN's knowledge base of theatre producers. Every producer in the system gets researched in depth, and the accumulated knowledge is queryable by the team and by other tools across Intelligence.

Producers is not a CRM. There are no pipeline stages, no deal tracking, no status dropdowns, no campaign objects. The system understands relationships by reading interaction data — not by someone dragging a card between columns. Every design decision should be evaluated against this: if it looks like a CRM pattern, it's wrong.

The master spec defines what Producers is at a planning level. This document is the build spec.

## Dependencies

Producers assumes Shows is built and populated. Show matching — a core feature — works against real show data from Shows' MCP tools on day one. Producers does not maintain its own representation of WN's slate.

The bookmarklet is deferred. It's shared with Talent and will be built when Talent comes online. It is not part of this build.

## Future Integration: Context

When Context is built, meetings where a producer was discussed should surface in the producer's interaction history automatically — pulled via Context's MCP tools. This eliminates the biggest gap in interaction data: meetings that were recorded but nobody remembered to log manually. The manual interaction log covers hallway conversations, events, and anything outside recorded meetings. Context covers everything else.

## Data Model

What Producers owns. Its own database. The producer record is a lean identity record. Analytical data lives in two satellite tables — `producer_traits` and `producer_intel` — populated by the AI pipeline. The frontend renders structured data with full design control. Every field the AI fills is editable by the team — corrections are how bad data gets fixed, and every edit is tracked in change history.

### Producer Record

**Identity.** Name (first, last), nickname, pronouns, email, phone, city, state/region, country, hometown (city, state, country), birthdate, college, spouse/partner, languages, seasonal location, photo URL, personal website, social links.

**Dossier metadata.** When research was last run, what sources were consulted, where there were gaps (sections where the AI found thin or no results). Visible on the detail page so the team knows how fresh and complete the dossier is.

**Intake source.** How this producer entered the system: manual add, URL submission, spreadsheet import, or AI discovery. For URL submissions, the source URL. For AI discovery, the reasoning the system provided for why this person was flagged.

### Producer Traits

Structured analytical observations about a producer, stored in a satellite table (`producer_traits`). Each trait has: producer reference, category (from lookup values — genres, themes, scale preference, lead vs co-producer, capitalization range, funding approach, development stage preference, new work vs existing IP, risk profile, career stage, activity level, operational style, artist loyalty, geographic scope, organizational model), a prose value, a confidence score (0-100), and a computed_at timestamp. Populated and refreshed by the AI pipeline.

### Producer Intel

Structured intelligence observations about a producer, stored in a satellite table (`producer_intel`). Each intel record has: producer reference, category (from lookup values — career move, deal activity, public statement, industry recognition, relationship signal, project announcement), an observation, a confidence score (0-100), an optional source URL, and a discovered_at timestamp. Populated by the AI pipeline.

### Productions

A production is its own entity. Multiple producers can be attached to the same production (co-producing is the norm in theatre). A production has: title, venue, year or run period (start/end dates where available), scale (Broadway, Off-Broadway, regional, touring, international, other), run length if available, outcome notes, production type (reading, workshop, world premiere, premiere, transfer, revival, tour, other), capitalization (dollar amount), budget tier (Under $500K through $30M+), recouped status, and funding type (commercial, nonprofit, co-production, institutional, independent, other). The producer's role on a production (lead producer, co-producer, associate producer, executive producer) is a property of the relationship between the producer and the production, not a property of the production itself.

Productions link to venues and to awards. Many-to-many between producers and productions.

### Organizations

An organization is its own entity. Multiple producers affiliate with the same organization. An organization has: name, type (producing office, non-profit theatre, commercial production company, development program, other), website, location, description.

A producer's affiliation with an organization has: role/title, start date, end date (null if current), notes. The full history is preserved — when someone moves, both affiliations stay.

### Shows

A show is the IP-level representation of a theatrical work. A show has: title, medium (musical, play, etc.), original year, description, genre (prose), themes (prose), summary (prose), and work origin (original, adaptation, revival). Shows can have multiple productions and multiple producers attached at the IP level (distinct from production-level credits).

### Venues

A venue is its own entity. Venues appear across many productions. A venue has: name, type (Broadway house, Off-Broadway, regional, festival, other), location, capacity, notes.

### Awards

Awards attach to productions, not directly to producers. An award has: name (Tony, Drama Desk, Outer Critics, Obie, Pulitzer, other), category, year, outcome (nominated, won).

### Interactions

An interaction is a timestamped record of a touchpoint between WN and a producer. Fields: date (defaults to now), text content, author (the team member who logged it), audio URL (if recorded as voice memo — transcribed to text on save). Interactions are a flat chronological list. Internal assessments (observations about how a producer works, their reputation, their taste beyond what credits show) are just interactions — there is no separate data structure for them.

Follow-up signals are extracted from the interaction text at save time by the AI. A follow-up signal has: the implied action or expectation, a rough timeframe (if detectable), a reference back to the source interaction, and a resolved/unresolved status. Follow-up signals auto-resolve when a new interaction is logged with that producer. Follow-up signals power the "relationships going cold" and "follow-ups due" features.

### Tags

Ad-hoc labels the team applies to producers. A tag is a string. A producer can have many tags. Tags are searchable and filterable.

### Producer–Show Connections

A structured relationship between a producer and a WN show (from Shows), stored in Producers' database. Fields: producer, show (referenced by Shows' ID), connection type (pitched, interested, passed, attached, other), date, notes. A producer can have multiple connections to the same show as the relationship evolves.

Two creation paths:
- **From interactions.** At save time, the AI detects show references in interaction text and creates or updates connections automatically. "Pitched her on Moonshot" creates a connection with type "pitched." "She's interested in Stable Geniuses" creates one with type "interested."
- **Manual.** The team explicitly connects a producer to a show from the detail page.

These are connections that Producers knows about from its own data. Other tools may also have data about a producer's relationship to a show — for example, Shows stores its own pitch records. The complete picture of a producer's relationship to WN's shows comes from reading both Producers' data and other tools' data via MCP.

### Show Matching Results

Stored results of AI analysis comparing a producer's profile against WN's slate. For each producer-show pair: show reference, fit assessment, reasoning (why this show fits or doesn't), and when the match was last computed. This is a table, not a text blob. Results are tracked in change history like everything else. Editable — the team can annotate or override the AI's assessment.

Show matching runs when the producer's dossier research first completes, re-runs on every dossier refresh (scheduled or manual), and can be manually triggered from the detail page. When a new show is added to the slate, existing match results are flagged as potentially incomplete — "slate has changed since last match." The next refresh cycle picks it up, or the user can trigger a re-run.

### Relationship State

Stored fields on the producer record: last contact date, interaction count, interaction frequency, next follow-up due date (if any pending). Updated whenever interactions change. The state label (no contact, new, active, waiting, overdue, gone cold) is derived from these fields plus the current date — "overdue" and "gone cold" are time-based transitions that occur as dates pass. These are what the list view, detail page, and `producers_get_relationship_state` MCP tool read from.

### Change History

Every field-level change is logged. What field changed, old value, new value, when, who (team member name or "AI research" / "AI refresh"). This is not just an audit trail — it's data. Knowing that a producer's org affiliation changed, or that the team corrected something the AI got wrong, is institutional knowledge.

## AI Research Pipeline

Every producer who enters the system gets a full dossier built by the AI. The research is fully autonomous — no review gate, no draft-and-approve step. The AI researches and populates the fields. If it gets something wrong, the team corrects it. The correction is tracked in change history.

**Research engine.** Claude with web search. The AI works through a research framework: check the managed source list first, then search broadly. It's directed research — the AI knows what fields need to be populated and systematically finds the data for each.

**Managed source list.** A configurable list of sources the AI always checks: IBDB, Playbill, BroadwayWorld, LinkedIn, company websites, and whatever else the team adds over time. This is "always check these," not "only check these." The AI uses additional sources it finds during research.

**Source transparency.** The dossier metadata records what sources were consulted and what was found where. The team can spot-check any piece of data.

**Thin dossiers are fine.** Some producers have limited public information. The dossier shows what was found and where the gaps are. A thin dossier is still more than WN had before.

**Async execution.** Research runs asynchronously. The producer record is created immediately with whatever was entered at intake. The AI research runs in the background and populates fields as it finds data. The team doesn't wait.

## Dossier Refresh

Dossiers go stale. The research pipeline runs periodically to update producer records. Refresh means: re-run the research, compare findings to existing field values, update what changed. Changes are logged in change history with "AI refresh" as the author.

**Cadence.** Monthly for all producers. Every two weeks for producers WN is actively engaged with (any interaction in the last 90 days). Both cadences and the active-relationship window are configurable in settings.

**Manual refresh.** Available at three levels: individual producer (from the detail page), multi-select (from the list view), and all producers (from settings). If you're about to meet a producer and want current data, you trigger it. You don't wait for the cycle.

**Freshness indicators.** On the list view, each producer shows when any data on their record was last updated. On the detail page, each dossier section shows when it was last updated and by whom (AI refresh or human edit) — creative taste might be fresh while current activity is three months stale, and the team needs to see that. All freshness indicators are derived from change history — no additional tracking needed.

## AI Discovery

The system proactively finds producers WN should know about through directed scans. Discovery is architected around three pillars: an intelligence profile that summarizes what the database already covers, a calibration system that learns from dismissal patterns, and code-based dedup that scales independently of prompt size.

### Intelligence Profile

Before any scan runs, the system generates a compact summary of the database's coverage — not a list of names, but a strategic map: what organizations are represented, geographic distribution, aesthetic/genre coverage, scale distribution. This tells the AI where the database is strong and where there are gaps worth exploring. Regenerated on a schedule (before each discovery scan) and stored for reference.

### Discovery Calibration

Every dismissal feeds into a living summary of what WN doesn't want. Periodically, all dismissals are distilled by an LLM into a concise pattern document: "Of 94 dismissed candidates: 31 too commercially focused, 22 regional-only..." This replaces raw dismissals in prompts with a compact, useful calibration signal. Regenerated when dismissals accumulate past a threshold.

### Directed Scans

Scans have a focus area instead of "search everything":
- **Automated rotation** — configured focus areas (e.g. "recent Off-Broadway openings," "festival producers," "development program leaders") that the system cycles through, selecting the least-recently-used on each run.
- **Manual/ad-hoc** — user-triggered scans with a custom focus: "find producers connected to Michael Arden."
- **Fallback** — when no focus areas are configured, a general industry scan.

Each scan receives the intelligence profile + calibration summary + focus area. No name lists in the prompt.

### Enriched Candidate Data

The discovery LLM captures everything it finds per candidate: name, email candidates (with source and confidence), organization and role, location, website, social profiles, and recent productions. This data is stored in full so the review queue has substantive information for curation.

### Multi-Signal Dedup

After the LLM returns candidates, code-based matching runs against the full database:
- **Hard match** — LinkedIn URL, email, website match against existing producers. Definite duplicates are auto-filtered.
- **Soft match** — fuzzy name similarity, org+role combination, location overlap. Potential duplicates are flagged for human review.
- **Dismissed candidate check** — previously dismissed candidates are detected and flagged.
- Scales to any database size because it's database queries, not prompt engineering.

### Review Queue

Discovered producers surface in a curatorial review queue. Each candidate shows all data the AI found, organized into editable sections: identity, contact (with email selection), location, social links, recent productions, and the AI's reasoning. Dedup warnings appear when matches are detected.

The team can edit any field, toggle email candidates, exclude data, then confirm (which creates a producer with the curated data and triggers dossier research for the deeper analytical layer) or dismiss with a reason (which feeds calibration).

### Scan Tracking

Each scan is recorded with metadata: when it ran, what focus area, how many candidates found, how many survived dedup, and the eventual outcomes (confirmed/dismissed/pending). Scan history is visible in the UI.

AI discovery is a scheduled background job. Runs weekly by default — cadence configurable in settings.

## Intake

Three paths, all first-class, all feeding the same research pipeline.

**Duplicate detection.** Before any new record is created, the system checks for duplicates. Exact email match catches definitive duplicates. Fuzzy name matching catches near-misses. Name + organization is the strongest non-email signal — "Sarah Chen" being added when "S. Chen" at Level Forward already exists is almost certainly a duplicate. Duplicate candidates surface live as the name field is filled in — not on submit, where it feels like a rejection. The system shows candidates with match reasoning and the team confirms or creates a new record. For spreadsheet import, duplicates are flagged during the preview step.

**Manual add.** The team enters a name and whatever they know — org affiliation, email, how they encountered the person, notes. The record is created immediately. AI research runs async.

**URL submission.** The team pastes a URL (Playbill article, BroadwayWorld page, company website, LinkedIn profile). The AI extracts the producer's identity from the page, checks for duplicates, creates the record, and runs the full research pipeline. Part of the manual add flow — not a separate page.

**Spreadsheet import.** Upload a spreadsheet with existing producer data. The system maps columns (name, email, org, notes — whatever exists). Preview before import, with duplicate candidates flagged. On confirm, records are created for each row and AI research kicks off for all of them asynchronously. Import progress is visible — how many processed, how many still researching.

## Interaction Logging

A text field on the producer's detail page. Type a note, submit. Timestamped, attributed to the logged-in team member. Optional: record audio, which is transcribed and stored as text.

On save, the system processes the interaction: extracts follow-up signals from the text, detects show references and creates or updates producer-show connections, regenerates the relationship summary, recomputes relationship state fields (last contact date, interaction count, frequency), and auto-resolves any previously pending follow-up signals.

Quick-search shortcut: the team can search for a producer by name from anywhere in the tool and add an interaction without navigating to the detail page first.

## Relationship State

Derived from data. Never manually set. Stored fields on the producer record — see Relationship State in the data model.

Recomputed whenever interactions change. The state label is derived from the stored fields plus the current date. The specific states:

- **No contact** — in the system, never interacted with. Zero interactions.
- **New** — one or two recent interactions. Relationship just starting.
- **Active** — regular recent interactions. Things are in motion.
- **Waiting** — last interaction has an unresolved follow-up signal.
- **Overdue** — a follow-up signal's timeframe has passed without a new interaction.
- **Gone cold** — used to interact, significant gap since last contact relative to previous frequency. Threshold configurable in settings.

On the detail page, the relationship summary field provides the full natural language picture — stored, not generated on the fly. See Relationship Summary in the data model.

## Show Matching

Producers' LLM calls Shows' MCP tools to get slate data (titles, themes, genres, development stage, structural profile) and reasons about fit with the producer's structured data — creative taste, financial profile, production history, career trajectory.

Results are structured records stored in the database — not generated on the fly. See Show Matching Results in the data model for storage, timing, and refresh behavior. The detail page reads stored results on page load. The page never waits for AI.

## What Producers Consumes from Other Tools

The producer detail page assembles the complete picture of a producer from multiple sources. Producers' own database provides the dossier, interactions, tags, show matching results, relationship state. Other tools provide additional context via code-to-code MCP calls. Each section lights up as the relevant tool comes online. Nothing is broken when a tool doesn't exist yet — those sections simply aren't rendered.

**From Shows.** Pitch history — which of WN's shows has this producer been pitched, when, what happened. Shows owns this data in its database. Producers reads it via MCP. Slate data for show matching — the LLM reads show data via MCP during show matching analysis.

**From Context (when built).** Conversation history — every meeting where this producer was discussed, what was said, what was decided. Surfaces automatically without the team logging it manually.

**From Audience (when built).** Engagement context — whether this producer has engagement history with WN beyond the professional relationship. Attendance at events, email engagement, social interaction.

**From Radar (when built).** Market context — cultural signals relevant to this producer's work, timing intelligence for conversations about specific shows.

**From Collaborators (when built).** Network overlap — whether this producer has working relationships with collaborators WN knows. Enriches the network picture beyond what's in the dossier.

## What Producers Does NOT Own

**Pitching.** Shows owns pitch creation and pitch records. A pitch is always about a show. Shows stores who was pitched, when, what happened. Producers reads this via MCP to show pitch history on the producer detail page.

**Outreach campaigns.** The main spec describes campaigns ("we're submitting Moonshot to these 15 producers"). This is not a feature in Producers. The aggregate view — "show me everyone we've pitched Moonshot to" — is a query that reads from both Producers' connection data and Shows' pitch records.

**Show data.** Producers consumes show data from Shows' MCP tools. It does not store or maintain any representation of WN's slate.

## Data Population

How data gets into Producers' database. AI is one population method among several.

**Human entry.** Interactions (typed or voice memo), manual field edits, tags, producer-show connections, notes on add. Tracked in change history.

**Automated research.** Fills dossier fields — creative taste, financial profile, career trajectory, current activity, press presence, network, awards, production history, org affiliations. Runs at intake (async), on scheduled refresh, and on manual refresh trigger. Also populates show matching results. Uses Claude with web search. Writes to database fields. Tracked in change history as "AI research" or "AI refresh."

**Extracted at save time.** When an interaction is saved: follow-up signals, producer-show connections (from show references in the text), relationship summary regeneration, relationship state fields recomputation (last contact date, interaction count, frequency, follow-up due dates), audio transcription.

**Computed from existing data.** Relationship state label (derived from stored fields and current date), freshness indicators, follow-up overdue status.

**On demand.** Natural language queries across the database — the only moment the user waits for AI. Everything else is stored in the database and the page reads from it.

## MCP Tools

What Producers exposes to other tools and LLMs. All eight are read operations returning structured data from Producers' database. No MCP tool makes an LLM call internally.

Tool descriptions must enumerate what data is included so that LLMs can discover the right tool for their needs.

**1. `producers_search`**
Search producers by criteria. Searchable by: name, email, organization, genres, themes, scale preference, financial profile attributes, location, tags, relationship state, production history attributes (venue, scale, year range). Also handles identity matching — exact lookup by name or email for tools like Funding checking whether a funder is a tracked producer.

**2. `producers_get_record`**
Full profile for a single producer. Returns: identity (name, email, phone, location, photo, website, social links), creative taste (genres, themes, scale preference, aesthetic sensibility), financial profile (lead vs co-producer, capitalization range, funding approach, summary), career trajectory, current activity, press and public presence, network summary (frequent collaborators, co-producers, key relationships), awards summary, relationship summary, dossier metadata (last research date, sources, gaps), intake source, tags.

**3. `producers_get_productions`**
A producer's production history. Returns: list of productions with title, venue (name, type, location), year/run period, producer role (lead/co/associate/executive), scale, run length, outcome, awards tied to each production, co-producers on each production.

**4. `producers_get_organizations`**
A producer's organizational affiliations. Returns: list of organizations with name, type, role/title held, start date, end date, notes.

**5. `producers_get_interactions`**
WN's interaction history with a producer. Returns: chronological list of interactions with date, text, author, and any follow-up signals (implied action, timeframe, resolved/unresolved status).

**6. `producers_get_relationship_state`**
The relationship state for a producer. Returns: last contact date, interaction count, interaction frequency, pending follow-ups (with timeframes and overdue status), computed state label (no contact, new, active, waiting, overdue, gone cold).

**7. `producers_by_show`**
Producers connected to a specific WN show from Producers' own data — connections created from interactions and manual entry. Returns: list of producers with their connection type (pitched, interested, passed, attached), date, notes, and current relationship state. Takes a show ID as input. The complete picture of all producers connected to a show may require also reading from Shows' data.

**8. `producers_show_matches`**
AI-assessed show matching results for a producer. Returns: list of show matches with show reference, fit assessment, reasoning, and when the match was last computed. Takes a producer ID as input. Can also be queried by show ID to get all producers who match a specific show.

## Frontend

All frontend implementation uses the design system defined in `mockups/design-system.html`. That file is the source of truth for every visual decision.

### Navigation

Producers has a sidebar navigation grouped into sections:

- Dashboard, AI Query
- **People:** All Producers, Discovery, Import
- **Management:** Organizations, Shows, Productions, Venues, Social Platforms
- **Data:** Tags, Options, Data Sources
- **Advanced:** AI Configuration
- **Footer:** Settings

Quick Add (create a producer) is always available at the top of the sidebar.

### Pages and Views

**Dashboard.** The default view when opening Producers. Surfaces what needs attention: overdue follow-ups, producers recently added with research still in progress, AI discovery candidates waiting for review, recent interaction activity across the team, significant changes found during dossier refreshes ("Sarah Chen just announced a new production," "Producer X changed organizations"), and show matching results that changed on the last refresh ("New match: Producer X now fits Moonshot"). The dashboard is the system telling you what changed and what needs action.

**Producer list.** All producers, searchable, filterable, sortable. Each row shows: name, current org affiliation, relationship state indicator with recency ("Active — 3 days ago," "No contact"), tags, last updated timestamp. Producers with pending follow-ups that are due or overdue are surfaced prominently. Multi-select supports batch actions including batch refresh.

**Producer detail.** The complete picture of a producer, assembled from Producers' own database and from other tools via MCP.

Page sections in priority order — what matters most is at the top:
1. Dossier sections — creative taste, financial profile, career trajectory, current activity, press presence, network, awards. Rendered from structured fields with design treatment per section, not text blobs. Every field is editable by the team — edits are tracked in change history. Each section shows when it was last updated and by whom (AI refresh or human edit).
2. Show matching — which of WN's shows fit this producer and why. Stored results, not generated on page load. Shows when last computed. Flagged if the slate has changed since last match. Manual re-run available.
3. Relationship state — compact indicator, pending follow-ups, overdue alerts. Relationship summary — the stored natural language synthesis of where things stand.
4. Producer-show connections and pitch history — connections from Producers' own data (manual and AI-detected from interactions) plus pitch history read from Shows via MCP. Unified view, multiple sources. Manually create new connections from the detail page (pick show, pick connection type, add notes).
5. Interaction log — chronological list, scrollable. The "add interaction" field lives here. When Context exists, conversation history from meetings surfaces here alongside manual interactions.
6. Engagement context — read from Audience via MCP when Audience exists. Not rendered until then.
7. Market context — read from Radar via MCP when Radar exists. Not rendered until then.
8. Dossier metadata — sources consulted, gaps where research found thin results.
9. Change history — accessible but not primary. What changed, when, who.
10. Tags — visible and editable.

Manual refresh is available from the detail page — trigger an immediate re-research for this producer.

**Add producer.** A form with two paths that converge. Enter a name and whatever you know (org, email, notes), or paste a URL and let the AI handle it. Duplicate candidates surface live as the name is typed — see Duplicate Detection under Intake. On submit, the record exists immediately and research runs async.

**Spreadsheet import.** Upload flow: choose file, column mapping preview with duplicate candidates flagged, confirm. Progress view showing research status for each imported record.

**AI discovery queue.** A dedicated view showing producers the system found. Each entry: who, why (reasoning), source. Actions: confirm (adds to database, triggers research) or dismiss.

**AI querying.** Natural language interface for querying across the producer database. The behavior: ask a question, get results from the database via LLM with MCP access. The design system provides the component patterns.

**Tags.** View all tags, rename (updates across all producers), merge duplicates, delete. Its own page under Data.

**Options.** Manage the dropdown values used across the tool — producer roles, show roles, scale, medium, org types, venue types, award outcomes, and email types. Grouped sidebar navigation organizes the 10 category/entity-type pairs into three sections (Roles, Classifications, Email Types). Full CRUD: add, edit (value, display label, badge color), reorder, and delete (blocked if the value is referenced by any records). Backed by the `LookupValue` model. Its own page under Data.

**Data Sources.** The managed source list — add, remove, reorder sources the research pipeline always checks when building or refreshing dossiers (IBDB, Playbill, BroadwayWorld, LinkedIn, etc.). This is a floor — the AI also uses its own judgment about where to look beyond the list. Its own page under Data.

**AI Configuration.** Workbench-style page with a sidebar listing all AI behaviors. For each behavior: model selection (from available Anthropic and Google models, with defaults and reset) and prompt editing. Every AI behavior in Producers (dossier research, follow-up extraction, producer-show connection detection, show matching, relationship summary, AI discovery, AI querying) has a system prompt and a user prompt template. Both are fully viewable and editable. User prompt templates contain variables (e.g. `{name}`, `{seed_data}`, `{fields}`) that are replaced at runtime — available variables are documented alongside each template. Its own page under Advanced.

**Settings.** Two sections:

*Thresholds.* Contact health (gone cold threshold) and research cadence (baseline refresh interval, active relationship refresh, active relationship window, discovery scan interval). All configurable in days.

*Scheduled jobs.* When each scheduled job (discovery, refresh) last ran, when it runs next, results from the last cycle. Refresh All Producers button triggers a full re-research across the entire database.

## Scheduled Jobs

**AI discovery.** Default weekly, configurable in settings. The LLM monitors industry sources and identifies producers WN should know about — using WN's slate from Shows, existing producer data, and dismissal patterns to reason about relevance. Results go to the discovery queue.

**Dossier refresh.** Default monthly for all producers, biweekly for active relationships (configurable in settings). Re-researches by checking sources for changes and updating fields where data has changed. Show matching re-runs as part of each refresh. Changes logged in change history.
