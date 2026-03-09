"""
Background job scheduler for the Intelligence platform.

Single APScheduler instance shared across all tools. Tools register their
own jobs during startup in app.py.

Usage:

    from shared.backend.scheduler import scheduler
    scheduler.add_job(my_function, 'interval', hours=6)
    scheduler.add_job(my_cron_job, 'cron', hour=3)

The scheduler is started/stopped by the app lifespan in app.py.
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()
