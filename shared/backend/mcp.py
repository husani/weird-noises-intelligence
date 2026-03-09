"""
Shared MCP server for the Intelligence platform.

Tools register their capabilities here on startup. Both code and LLMs
access these capabilities through the same MCP interface:

- LLMs: The MCP server runs on HTTP. When a tool's AI feature calls the
  Anthropic API, it passes the MCP server URL in `mcp_servers` and Claude
  discovers and calls tools autonomously.

- Code: Other tools call MCP tools in-process via `mcp_server.call_tool()`.
  Same tools, same behavior, no HTTP round-trip.

Usage:

    from shared.backend.mcp import mcp_server

    # Register a tool (in a tool's interface.py)
    @mcp_server.tool
    def producers_search(criteria: str) -> list[dict]:
        '''Search producers by criteria.'''
        ...

    # Code-to-code call (in another tool's backend)
    result = await mcp_server.call_tool("producers_search", {"criteria": "..."})
"""

from fastmcp import FastMCP

from shared.backend.config import settings

mcp_server = FastMCP(
    name="Intelligence",
    instructions="MCP server for the Intelligence platform. Provides access to all tool capabilities.",
)
