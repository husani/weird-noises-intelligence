# Intelligence — Architecture Guide

## Overview

Intelligence is a single-process platform that hosts multiple internal tools behind a unified auth layer. One FastAPI backend serves all tools; one React frontend renders all tool UIs. Tools share infrastructure (database plumbing, AI clients, storage, scheduling) but own their data and logic.

Cross-tool access goes through a shared MCP (Model Context Protocol) server. Every tool registers its capabilities as MCP tools. MCP is the single interface — there is one path, not two. The only difference is transport: LLMs reach tools via the server's HTTP URL, code in the same process calls them directly on the server object.

## System Diagram

```
Browser
  │
  ├─ /api/*  ──▶  FastAPI (port 8005)
  │                  ├── AuthMiddleware (JWT cookie)
  │                  ├── /api/auth/*         (shared)
  │                  ├── /api/registry/*     (shared)
  │                  ├── /api/skeleton/*     (skeleton tool)
  │                  ├── /api/producers/*   (producers tool)
  │                  └── /api/<tool>/*       (future tools)
  │
  ├─ /*      ──▶  Vite dev server (port 8006, proxies /api to 8005)
  │               or static files from dist/ in production
  │
LLM APIs
  │
  └─ /mcp/*  ──▶  FastMCP server (ASGI sub-app, same process)
                   Tools registered here are callable by LLMs
                   and by code in-process
```

## Project Structure

```
/intelligence/
    main.jsx              React root, CSS imports
    App.jsx               AuthGuard → Layout → Suspense → lazy routes
    index.html            HTML entry point
    vite.config.js        Vite config with @shared/@producers/@skeleton aliases
    package.json          Node dependencies
    app.py                FastAPI entry point
    shared/
        frontend/
            layout/       Nav bar, tool switcher, page wrapper
            auth/         Login page, OAuth flow, auth guards
            components/   Reusable UI: ActionMenu, Alert, Badge, Button, DataTable,
                          Drawer, EmptyState, LocationAutocomplete, Modal, PlatformIcon,
                          ProducerDrawer, SectionCard, SortHeader, Spinner, StatusIndicator,
                          TableControls, Tabs
            hooks/        useLookupValues
            pages/        Home, LoginPage
            styles/       base.css (imports components.css, layouts.css)
        backend/
            config.py     pydantic-settings
            db.py         SQLAlchemy engine/session/Base
            mcp.py        FastMCP server instance + web_search tool
            registry.py   Tool metadata for nav/home
            auth/         JWT, OAuth, middleware, routes
            ai/           Anthropic + Google AI clients
            storage/      GCS client + utilities
            scheduler.py  APScheduler
    producers/
        frontend/
            pages/        36+ page components (see below)
            styles/       producers.css
            components/   ProductionDrawer
            api.js        Fetch wrappers for /api/producers/*
        backend/
            models.py     SQLAlchemy models (28 tables)
            interface.py  Business logic + 17 MCP tools
            routes.py     FastAPI router (100+ endpoints)
            ai.py         AI pipeline (LLM calls, research, discovery, dedup)
            jobs.py       Scheduled jobs
    skeleton_a/
        frontend/
            SkeletonPage.jsx
        backend/
            models.py, interface.py, routes.py, jobs.py
    skeleton_b/
        backend/
            interface.py
```

Producer frontend pages: ProducersPage (main entry with sidebar nav), Dashboard, ProducerList, ProducerDetail, AddProducer, ImportPage, DiscoveryQueue, AIQuery, AIConfig, Settings, OrganizationsPage/Detail/Edit, ShowsPage/Detail/Edit, ProductionsPage/Detail/Edit, VenuesPage/Detail/Edit, SocialPlatformsPage/Detail/Edit, TagsPage/Detail/Edit, SourcesPage/Detail/Edit, OptionsPage/Edit.

## Backend

### Entry Point — `app.py`

The single `app.py` creates the FastAPI app, adds middleware, initializes the MCP server and tool registry, instantiates each tool, mounts routes, and starts the scheduler. Everything happens at import/startup time.

### Config — `shared/backend/config.py`

All environment-dependent values load from `.env` via pydantic-settings. The `Settings` instance is imported by everything else. No config is hardcoded.

### Database — `shared/backend/db.py`

PostgreSQL, one database per tool. Shared utilities:

- `create_engine_for("db_name")` — returns a SQLAlchemy engine
- `create_session_factory(engine)` — returns a bound sessionmaker
- `create_tables(engine, [Model1, Model2])` — creates only the specified tables

`scripts/setup_db.py` creates databases and tables for all tools. It creates the PostgreSQL database itself if it doesn't exist — no manual `createdb` commands needed. When adding a new tool, add its database and models to setup_db.py.
- `Base` — shared declarative base for all models

Each tool defines its own models inheriting from `Base` and gets its own database. The `create_tables` function is scoped to specific models so tool A's tables never leak into tool B's database.

### Auth — `shared/backend/auth/`

| File | Purpose |
|------|---------|
| `oauth.py` | Authlib Google OAuth registration |
| `jwt.py` | HS256 JWT creation/validation, 2-week lifetime, 3-day auto-refresh |
| `middleware.py` | Validates cookie on every request, attaches user to `request.state` |
| `routes.py` | `/api/auth/login`, `/callback`, `/me`, `/logout` |
| `dependencies.py` | `get_current_user` FastAPI dependency |

Domain restriction configured via `ALLOWED_DOMAIN` env var.

The `/mcp` path uses bearer token auth (`MCP_SECRET`), not cookie auth — LLM API connectors pass the token via `authorization_token`.

### Tool Registry — `shared/backend/registry.py`

Stores tool metadata (name, description, URL path) for the nav bar and home page. The frontend reads `GET /api/registry/tools`. The registry does NOT handle capabilities — that's the MCP server's job.

### Shared MCP Server — `shared/backend/mcp.py`

A FastMCP instance that tools register their capabilities with. Mounted as an ASGI sub-app inside FastAPI at `/mcp`. Also registers a shared `web_search` tool (Gemini 3.1 Flash-Lite with Google Search) available to all LLM callers.

**MCP is the single interface for all cross-tool access.** Every call goes through it:

- **LLMs:** A tool's AI feature passes the MCP server URL in the `mcp_servers` parameter of the Anthropic API call. Claude discovers tools, calls them, and reasons with results autonomously. No tool-calling loop code needed.

- **Code:** Other tools call `await mcp_server.call_tool("tool_name", {"arg": "value"})` directly on the server object. In-process, no HTTP.

Same tools, same behavior, same contract regardless of caller.

### AI Clients — `shared/backend/ai/clients.py`

Lazy-initialized singletons:

- `get_anthropic_client()` — Anthropic (Claude)
- `get_google_ai_client()` — Google GenAI (Gemini)

Created on first call, not at import time.

### Storage — `shared/backend/storage/gcs.py`

Google Cloud Storage utilities: `upload_file()`, `download_file()`, `get_signed_url()`, `delete_file()`. Single bucket configured via `GCS_BUCKET`. Tools use path prefixes for separation (e.g. `skeleton/test/file.txt`).

### Scheduler — `shared/backend/scheduler.py`

APScheduler `AsyncIOScheduler`. Started/stopped via the FastAPI lifespan context manager. Tools add jobs at startup in `app.py`.

Current scheduled jobs:
| Job ID | Schedule | Description |
|--------|----------|-------------|
| `skeleton_heartbeat` | Every 5 minutes | Logs a heartbeat for infra verification |
| `producers_dossier_refresh` | Daily 3am UTC | Checks per-producer cadence, refreshes stale dossiers |
| `producers_intelligence_profile` | Monday 5am UTC | Regenerates intelligence profile from current database |
| `producers_ai_discovery` | Monday 6am UTC | Directed scan for new producer candidates |

## Frontend

### Stack

React 19, React Router DOM 7, Vite 7. No Tailwind — the design system is pure CSS custom properties. The spec at `specs/mockups/design-system.html` is a reference document; application CSS is built from it, never imported directly.

### CSS Architecture

```
shared/frontend/styles/
    base.css              Reset, design tokens, typography (imports the other two)
    components.css        All shared component classes
    layouts.css           Nav, page layout, sidebar, responsive
producers/frontend/styles/
    producers.css         Producer-specific classes
```

`main.jsx` imports `@shared/styles/base.css`. `ProducersPage.jsx` imports `@producers/styles/producers.css`. CSS custom properties (`style={{ '--var': value }}`) are the only acceptable use of inline styles — for passing computed values to CSS classes.

### Vite Aliases

```
@shared   → shared/frontend/
@producers → producers/frontend/
@skeleton  → skeleton_a/frontend/
```

### Auth Flow

1. `AuthGuard` calls `GET /api/auth/me`
2. On 401 → redirect to `/login`
3. Login page sends user to `GET /api/auth/login` → Google OAuth
4. Callback validates domain, sets JWT cookie, redirects to `/`
5. All subsequent API calls include the cookie automatically

### Adding a Page

1. Create your component in `<tool>/frontend/pages/`
2. Add a lazy route in `App.jsx` using the `@<tool>` alias
3. The nav link appears automatically from the registry

## How to Add a New Tool

> **Read the [Conventions](#conventions) and [Common Mistakes](#common-mistakes--do-not-do-these) sections before building.** They cover naming rules, the interface pattern, and things that will waste your time if you get them wrong.
>
> **Reference implementation:** Study `skeleton_a/backend/` (interface, routes, models) and `skeleton_a/frontend/SkeletonPage.jsx` as working examples of every pattern described below.

### 1. Backend

Create `<tool_name>/backend/` with:

```
<tool_name>/backend/
  __init__.py
  models.py       — SQLAlchemy models inheriting from Base
  interface.py    — Business logic + MCP tool registration
  routes.py       — FastAPI router factory
  jobs.py         — Scheduled job functions (if needed)
```

**models.py:**
```python
from shared.backend.db import Base
from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime, timezone

class MyModel(Base):
    __tablename__ = "my_models"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
```

**interface.py** (see [Conventions](#conventions) for why this pattern works this way):
```python
from fastmcp import FastMCP

class MyToolInterface:
    def __init__(self, session_factory, mcp_server: FastMCP):
        self._session_factory = session_factory
        self._register_mcp_tools(mcp_server)

    def _register_mcp_tools(self, mcp_server):
        # Closures capture self — this is how MCP tools access the DB.
        # Tool names MUST be prefixed with the tool name (e.g. my_tool_).
        @mcp_server.tool
        def my_tool_search(query: str) -> list[dict]:
            """Search my tool's data."""
            return self.search(query)

    def search(self, query: str) -> list[dict]:
        with self._session_factory() as session:
            # ...
```

**routes.py:**
```python
from fastapi import APIRouter

def create_my_tool_router(interface):
    router = APIRouter(prefix="/api/my-tool", tags=["my-tool"])

    @router.get("/items")
    def list_items():
        return interface.list_items()

    return router
```

### 2. Frontend

Create `<tool_name>/frontend/pages/<ToolName>Page.jsx` and add a lazy route in `App.jsx`:

```jsx
const MyToolPage = lazy(() => import('@<tool_name>/pages/<ToolName>Page'))
// in routes:
<Route path="/<tool_name>/*" element={<MyToolPage />} />
```

Create `<tool_name>/frontend/styles/<tool_name>.css` for tool-specific styles. Import it from the tool's main page component.

The nav link and home page card appear automatically from the registry.

### 3. Wire It Up in `app.py`

```python
from <tool_name>.backend.models import MyModel
from <tool_name>.backend.interface import MyToolInterface
from <tool_name>.backend.routes import create_my_tool_router

engine = create_engine_for("intelligence_<tool_name>")
create_tables(engine, [MyModel])
session_factory = create_session_factory(engine)
interface = MyToolInterface(session_factory=session_factory, mcp_server=mcp_server)

registry.register(
    "<tool_name>",
    name="My Tool",
    description="What this tool does",
    path="/<tool_name>",
)

app.include_router(create_my_tool_router(interface))
```

### 4. Register the Database

Add your tool's database and models to `scripts/setup_db.py`:

```python
from <tool_name>.backend.models import ALL_MODELS as TOOL_MODELS

TOOLS = [
    ...
    ("intelligence_<tool_name>", TOOL_MODELS),
]
```

Then run `poetry run python scripts/setup_db.py` — it creates the database if it doesn't exist and creates all tables. No manual database creation needed.

### 5. Using Other Tools' MCP Capabilities

> **Before writing any cross-tool or MCP code, read this section and the Conventions section below carefully.** Getting MCP wrong wastes significant time.

**From code (in-process):**
```python
result = await mcp_server.call_tool("other_tool_search", {"query": "..."})
```

**From an LLM (via API):**
```python
response = client.beta.messages.create(
    model="claude-sonnet-4-6",
    messages=[{"role": "user", "content": "..."}],
    mcp_servers=[{
        "type": "url",
        "url": f"{settings.app_domain}/mcp/mcp",
        "name": "intelligence",
        "authorization_token": settings.mcp_secret,
    }],
    tools=[{"type": "mcp_toolset", "mcp_server_name": "intelligence"}],
    betas=["mcp-client-2025-11-20"],
)
```

## Conventions

These are mandatory. Follow them exactly.

### MCP Tool Naming

Every MCP tool name MUST be prefixed with the tool's name and an underscore: `producers_search`, `talent_get_performer`, `shows_list_active`. This prevents collisions — all tools register on the same MCP server, so `search` or `get` would conflict. Look at the skeleton tools for the pattern: `skeleton_a_write_record`, `skeleton_b_echo`.

### The Interface Pattern (Why It Works This Way)

Each tool's `interface.py` defines a class that:
1. Takes `session_factory` and `mcp_server` in `__init__`
2. Calls `_register_mcp_tools(mcp_server)` during init
3. Uses `@mcp_server.tool` decorator inside `_register_mcp_tools` to register closures
4. Those closures call methods on `self`, which has access to `session_factory`

This is not arbitrary. The MCP tools are closures that capture `self`, which is how they access the database session factory and any other tool state. If you register tools at module level or outside the class, they won't have access to the session factory.

```python
# CORRECT — closure captures self, has DB access
class MyToolInterface:
    def __init__(self, session_factory, mcp_server: FastMCP):
        self._session_factory = session_factory
        self._register_mcp_tools(mcp_server)

    def _register_mcp_tools(self, mcp_server):
        @mcp_server.tool
        def my_tool_search(query: str) -> list[dict]:
            """Search my tool's records."""
            return self.search(query)  # self is captured by the closure

    def search(self, query: str) -> list[dict]:
        with self._session_factory() as session:
            # ... actual DB query
```

```python
# WRONG — no access to session_factory
@mcp_server.tool
def my_tool_search(query: str) -> list[dict]:
    # How do you get a DB session here? You can't.
    pass
```

### MCP Tool Descriptions

The `@mcp_server.tool` decorator uses the function's docstring as the tool description. LLMs read this to decide when and how to call the tool. Write clear, specific docstrings that explain what the tool returns and when to use it. Type hints on parameters are auto-converted to JSON Schema — use them.

### Storage Paths

One shared GCS bucket. Each tool uses its name as a path prefix: `shows/scripts/hamilton/v2.pdf`, `talent/headshots/12345.jpg`. Never access another tool's paths directly — call their MCP tools instead.

## Common Mistakes — Do NOT Do These

### Do NOT build a tool-calling loop for LLM-via-MCP

The `mcp_servers` parameter in the Anthropic API handles everything. You pass the URL, Claude discovers the tools, calls them, and returns results. There is no loop, no manual tool dispatch, no `tool_use` block parsing needed on your end.

```python
# WRONG — do not do this
while response.stop_reason == "tool_use":
    tool_call = response.content[...]
    result = call_tool(tool_call)
    messages.append(result)
    response = client.messages.create(...)

# CORRECT — one call, Claude handles tool use internally
response = client.beta.messages.create(
    model="claude-sonnet-4-6",
    messages=[...],
    mcp_servers=[{
        "type": "url",
        "url": f"{settings.app_domain}/mcp/mcp",
        "name": "intelligence",
        "authorization_token": settings.mcp_secret,
    }],
    tools=[{"type": "mcp_toolset", "mcp_server_name": "intelligence"}],
    betas=["mcp-client-2025-11-20"],
)
# response.content has the final answer — Claude already called whatever tools it needed
```

### Do NOT create separate interfaces or protocols for cross-tool access

MCP is the single interface. Do not create a Python Protocol class, an abstract base, or any other abstraction layer for cross-tool communication. If tool A needs data from tool B, it calls `await mcp_server.call_tool("tool_b_whatever", {...})`. That's it.

### MCP endpoint auth uses a bearer token, not cookies

The `/mcp` endpoint is protected by a bearer token (`MCP_SECRET` in `.env`), not by the cookie-based auth that protects browser routes. LLM API connectors pass the token via the `authorization_token` field in the `mcp_servers` config. Claude Code passes it via the `--header` flag in `.mcp.json`. Do not add cookie auth to `/mcp` — it uses a different auth mechanism.

### Do NOT confuse the registry with the MCP server

The registry stores metadata (name, description, URL path) for the nav bar and home page. The MCP server stores capabilities (callable tools) for code and AI. They are separate. Registering with the registry does NOT register MCP tools, and vice versa. You must do both in `app.py`.
