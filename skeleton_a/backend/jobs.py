"""
Skeleton A scheduled jobs.

A simple heartbeat that logs every 5 minutes, verifying that the
APScheduler infrastructure is running.
"""

import logging

logger = logging.getLogger(__name__)


def skeleton_heartbeat():
    """Log a heartbeat message. Registered as a 5-minute interval job."""
    logger.info("Skeleton heartbeat: infrastructure scheduler is running")
