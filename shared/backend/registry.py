"""
Tool registry for the Intelligence platform.

The registry stores tool metadata — name, description, and URL path — for
the nav bar and home page. It does NOT handle cross-tool communication or
capabilities. That's the MCP server's job.

Usage in app.py:

    registry = ToolRegistry()
    registry.register(name="Producers", description="...", path="/producers")
"""

from dataclasses import dataclass

from fastapi import APIRouter


@dataclass
class ToolInfo:
    """Metadata for a registered tool."""
    key: str          # Unique identifier, e.g. "producers"
    name: str         # Display name, e.g. "Producers"
    description: str  # Short description for the home page card
    path: str         # Frontend route path, e.g. "/producers"


class ToolRegistry:
    """In-memory registry of tool metadata for the UI."""

    def __init__(self):
        self._tools: dict[str, ToolInfo] = {}

    def register(self, key: str, name: str, description: str, path: str):
        """Register a tool's metadata. Called once per tool at startup."""
        self._tools[key] = ToolInfo(
            key=key, name=name, description=description, path=path,
        )

    def list_tools(self) -> list[dict]:
        """Return all registered tools as dicts (for API serialization)."""
        return [
            {"key": t.key, "name": t.name, "description": t.description, "path": t.path}
            for t in self._tools.values()
        ]


def create_registry_router(registry: ToolRegistry) -> APIRouter:
    """Create a FastAPI router that exposes the tool list.

    Endpoint: GET /api/registry/tools
    Returns a JSON array of {key, name, description, path} objects.
    """
    router = APIRouter(prefix="/api/registry", tags=["registry"])

    @router.get("/tools")
    def list_tools():
        return registry.list_tools()

    return router
