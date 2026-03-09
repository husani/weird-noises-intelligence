"""
Skeleton A interface.

Business logic and MCP tool registration for the primary skeleton tool.
"""

from fastmcp import FastMCP

from skeleton_a.backend.models import SkeletonRecord


class SkeletonAInterface:
    def __init__(self, session_factory, mcp_server: FastMCP):
        self._session_factory = session_factory
        self._register_mcp_tools(mcp_server)

    def _register_mcp_tools(self, mcp_server: FastMCP):
        """Register this tool's capabilities with the shared MCP server."""

        @mcp_server.tool
        def skeleton_a_write_record(content: str) -> dict:
            """Write a record to skeleton A's database and return it."""
            return self.write_record(content)

        @mcp_server.tool
        def skeleton_a_read_records() -> list[dict]:
            """Read all skeleton A records, newest first."""
            return self.read_records()

    def write_record(self, content: str) -> dict:
        """Write a record to the database and return it."""
        with self._session_factory() as session:
            record = SkeletonRecord(content=content)
            session.add(record)
            session.commit()
            session.refresh(record)
            return {"id": record.id, "content": record.content, "created_at": str(record.created_at)}

    def read_records(self) -> list[dict]:
        """Read all records, newest first."""
        with self._session_factory() as session:
            records = session.query(SkeletonRecord).order_by(SkeletonRecord.created_at.desc()).all()
            return [
                {"id": r.id, "content": r.content, "created_at": str(r.created_at)}
                for r in records
            ]
