# Intelligence — Build Log

## What Was Built

Phase 1: Shared Infrastructure, as defined in `specs/1-shared-infra.md`. Everything a tool needs to register itself, expose capabilities via MCP, serve a frontend behind auth, connect to Postgres, call AI services, store files, and run background jobs.

### Backend Infrastructure

**Config** (`shared/backend/config.py`)
- pydantic-settings `Settings` class loading from `.env`
- All fields required: DB credentials, Google OAuth, JWT secret, GCS (project, bucket, credentials path), AI API keys, app domain, environment, allowed email domain

**Database** (`shared/backend/db.py`)
- SQLAlchemy with per-tool databases
- `create_engine_for(db_name)` builds a connection URL from config
- `create_session_factory(engine)` returns a bound sessionmaker
- Shared `Base` declarative base for all tool models
- `create_tables(engine, models)` creates only specified tables per engine

**Auth** (`shared/backend/auth/`)
- `oauth.py` — Authlib Google OAuth registration with OpenID Connect
- `jwt.py` — HS256 JWT creation/validation, 2-week session lifetime, auto-refresh when within 3 days of expiry
- `middleware.py` — Starlette middleware; validates JWT cookie, attaches user to `request.state.user`, passes `/mcp` through unauthenticated for LLM API access
- `routes.py` — `/api/auth/login`, `/api/auth/callback` (validates `ALLOWED_DOMAIN`), `/api/auth/me`, `/api/auth/logout`
- `dependencies.py` — `get_current_user` FastAPI dependency

**Tool Registry** (`shared/backend/registry.py`)
- Stores tool metadata only (name, description, path) for the nav bar and home page
- `create_registry_router()` returns a FastAPI router with `GET /api/registry/tools`
- Does NOT handle cross-tool communication — that's the MCP server's job

**Shared MCP Server** (`shared/backend/mcp.py`)
- FastMCP instance — the single interface for all cross-tool access
- Mounted as ASGI sub-app at `/mcp` on HTTP transport
- LLMs: pass the URL in `mcp_servers` parameter of API calls; Claude discovers and calls tools autonomously
- Code: call `await mcp_server.call_tool()` directly on the server object (in-process, no HTTP)
- Tools register capabilities via `@mcp_server.tool` decorator in their interface

**AI Clients** (`shared/backend/ai/clients.py`)
- `get_anthropic_client()` — lazy-initialized Anthropic client
- `get_google_ai_client()` — lazy-initialized Google GenAI client

**Storage** (`shared/backend/storage/gcs.py`)
- Lazy-initialized GCS client from service account JSON
- Single configured bucket (`GCS_BUCKET`), tools use path prefixes
- `upload_file()`, `download_file()`, `get_signed_url()`, `delete_file()`

**Scheduler** (`shared/backend/scheduler.py`)
- APScheduler `AsyncIOScheduler` instance, started/stopped via app lifespan

**App Entry Point** (`app.py`)
- Lifespan manager starts/stops scheduler and MCP server
- Auth middleware + session middleware
- Initializes registry, MCP server, skeleton tools
- Mounts auth routes, registry routes, skeleton routes, MCP server at `/mcp`
- Serves built frontend as static files in production

### Frontend Infrastructure

**CSS Architecture** (`shared/frontend/styles/`)
- `base.css` — reset, design tokens (CSS custom properties), typography; imports components.css and layouts.css
- `components.css` — all shared component classes built from the design system spec
- `layouts.css` — nav, page layout, sidebar, responsive breakpoints
- Dark warm palette: deep/base/surface/elevated/hover backgrounds
- Five semantic accent colors: warm, sage, rose, blue, lavender
- Cormorant (display) + Outfit (body) typography
- Design system spec at `specs/mockups/design-system.html` is a reference document, never imported directly

**React Components** (`shared/frontend/components/`)
- Button, Badge, SectionCard, StatusIndicator, Modal, Alert, EmptyState, Spinner, Tabs

**Auth Guard** (`shared/frontend/auth/AuthGuard.jsx`)
- Calls `/api/auth/me` on mount, redirects to login on 401, provides `useAuth()` context

**Layout** (`shared/frontend/layout/Layout.jsx`)
- Sticky nav bar with "Intelligence" wordmark, tool links from registry, user avatar

**Router** (`App.jsx`)
- Lazy-loaded routes wrapped in auth guard: Home (`/`) and Skeleton (`/skeleton/*`)

**Home Page** (`shared/frontend/pages/Home.jsx`)
- Tool directory cards from registry, empty state when none

### Skeleton Tools

Two minimal tools that verify shared infrastructure end-to-end, including cross-tool MCP access.

**Skeleton A** (`skeleton_a/backend/`)
- `models.py` — `SkeletonRecord` model (id, content, created_at)
- `interface.py` — registers `skeleton_a_write_record` and `skeleton_a_read_records` MCP tools
- `routes.py` — CRUD + test endpoints: DB, AI, storage, cross-tool MCP (code-to-code), LLM-via-MCP (requires public URL), all-at-once
- `jobs.py` — `skeleton_heartbeat()` logged every 5 minutes

**Skeleton B** (`skeleton_b/backend/`)
- `interface.py` — registers `skeleton_b_echo` and `skeleton_b_info` MCP tools
- No database, no routes, no UI — exists solely for cross-tool testing

**Frontend** (`skeleton_a/frontend/SkeletonPage.jsx`)
- "Run all infrastructure tests" button
- Displays test results per subsystem with pass/fail badges

### Dev Environment

- **PostgreSQL** — Homebrew postgresql@17, `intelligence_skeleton` database
- **Python** — Poetry with FastAPI, Uvicorn, SQLAlchemy, psycopg2, pydantic-settings, python-jose, Authlib, httpx, google-cloud-storage, anthropic, google-genai, APScheduler, itsdangerous, python-multipart, fastmcp
- **Frontend** — Vite + React + React Router DOM
- **Ports** — backend 8005, frontend 8006
- **Workspace** — `intelligence.code-workspace` with auto-start tasks
- **Config** — `.env` with dev values, `.env.example` as template, `.credentials/` for GCS SA key
- **`.gitignore`** — .env, .credentials/, .venv, __pycache__, node_modules, dist, .DS_Store

### Verification

- App boots, all routes registered, MCP server live at `/mcp`
- Auth middleware blocks unauthenticated requests, passes `/mcp` through
- DB write/read confirmed
- AI clients (Anthropic + Gemini) both respond
- GCS upload/download/delete confirmed
- MCP: 4 tools registered (2 from skeleton_a, 2 from skeleton_b)
- Cross-tool MCP: skeleton_a successfully calls skeleton_b's tools in-process
- LLM-via-MCP: ready for testing after deployment (requires public URL)
- Registry returns skeleton tool
- Frontend builds cleanly

---

## Phase 2: Producers Tool

Built as defined in `specs/2-producers.md`. The first real tool on the Intelligence platform — WN's knowledge base of theatre producers with AI-powered research, relationship tracking, and show matching.

### Backend (`producers/backend/`)

**Data Model** (`models.py`) — 21 tables:
- `producers` — core record with identity, dossier fields, relationship state, research status
- `productions` — separate entity, many-to-many with producers via `producer_productions` (with role)
- `organizations` — separate entity, many-to-many with producers via `producer_organizations` (with role, dates)
- `venues` — separate entity, linked to productions
- `awards` — attached to productions (not directly to producers)
- `interactions` — timestamped touchpoints with WN team members
- `follow_up_signals` — AI-extracted from interaction text, with due dates and resolved status
- `tags` / `producer_tags` — ad-hoc labels, many-to-many
- `producer_show_connections` — connections to WN shows (from interactions and manual entry)
- `show_matching_results` — AI-assessed fit between producers and shows
- `change_history` — field-level audit log for every change (who, when, old/new value)
- `producer_settings` — tool-level configuration (refresh cadence, thresholds, prompts)
- `discovery_candidates` — AI-discovered producers pending team review, with dedup status/matches and scan linkage
- `discovery_scans` — tracks each discovery run (focus, timing, candidate counts, status)
- `discovery_focus_areas` — configurable areas for directed scans (name, description, rotation order)
- `intelligence_profiles` — auto-generated database coverage summaries for discovery context
- `discovery_calibrations` — distilled dismissal patterns for discovery calibration
- `research_sources` — managed source list the AI always checks

**Interface** (`interface.py`) — Business logic + 8 MCP tools:
1. `producers_search` — search by name, email, org, genres, themes, location, tags, state
2. `producers_get_record` — full producer profile with all dossier fields
3. `producers_get_productions` — production history with venues, awards, co-producers
4. `producers_get_organizations` — organizational affiliations with roles and dates
5. `producers_get_interactions` — interaction history with follow-up signals
6. `producers_get_relationship_state` — computed state label + pending follow-ups
7. `producers_by_show` — producers connected to a specific WN show
8. `producers_show_matches` — AI-assessed show matching results

Plus route-facing methods: list, create, update, add interaction, tags, show connections, dashboard, discovery review, settings, import, change history, duplicate detection.

**AI Pipeline** (`ai.py`) — All AI behaviors:
- Dossier research — Claude with web search, fills structured fields from public sources, discovers email candidates with source/confidence
- Follow-up extraction — detects implied actions and timeframes from interaction text
- Show connection detection — finds show references in interaction text
- Relationship summary — natural language synthesis of current relationship state
- Show matching — assesses producer-show fit based on creative/financial/career alignment
- AI query — natural language interface to the database via LLM + MCP
- Relationship state computation — derives state label from stored fields + current date
- Intelligence profile generation — summarizes database coverage (orgs, geography, aesthetics, scale) for discovery context
- Discovery calibration — distills dismissal patterns into calibration summary
- Multi-signal dedup — code-based matching (LinkedIn, email, website, fuzzy name) against producers and dismissed candidates

**Prompts** (`prompts.py`) — System and user prompt templates for all 7 AI behaviors. Each is stored with a settings key so teams can customize prompts via the Settings page.

**Routes** (`routes.py`) — 30+ API endpoints under `/api/producers/*`:
- CRUD for producers with background research on create
- Interaction logging with background AI processing (follow-ups, show detection, summary)
- Dashboard data aggregation
- Discovery queue management
- Settings management (cadence, thresholds, sources, tags)
- Spreadsheet import with duplicate detection
- AI querying
- Manual dossier refresh
- Show connections and matches

**Jobs** (`jobs.py`) — Scheduled background tasks:
- `dossier_refresh` — daily at 3am UTC, checks per-producer cadence (monthly/biweekly)
- `refresh_intelligence_profile` — Mondays at 5am UTC, regenerates intelligence profile from current database
- `ai_discovery` — Mondays at 6am UTC, directed scan with focus area rotation, intelligence profile context, calibration, multi-signal dedup, scan tracking

### Frontend (`producers/frontend/`)

**Pages** — 8 views, all lazy-loaded with sub-routing:
- **Dashboard** — stats grid, overdue follow-ups, research in progress, recent activity, AI updates
- **Producer List** — searchable/filterable/sortable table with relationship state badges, pagination
- **Producer Detail** — tabbed view (Dossier, Shows, Interactions, History, Identity) with editable fields
- **Add Producer** — form with live duplicate detection, URL submission, initial tags
- **Spreadsheet Import** — CSV upload with preview, quoted-field parsing, progress reporting
- **Discovery Queue** — curatorial review with expandable cards, inline editing, email candidate selection, dedup warnings, scan history
- **AI Query** — natural language search interface with conversation history
- **Settings** — refresh cadence, discovery cadence, relationship thresholds, research sources, tag management

**API Client** (`api.js`) — typed fetch wrappers for all 30+ endpoints.

### Wiring (`app.py`)

- `intelligence_producers` database created, all 21 tables initialized
- `ProducersInterface` instantiated with session factory and MCP server (registers 8 MCP tools)
- Registered in tool registry: name "Producers", path `/producers`
- Routes mounted at `/api/producers/*`
- Scheduled jobs: `producers_dossier_refresh` (daily 3am), `producers_intelligence_profile` (Monday 5am), `producers_ai_discovery` (Monday 6am)
- Frontend route: `/producers/*` lazy-loads `ProducersPage`

### Bug Scan & Fixes

Two rounds of deep code review identified and fixed 20 bugs:

**Critical fixes:**
- Missing `datetime` import in background task + broken `__import__` for Producer model
- Pagination broken when filtering by relationship state (computed in Python, not DB)

**High-severity fixes:**
- Dossier refresh sharing one session across all producers (one failure poisons all)
- Deprecated `Query.get()` replaced with `.filter_by().first()`
- `update_producer` filtering out `None` values (prevented clearing fields)

**Medium fixes:**
- `async def ai_query` blocking event loop → changed to sync `def`
- Auto-resolving ALL follow-ups on any interaction → only overdue ones
- `ProducerDetail` using `Promise.all` → `Promise.allSettled` for independent failure handling
- N+1 queries in `search` and `list_producers` → added `joinedload`
- CSV parser not handling quoted fields with commas → proper parser
- Dashboard interactions missing producer name → added `joinedload` + `producer_name` field
- Discovery queue button stuck on error → added try/finally
- `gone_cold_threshold` hardcoded → parameterized with settings support
- Show connections route using raw session → moved to interface method

### Decisions

Design decisions where the spec left room for interpretation are documented in `producers/DECISIONS.md`.

### Verification

- App boots with all 12 MCP tools (8 producers + 4 skeleton)
- All 30+ API routes registered under `/api/producers/*`
- 4 scheduled jobs active (skeleton heartbeat + dossier refresh + intelligence profile + AI discovery)
- Frontend builds cleanly with all 8 lazy-loaded pages
- `intelligence_producers` database with 17 tables created
- 5 default research sources seeded (IBDB, Playbill, BroadwayWorld, LinkedIn, Broadway League)
