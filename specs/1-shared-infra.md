# Intelligence — Shared Infrastructure Spec

This is the Phase 1 build spec. Everything in this document exists so that tools can be built. When this is done, a tool can register itself, expose its capabilities as MCP tools callable by other tools and LLMs, serve a frontend behind auth, connect to its own Postgres database, call AI services, store files, and run background jobs.

The master spec defines what Intelligence is and how it's organized. This document defines what gets built first and how.

Shared infrastructure is available, not imposed. A tool can use the shared database plumbing, AI clients, storage utilities, and scheduler — or it can set up its own if that makes more sense for what it needs. The only mandatory pieces are auth and MCP tool registration (so other tools and LLMs can access the tool's capabilities). Everything else is there to make building tools easier, not to constrain how they're built.

## Config

`shared/backend/config.py`

One place for everything environment-dependent. Database host and credentials, Google OAuth client ID and secret, JWT signing key, GCS project and credentials, AI API keys (Anthropic, Google), the application domain, whether we're in dev or production.

Loaded from environment variables via `.env` file in both development and production. No config values hardcoded anywhere in the codebase — if it changes between environments, it lives here.

Config is imported by everything else in shared. It's the first thing that exists.

## Database Plumbing

`shared/backend/db.py`

PostgreSQL, single instance, separate database per tool. The shared layer provides the machinery. Each tool uses it with its own database.

**What shared provides:**
- A function that takes a database name and returns a SQLAlchemy engine connected to that database.
- A session factory tied to an engine.

**What each tool provides:**
- Its own `DeclarativeBase` class in its `models.py`. Each tool has an independent Base — no shared Base, no table name collisions between tools. Two tools can both have a `shows` table because they have separate Bases and separate databases.
- Its own seed scripts in `{tool}/scripts/` — seed data YAML, seed script, test data script.

**Table creation** is handled by `scripts/setup_db.py`, which creates each tool's PostgreSQL database if it doesn't exist, then calls `Base.metadata.create_all()` using each tool's own Base. No `create_tables` helper in shared — each Base knows its own tables.

```python
# talent/backend/models.py
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

class Performer(Base):
    __tablename__ = "performers"
    # talent's own schema

# talent/backend/interface.py or wherever startup happens
from shared.backend.db import create_engine_for
engine = create_engine_for("intelligence_talent")
```

## Auth

`shared/backend/auth/` and `shared/frontend/auth/`

Google OAuth, restricted to WN Google Workspace accounts. One login covers all tools. JWT stored as an httpOnly cookie. FastAPI middleware validates on every request and attaches user identity (email, name, profile picture) to the request object. If the JWT is missing or invalid, redirect to login. After login, redirect back to where the user was trying to go.

**Session lifetime.** Two weeks. The middleware refreshes the JWT on authenticated requests when it's approaching expiry, so active use extends the session without requiring a new login.

**What shared provides:**
- OAuth configuration and callback handling.
- JWT creation and validation.
- FastAPI middleware that authenticates every request.
- A FastAPI dependency (`get_current_user`) that any route can use to access the authenticated user.
- The login page component.
- A frontend auth guard component that wraps protected routes.
- `/api/auth/me` — returns the current user's identity, or 401.
- `/api/auth/logout` — clears the cookie.

## Layout

`shared/frontend/layout/`

A nav bar with links to each tool, the Intelligence logo/wordmark, and the user's identity (name, profile picture, logout). The nav bar reads from the tool registry — when a new tool is registered, it appears in the nav automatically. No hardcoded list.

The nav bar is persistent. The router renders it once and each tool's UI renders below it.

## Design System

`shared/frontend/styles/` and `shared/frontend/components/`

The visual language of Intelligence — colors, typography, spacing, component patterns. Every tool uses these so the whole application feels like one product.

The design system reference file is `specs/mockups/design-system.html`. It is the source of truth for every visual decision — colors, typography, component patterns, interaction states, layout conventions, and responsive behavior. That file contains CSS variables, usage principles, accent color semantics, and 44 component patterns with sample content. Intelligence should feel like a premium consumer product, not an internal tool — the design system sets that bar and every implementation should match its polish.

The design system's CSS is used directly — global CSS variables and semantic class names, not Tailwind, CSS-in-JS, or a translation layer. Shared infrastructure implements that design as reusable React components and CSS. Common UI elements (buttons, form inputs, cards, tables, modals, loading states, and everything else defined in the reference file) are built once in shared and used by every tool. A tool can have its own components for domain-specific UI, but common patterns come from shared.

## Router

`shared/frontend/router.jsx`

Maps URL paths to tool frontends. Each tool is lazy-loaded — the browser only downloads a tool's code when the user navigates to it.

```
/                    → Home (tool directory)
/producers           → Producers frontend
/producers/*         → Producers sub-routes
/talent              → Talent frontend
/talent/*            → Talent sub-routes
/slate               → Slate frontend
...etc
```

Every route is wrapped in the auth guard.

## Tool Registry

`shared/backend/registry.py`

The registry knows what tools exist. That's it. On startup, each tool registers its metadata — name, description, and URL path. The nav bar and home page read from the registry to render the list of available tools.

**What the registry does:**
- Stores tool metadata (name, description, path).
- Provides the list of all registered tools for the home page and nav.

**How registration works in `app.py`:**
```python
# app.py (conceptual)
registry = ToolRegistry()

registry.register(name="Producers", description="...", path="/producers")
registry.register(name="Talent", description="...", path="/talent")
```

**The home page** (`/`) reads from the registry and renders a directory of all registered tools — name, description, link. Nothing hardcoded.

**Registry API endpoint.** `/api/registry/tools` returns the list of registered tools (name, description, path). The nav bar and home page both call this endpoint to know what tools exist.

The registry does not handle cross-tool communication or capabilities. That's the MCP server's job.

## Shared MCP Server

`shared/backend/mcp.py`

The shared MCP server is how tools expose their capabilities. Each tool registers MCP tools on startup — describing what data it has, what queries it can answer, what actions it can perform. MCP is the single interface for all cross-tool access. Every call goes through it.

**Why MCP.** Every tool in Intelligence needs cross-tool access. A tool describes its capabilities once by registering MCP tools, and any caller can use them. The only difference is transport — LLMs reach tools via the server's HTTP URL, code in the same process calls them directly on the server object. One interface, not two modes.

**Implementation.** The MCP server is a FastMCP instance, mounted as an ASGI sub-app inside the FastAPI process at `/mcp`. It runs on HTTP transport so LLM APIs can reach it — when a tool's AI feature makes an Anthropic API call, it passes the MCP server URL and bearer token in the `mcp_servers` parameter. Claude autonomously discovers tools, calls them during reasoning, and returns results. No tool-calling loop code needed. The auth middleware protects `/mcp` with a bearer token (`MCP_SECRET` from `.env`) instead of cookie auth, since LLM API connectors don't have browser sessions.

**What shared provides:**
- A FastMCP server instance (`shared/backend/mcp.py`) that tools register their capabilities with.
- HTTP transport at `/mcp` for LLM API access.
- In-process `call_tool()` and `list_tools()` for code-to-code calls in the same process.

**How tools register capabilities:**
Each tool defines its MCP tools in its `interface.py` using the `@mcp_server.tool` decorator and registers them on startup. The interface class takes `session_factory` and `mcp_server` in `__init__`, then registers MCP tools as closures that capture `self` — this is how they access the database. Tools that don't need a database (like skeleton_b) only take `mcp_server`.

**Naming convention:** Every MCP tool name MUST be prefixed with the tool name and an underscore: `producers_search`, `talent_get_performer`, `slate_list_active`. All tools share one MCP server, so unprefixed names like `search` would collide.

```python
# producers/backend/interface.py (conceptual)
class ProducersInterface:
    def __init__(self, session_factory, mcp_server):
        self._session_factory = session_factory
        self._register_mcp_tools(mcp_server)

    def _register_mcp_tools(self, mcp_server):
        # These closures capture self, giving them access to session_factory.
        # This is why registration happens inside the class, not at module level.
        @mcp_server.tool
        def producers_search(criteria: str) -> list[dict]:
            """Search producers by criteria."""
            return self.search(criteria)

        @mcp_server.tool
        def producers_get(producer_id: int) -> dict:
            """Get full producer record."""
            return self.get_producer(producer_id)

    def search(self, criteria: str) -> list[dict]:
        with self._session_factory() as session:
            # ... actual query
```

**How cross-tool calls work:**

```python
# Code-to-code: Slate's backend getting producer data (in-process, no HTTP)
result = await mcp_server.call_tool("producers_search", {"criteria": "off-broadway musicals"})

# LLM: Producers' AI feature reasoning about show fit
# Pass the MCP server URL and bearer token — the LLM handles the rest
response = client.beta.messages.create(
    model="claude-sonnet-4-6",
    messages=[{"role": "user", "content": "Which slate shows fit this producer?"}],
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

**What each tool exposes** grows naturally. When Producers is built, it registers its capabilities. When Slate is built later and needs producer data, the capabilities are already there. When a new AI feature needs data from three tools, the LLM already has access. No one goes back to add methods to a protocol class.

**The MCP server is not the tool registry.** The registry knows what tools exist (metadata for the UI). The MCP server knows what tools can do (capabilities for code and AI). Two separate concerns, two separate pieces of infrastructure.

**What NOT to do with MCP:**
- Do NOT build a tool-calling loop. The `mcp_servers` parameter in the Anthropic API handles everything — Claude discovers tools, calls them, and returns final results in one API call. There is no `while stop_reason == "tool_use"` loop, no manual tool dispatch.
- Do NOT create Python Protocols, abstract bases, or any other abstraction layer for cross-tool communication. MCP is the single interface. Call `await mcp_server.call_tool(...)` for code-to-code, pass the URL in `mcp_servers` for LLM access. Nothing else.
- Do NOT use cookie auth on `/mcp`. The MCP endpoint uses bearer token auth (`MCP_SECRET`). LLM API connectors pass the token via `authorization_token` in the `mcp_servers` config. Claude Code passes it via `--header` in `.mcp.json`.
- Do NOT register MCP tools at module level. They must be registered inside the interface class `__init__` so the closures can capture `self` for database access.

## AI Client Setup

`shared/backend/ai/`

Initialized Anthropic and Google AI clients, configured from `.env`. Each tool imports the client it needs. If a tool needs a different client configuration for a specific use case, it can instantiate its own.

## File Storage

`shared/backend/storage/`

Google Cloud Storage. One shared bucket configured via `GCS_BUCKET` in `.env`. Each tool uses path prefixes for separation (e.g. `slate/scripts/...`, `talent/headshots/...`). Shared provides the GCS client and common utilities — upload, download, signed URLs for frontend access, delete. Tools pass full paths including their prefix to the storage utilities.

Cross-tool file access follows the same pattern as cross-tool data access. Dramaturg doesn't reach into Slate's paths. It calls Slate's MCP tools, and Slate returns a signed URL or the file data. The boundary is always the MCP tool.

## Background Processing

`shared/backend/scheduler.py`

Three patterns, all running in-process: FastAPI background tasks for event-triggered work, APScheduler for scheduled work, and scheduled jobs that monitor external sources for new data.

Shared provides an initialized APScheduler instance that tools add their jobs to.

```python
# shared/backend/scheduler.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

# In app.py startup
scheduler.start()

# Any tool during registration:
from shared.backend.scheduler import scheduler
scheduler.add_job(radar_monitor, 'interval', hours=6)
scheduler.add_job(talent_refresh, 'cron', hour=3)
```

Jobs are defined in code. When the process starts, tools register their jobs, and the scheduler runs them.

## Application Entry Point

`app.py`

The single entry point that starts everything. On startup:

1. Load config.
2. Initialize the scheduler.
3. Initialize the tool registry.
4. Initialize the shared MCP server (FastMCP instance).
5. Generate the MCP ASGI app (HTTP transport) for mounting.
6. For each tool: create its database engine, instantiate its interface (which registers MCP tools), register its metadata with the registry, mount its API routes under its namespace, register any scheduled jobs.
7. Mount the shared API routes (auth endpoints, registry endpoint).
8. Mount the MCP server at `/mcp` as an ASGI sub-app.
9. In production: serve the built frontend as static files.
10. Start the scheduler and MCP server (via lifespan).
11. Start FastAPI.

## Development Environment

**PostgreSQL.** Install via Homebrew if not already installed.

**Python dependencies.** Managed with Poetry.

**Config.** pydantic-settings. Config class loads from `.env` file. All settings are required — no defaults, no fallbacks.

**Ports.** Every project gets a paired adjacent port in the 8xxx range — backend on the lower number, frontend on the next one up. Before assigning ports, scan `~/Projects/` for `.code-workspace` files and `vite.config.*` files to find every port already in use, then pick the next free pair.

**Backend.** `poetry run uvicorn app:app --reload --port <backend_port>`.

**Frontend.** Vite dev server on `<frontend_port>`. Vite config proxies `/api` to the backend.

**VSCode workspace.** Create an `intelligence.code-workspace` file with folders for root, backend, and frontend. Tasks for backend and frontend that auto-start on workspace open. See existing projects (e.g. `~/Projects/scribe/scribe.code-workspace`) for the pattern.

## Production

FastAPI serves everything. The frontend is built with Vite (`npm run build`), producing static files. FastAPI serves those static files alongside the API routes. Same URLs, same routing, one process.

## Skeleton Tool

A minimal tool that exists solely to verify the shared infrastructure works end-to-end. It gets removed when the first real tool (Producers) is built.

The skeleton is actually two minimal tools — skeleton_a and skeleton_b — so that cross-tool MCP access can be tested end-to-end. Each registers MCP tools with the shared MCP server. The test verifies: skeleton_a's code calling skeleton_b's MCP tools in-process, and an LLM calling both tools' MCP tools via the HTTP endpoint (by passing the MCP server URL in the API call). This confirms the full chain works — tool registration, in-process calling, and LLM-driven tool discovery and execution.

Beyond MCP, the skeleton exercises all other shared infrastructure: registry metadata (appears in the nav and home page), frontend behind auth, Postgres database (read/write), GCS file storage (upload/download/delete), AI client calls, and scheduled background jobs. If the skeleton works, the infrastructure is ready for real tools.