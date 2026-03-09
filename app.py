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
from shared.backend.db import create_engine_for, create_session_factory, create_tables
from shared.backend.mcp import mcp_server
from shared.backend.registry import ToolRegistry, create_registry_router
from shared.backend.scheduler import scheduler
from skeleton_a.backend.interface import SkeletonAInterface
from skeleton_a.backend.jobs import skeleton_heartbeat
from skeleton_a.backend.models import SkeletonRecord
from skeleton_a.backend.routes import create_skeleton_router
from skeleton_b.backend.interface import SkeletonBInterface

logging.basicConfig(level=logging.INFO)
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
create_tables(skeleton_engine, [SkeletonRecord])
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

# Scheduled jobs
scheduler.add_job(skeleton_heartbeat, "interval", minutes=5, id="skeleton_heartbeat")

# Shared routes — auth and registry endpoints
app.include_router(auth_router)
app.include_router(create_registry_router(registry))

# Mount the MCP server on /mcp for HTTP access.
# LLMs connect to this endpoint via the mcp_servers API parameter.
app.mount("/mcp", mcp_asgi)

# Production: serve the Vite-built frontend as static files.
# In development, the Vite dev server on port 8006 handles the frontend
# and proxies /api requests to this backend.
dist = Path(__file__).parent / "frontend" / "dist"
if dist.exists():
    app.mount("/", StaticFiles(directory=str(dist), html=True), name="frontend")
