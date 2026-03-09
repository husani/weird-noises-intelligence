# Intelligence — Phase 1 Build Log

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

**Design System** (`frontend/src/styles/design-system.css`)
- Full CSS variable system from `specs/mockups/design-system.html`
- Dark warm palette: deep/base/surface/elevated/hover backgrounds
- Five semantic accent colors: warm, sage, rose, blue, lavender
- Cormorant (display) + Outfit (body) typography
- All component classes from the design system reference

**React Components** (`frontend/src/shared/components/`)
- Button, Badge, SectionCard, StatusIndicator, Modal, Alert, EmptyState, Spinner, Tabs

**Auth Guard** (`frontend/src/shared/auth/AuthGuard.jsx`)
- Calls `/api/auth/me` on mount, redirects to login on 401, provides `useAuth()` context

**Layout** (`frontend/src/shared/layout/Layout.jsx`)
- Sticky nav bar with "Intelligence" wordmark, tool links from registry, user avatar

**Router** (`frontend/src/App.jsx`)
- Lazy-loaded routes wrapped in auth guard: Home (`/`) and Skeleton (`/skeleton/*`)

**Home Page** (`frontend/src/pages/Home.jsx`)
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

**Frontend** (`frontend/src/skeleton/SkeletonPage.jsx`)
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
