"""
Skeleton A API routes.

CRUD endpoints for skeleton records, plus test endpoints that exercise
each piece of shared infrastructure independently and all-at-once.

Test endpoints:
- GET /api/skeleton/test/db        — Write and read a database record
- GET /api/skeleton/test/ai        — Call both Anthropic and Google AI
- GET /api/skeleton/test/storage   — Upload, download, and delete a GCS file
- GET /api/skeleton/test/mcp       — Code-to-code cross-tool MCP call to skeleton B
- GET /api/skeleton/test/mcp-llm   — LLM calls skeleton B's MCP tools via HTTP (requires public URL)
- GET /api/skeleton/test/all       — Run all tests, report results per subsystem
"""

import logging

from fastapi import APIRouter, Depends
from fastmcp import FastMCP

from shared.backend.ai.clients import get_anthropic_client, get_google_ai_client
from shared.backend.auth.dependencies import get_current_user
from shared.backend.config import settings
from shared.backend.storage.gcs import delete_file, download_file, upload_file

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/skeleton", tags=["skeleton"])


def create_skeleton_router(interface, mcp_server: FastMCP) -> APIRouter:
    """Register all skeleton routes, closing over the tool's interface and MCP server."""

    @router.get("/records")
    def list_records(user: dict = Depends(get_current_user)):
        return interface.read_records()

    @router.post("/records")
    def create_record(request_body: dict, user: dict = Depends(get_current_user)):
        return interface.write_record(request_body["content"])

    @router.get("/test/db")
    def test_db(user: dict = Depends(get_current_user)):
        """Write a record and read all records to verify DB connectivity."""
        record = interface.write_record("Infrastructure test record")
        records = interface.read_records()
        return {"written": record, "total_records": len(records)}

    @router.get("/test/ai")
    async def test_ai(user: dict = Depends(get_current_user)):
        """Test AI clients (Anthropic and Google)."""
        anthropic_response = get_anthropic_client().messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=100,
            messages=[{"role": "user", "content": "Say 'Infrastructure test successful' in exactly those words."}],
        )
        anthropic_text = anthropic_response.content[0].text

        google_response = get_google_ai_client().models.generate_content(
            model="gemini-2.5-flash",
            contents="Say 'Infrastructure test successful' in exactly those words.",
        )
        google_text = google_response.text

        return {"anthropic": anthropic_text, "google": google_text}

    @router.get("/test/mcp-llm")
    async def test_mcp_llm(user: dict = Depends(get_current_user)):
        """Test LLM calling MCP tools via HTTP.

        Passes the MCP server URL to the Anthropic API so Claude can
        discover and call skeleton B's tools autonomously.
        Requires a publicly reachable MCP server URL (won't work on localhost).
        """
        mcp_url = f"{settings.app_domain}/mcp/mcp"
        response = get_anthropic_client().beta.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=200,
            messages=[{
                "role": "user",
                "content": "Call the skeleton_b_echo tool with the message 'MCP infrastructure test'. Return only the exact result.",
            }],
            mcp_servers=[{
                "type": "url",
                "url": mcp_url,
                "name": "intelligence",
                "authorization_token": settings.mcp_secret,
            }],
            tools=[{"type": "mcp_toolset", "mcp_server_name": "intelligence"}],
            betas=["mcp-client-2025-11-20"],
        )
        text = ""
        for block in response.content:
            if hasattr(block, "text"):
                text += block.text

        return {"llm_mcp_result": text, "mcp_url": mcp_url}

    @router.get("/test/storage")
    def test_storage(user: dict = Depends(get_current_user)):
        """Upload, download, and delete a test file in GCS."""
        path = "skeleton/test/hello.txt"
        data = b"Infrastructure test file"

        upload_file(path, data, content_type="text/plain")
        downloaded = download_file(path)
        delete_file(path)

        return {
            "uploaded": True,
            "downloaded_content": downloaded.decode(),
            "cleaned_up": True,
        }

    @router.get("/test/mcp")
    async def test_mcp(user: dict = Depends(get_current_user)):
        """Test cross-tool MCP access: skeleton A calling skeleton B's tools in-process."""
        # List all registered tools
        tools = await mcp_server.list_tools()
        tool_names = [t.name for t in tools]

        # Verify both skeletons registered their tools
        a_registered = "skeleton_a_write_record" in tool_names and "skeleton_a_read_records" in tool_names
        b_registered = "skeleton_b_echo" in tool_names and "skeleton_b_info" in tool_names

        # Cross-tool call: A calling B's MCP tool in-process
        echo_result = await mcp_server.call_tool(
            "skeleton_b_echo", {"message": "cross-tool test from skeleton_a"}
        )
        info_result = await mcp_server.call_tool("skeleton_b_info", {})

        return {
            "all_tool_names": tool_names,
            "skeleton_a_registered": a_registered,
            "skeleton_b_registered": b_registered,
            "cross_tool_echo": echo_result.structured_content,
            "cross_tool_info": info_result.structured_content,
        }

    @router.get("/test/all")
    async def test_all(user: dict = Depends(get_current_user)):
        """Run all infrastructure tests. Each subsystem is tried independently
        so a failure in one doesn't prevent testing the others."""
        results = {}

        try:
            results["db"] = test_db(user)
        except Exception as e:
            results["db"] = {"error": str(e)}

        try:
            results["ai"] = await test_ai(user)
        except Exception as e:
            results["ai"] = {"error": str(e)}

        try:
            results["storage"] = test_storage(user)
        except Exception as e:
            results["storage"] = {"error": str(e)}

        try:
            results["mcp"] = await test_mcp(user)
        except Exception as e:
            results["mcp"] = {"error": str(e)}

        # LLM-via-MCP only works with a publicly reachable URL
        if "localhost" not in settings.app_domain:
            try:
                results["mcp_llm"] = await test_mcp_llm(user)
            except Exception as e:
                results["mcp_llm"] = {"error": str(e)}
        else:
            results["mcp_llm"] = {"skipped": "Requires public URL (not localhost)"}

        results["auth"] = {"user": user}
        return results

    return router
