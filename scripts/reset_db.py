"""
Drop all tables, recreate them, and seed reference data.

Convenience wrapper for development: runs setup_db.py then seed_data.py.
All data is destroyed — this is only safe because all current data is test data.

Usage:
    poetry run python scripts/reset_db.py
"""

import sys
from pathlib import Path

# Add project root to path so imports work
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text

from shared.backend.db import Base, create_engine_for
from scripts.setup_db import TOOLS, ensure_databases, main as setup_main
from scripts.seed_data import main as seed_main
from scripts.seed_slate_data import main as seed_slate_main


def drop_all_tables():
    """Drop all tables in every tool database by dropping the public schema."""
    ensure_databases()
    print()
    for db_name, _ in TOOLS:
        print(f"Dropping all tables in {db_name}...")
        engine = create_engine_for(db_name)
        with engine.connect() as conn:
            conn.execute(text("DROP SCHEMA public CASCADE"))
            conn.execute(text("CREATE SCHEMA public"))
            conn.commit()


def main():
    drop_all_tables()
    print()
    setup_main()
    print()
    # seed_data.main() uses argparse, so override sys.argv
    orig_argv = sys.argv
    sys.argv = ["seed_data.py", "--force"]
    seed_main()
    print()
    sys.argv = ["seed_slate_data.py", "--force"]
    seed_slate_main()
    sys.argv = orig_argv


if __name__ == "__main__":
    main()
