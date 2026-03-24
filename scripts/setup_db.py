"""
Create all tool databases and their tables.

For each tool, this script:
1. Connects to the default 'postgres' database
2. Creates the tool database if it doesn't exist
3. Creates all tables using the tool's own Base

Does NOT populate tables with seed data — use each tool's seed script for that.

Usage:
    poetry run python scripts/setup_db.py
"""

import sys
from pathlib import Path
from urllib.parse import quote_plus

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import create_engine, text

from shared.backend.config import settings
from shared.backend.db import create_engine_for

# Import each tool's Base and models (importing models registers them with the Base)
from skeleton_a.backend.models import Base as SkeletonBase
from producers.backend.models import Base as ProducersBase
from slate.backend.models import Base as SlateBase

TOOLS = [
    ("intelligence_skeleton", SkeletonBase),
    ("intelligence_producers", ProducersBase),
    ("intelligence_slate", SlateBase),
]


def ensure_databases():
    """Create each tool database if it doesn't already exist."""
    password = quote_plus(settings.db_password) if settings.db_password else ""
    url = (
        f"postgresql://{settings.db_user}:{password}"
        f"@{settings.db_host}:{settings.db_port}/postgres"
    )
    engine = create_engine(url, isolation_level="AUTOCOMMIT")

    with engine.connect() as conn:
        for db_name, _ in TOOLS:
            exists = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :name"),
                {"name": db_name},
            ).scalar()
            if not exists:
                conn.execute(text(f'CREATE DATABASE "{db_name}"'))
                print(f"Created database: {db_name}")
            else:
                print(f"Database already exists: {db_name}")

    engine.dispose()


def main():
    ensure_databases()
    print()
    for db_name, base in TOOLS:
        print(f"Creating tables in {db_name}...")
        engine = create_engine_for(db_name)
        base.metadata.create_all(bind=engine)
        table_names = sorted(base.metadata.tables.keys())
        print(f"  {len(table_names)} table(s): {', '.join(table_names)}")
    print("Done.")


if __name__ == "__main__":
    main()
