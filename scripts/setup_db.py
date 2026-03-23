"""
Create all tool databases and their tables from model definitions.

For each tool, this script:
1. Connects to the default 'postgres' database
2. Creates the tool database if it doesn't exist
3. Creates all tables from the tool's model definitions

Does NOT populate tables with seed data — use seed_data.py for that.

Usage:
    poetry run python scripts/setup_db.py
"""

import sys
from pathlib import Path
from urllib.parse import quote_plus

# Add project root to path so imports work
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import create_engine, text

from shared.backend.config import settings
from shared.backend.db import create_engine_for, create_tables
from skeleton_a.backend.models import SkeletonRecord
from producers.backend.models import ALL_MODELS as PRODUCER_MODELS
from slate.backend.models import ALL_MODELS as SLATE_MODELS


TOOLS = [
    ("intelligence_skeleton", [SkeletonRecord]),
    ("intelligence_producers", PRODUCER_MODELS),
    ("intelligence_slate", SLATE_MODELS),
]


def ensure_databases():
    """Create each tool database if it doesn't already exist.

    Connects to the default 'postgres' database with AUTOCOMMIT isolation
    (CREATE DATABASE cannot run inside a transaction).
    """
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
                # Database names are hardcoded constants, not user input
                conn.execute(text(f'CREATE DATABASE "{db_name}"'))
                print(f"Created database: {db_name}")
            else:
                print(f"Database already exists: {db_name}")

    engine.dispose()


def main():
    ensure_databases()
    print()
    for db_name, models in TOOLS:
        print(f"Creating tables in {db_name}...")
        engine = create_engine_for(db_name)
        create_tables(engine, models)
        table_names = [m.__tablename__ for m in models]
        print(f"  {len(table_names)} table(s): {', '.join(table_names)}")
    print("Done.")


if __name__ == "__main__":
    main()
