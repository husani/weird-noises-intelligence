"""
Intelligence platform — application entry point.

This is the single process that runs everything. On startup:
1. Load config from .env
2. Initialize the scheduler
3. Initialize the tool registry (metadata for the UI)
4. Initialize the shared MCP server (capabilities for code and AI)
5. Generate the MCP ASGI app (HTTP transport) for mounting
6. For each tool: create its DB engine, instantiate its interface
   (which registers MCP tools), register metadata with the registry,
   mount API routes, register scheduled jobs
7. Mount shared API routes (auth, registry)
8. Mount the MCP server at /mcp as an ASGI sub-app
9. In production: serve the built frontend as static files
10. Start the scheduler and MCP server (via lifespan)

The app assumes the database is already set up and seeded.
Use the scripts in scripts/ to manage the database:
  poetry run python scripts/setup_db.py    # create tables
  poetry run python scripts/seed_data.py   # seed reference data
  poetry run python scripts/reset_db.py    # drop, create, seed

Run with: poetry run uvicorn app:app --reload --port 8005
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from shared.backend.auth.middleware import AuthMiddleware
from shared.backend.auth.routes import router as auth_router
from shared.backend.config import settings
from shared.backend.db import create_engine_for, create_session_factory
from shared.backend.mcp import mcp_server
from shared.backend.registry import ToolRegistry, create_registry_router
from shared.backend.scheduler import scheduler
from producers.backend.interface import ProducersInterface
from producers.backend.jobs import ai_discovery, dossier_refresh, refresh_intelligence_profile
from producers.backend.routes import create_producers_router
from skeleton_a.backend.interface import SkeletonAInterface
from skeleton_a.backend.jobs import skeleton_heartbeat
from skeleton_a.backend.routes import create_skeleton_router
from skeleton_b.backend.interface import SkeletonBInterface
from slate.backend.interface import SlateInterface
from slate.backend.routes import create_slate_router

logging.basicConfig(level=logging.INFO)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("google_genai").setLevel(logging.WARNING)
logging.getLogger("mcp.server.lowlevel.server").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

# Generate the MCP ASGI app early so we can use its lifespan
mcp_asgi = mcp_server.http_app(path="/mcp")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the scheduler and MCP server on startup, shut them down on shutdown."""
    scheduler.start()
    logger.info("Scheduler started")
    async with mcp_asgi.lifespan(app):
        yield
    scheduler.shutdown()
    logger.info("Scheduler shut down")


app = FastAPI(title="Intelligence", lifespan=lifespan)

# Middleware — order matters: outermost wraps innermost.
# AuthMiddleware is added first so it wraps SessionMiddleware,
# meaning session data is available when auth checks run.
app.add_middleware(AuthMiddleware)
app.add_middleware(SessionMiddleware, secret_key=settings.jwt_secret)

# Tool registry — stores metadata for nav and home page
registry = ToolRegistry()

# --- Skeleton A ---
# Primary skeleton tool: owns DB, storage, scheduler, and runs all infra tests.
skeleton_engine = create_engine_for("intelligence_skeleton")
skeleton_session_factory = create_session_factory(skeleton_engine)
skeleton_a = SkeletonAInterface(
    session_factory=skeleton_session_factory, mcp_server=mcp_server
)
registry.register(
    "skeleton",
    name="Skeleton",
    description="Infrastructure verification tool",
    path="/skeleton",
)
app.include_router(create_skeleton_router(skeleton_a, mcp_server))

# --- Skeleton B ---
# Minimal tool that exists solely to test cross-tool MCP access.
# No database, no routes, no UI — just MCP tools that A can call.
skeleton_b = SkeletonBInterface(mcp_server=mcp_server)

# --- Producers ---
# WN's knowledge base of theatre producers.
producers_engine = create_engine_for("intelligence_producers")
producers_session_factory = create_session_factory(producers_engine)
producers_interface = ProducersInterface(
    session_factory=producers_session_factory, mcp_server=mcp_server
)
# Initialize AI module with session factory so call_llm can read behaviors
from producers.backend.ai import init as ai_init
ai_init(producers_session_factory)
registry.register(
    "producers",
    name="Producers",
    description="Theatre producer research and relationship intelligence",
    path="/producers",
)
app.include_router(
    create_producers_router(producers_interface, mcp_server, producers_session_factory)
)

# --- Slate ---
# WN's development slate — projects WN is creating, developing, and producing.
slate_engine = create_engine_for("intelligence_slate")
slate_session_factory = create_session_factory(slate_engine)
slate_interface = SlateInterface(
    session_factory=slate_session_factory, mcp_server=mcp_server
)
registry.register(
    "slate",
    name="Slate",
    description="WN's development slate — projects, scripts, and pitches",
    path="/slate",
)
app.include_router(create_slate_router(slate_interface, slate_session_factory))

# Scheduled jobs
scheduler.add_job(skeleton_heartbeat, "interval", minutes=5, id="skeleton_heartbeat")
scheduler.add_job(
    dossier_refresh, "cron", hour=3, args=[producers_session_factory],
    id="producers_dossier_refresh",
)
scheduler.add_job(
    refresh_intelligence_profile, "cron", day_of_week="mon", hour=5,
    args=[producers_session_factory], id="producers_intelligence_profile",
)
scheduler.add_job(
    ai_discovery, "cron", day_of_week="mon", hour=6, args=[producers_session_factory],
    id="producers_ai_discovery",
)

# Shared routes — auth and registry endpoints
app.include_router(auth_router)
app.include_router(create_registry_router(registry))

# Mount the MCP server on /mcp for HTTP access.
# LLMs connect to this endpoint via the mcp_servers API parameter.
app.mount("/mcp", mcp_asgi)

# Production: serve the Vite-built frontend as static files.
# In development, the Vite dev server on port 8006 handles the frontend
# and proxies /api requests to this backend.
dist = Path(__file__).parent / "dist"
if dist.exists():
    app.mount("/", StaticFiles(directory=str(dist), html=True), name="frontend")
