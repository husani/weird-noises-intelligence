"""
Skeleton A database models.

Minimal model for verifying DB infrastructure.
"""

from sqlalchemy import Column, DateTime, Integer, String, func

from shared.backend.db import Base


class SkeletonRecord(Base):
    """Simple record for testing database read/write operations."""
    __tablename__ = "skeleton_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    content = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
