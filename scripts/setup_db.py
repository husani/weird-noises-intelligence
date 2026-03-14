"""
Create all database tables from model definitions.

This script creates the PostgreSQL tables for every tool. It does NOT
populate them with seed data — use seed_data.py for that.

Usage:
    poetry run python scripts/setup_db.py
"""

import sys
from pathlib import Path

# Add project root to path so imports work
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from shared.backend.db import create_engine_for, create_tables
from skeleton_a.backend.models import SkeletonRecord
from producers.backend.models import ALL_MODELS as PRODUCER_MODELS


TOOLS = [
    ("intelligence_skeleton", [SkeletonRecord]),
    ("intelligence_producers", PRODUCER_MODELS),
]


def main():
    for db_name, models in TOOLS:
        print(f"Creating tables in {db_name}...")
        engine = create_engine_for(db_name)
        create_tables(engine, models)
        table_names = [m.__tablename__ for m in models]
        print(f"  {len(table_names)} table(s): {', '.join(table_names)}")
    print("Done.")


if __name__ == "__main__":
    main()
