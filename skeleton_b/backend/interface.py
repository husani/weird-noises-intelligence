"""
Skeleton B interface.

Minimal tool that exists solely to test cross-tool MCP access.
Registers MCP tools that skeleton A can call.
"""

from fastmcp import FastMCP


class SkeletonBInterface:
    def __init__(self, mcp_server: FastMCP):
        self._register_mcp_tools(mcp_server)

    def _register_mcp_tools(self, mcp_server: FastMCP):
        """Register this tool's capabilities with the shared MCP server."""

        @mcp_server.tool
        def skeleton_b_echo(message: str) -> dict:
            """Echo a message back. Used to verify cross-tool MCP access."""
            return self.echo(message)

        @mcp_server.tool
        def skeleton_b_info() -> dict:
            """Return info about skeleton B. Used to verify tool discovery."""
            return self.info()

    def echo(self, message: str) -> dict:
        """Echo a message back with metadata."""
        return {"tool": "skeleton_b", "echo": message}

    def info(self) -> dict:
        """Return basic info about this tool."""
        return {"tool": "skeleton_b", "status": "operational", "purpose": "cross-tool MCP verification"}
