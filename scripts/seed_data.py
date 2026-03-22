"""
Seed reference data into the database from seed_data.yml.

Inserts lookup values, social platforms, and other reference data that the
application expects to exist. Skips tables that already have data.

Usage:
    poetry run python scripts/seed_data.py
    poetry run python scripts/seed_data.py --force   # re-seed even if data exists
"""

import argparse
import sys
from pathlib import Path

import yaml

# Add project root to path so imports work
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from shared.backend.db import create_engine_for, create_session_factory
from producers.backend.models import AIBehavior, SocialPlatform, LookupValue

DATA_FILE = Path(__file__).parent / "seed_data.yml"


def seed_social_platforms(session, platforms, force=False):
    """Seed social platforms from YAML data."""
    if not force and session.query(SocialPlatform).count() > 0:
        print("  Social platforms: already seeded, skipping (use --force to re-seed)")
        return 0

    if force:
        session.query(SocialPlatform).delete()

    count = 0
    for i, p in enumerate(platforms):
        session.add(SocialPlatform(
            name=p["name"],
            base_url=p.get("base_url"),
            icon_svg=p.get("icon_svg"),
            description=p.get("description"),
            sort_order=i,
        ))
        count += 1
    return count


def seed_lookup_values(session, lookup_data, force=False):
    """Seed lookup values from YAML data."""
    if not force and session.query(LookupValue).count() > 0:
        print("  Lookup values: already seeded, skipping (use --force to re-seed)")
        return 0

    if force:
        session.query(LookupValue).delete()

    count = 0
    for section_key, section in lookup_data.items():
        # category_name override (for sections like role_producer_show that
        # share the "role" category across different entity_types)
        category = section.get("category_name", section_key)
        entity_type = section["entity_type"]

        for sort_order, entry in enumerate(section["values"]):
            session.add(LookupValue(
                category=category,
                entity_type=entity_type,
                value=entry["value"],
                display_label=entry["display_label"],
                description=entry.get("description"),
                css_class=entry.get("css_class"),
                sort_order=sort_order,
            ))
            count += 1
    return count


def seed_ai_behaviors(session, behaviors, force=False):
    """Seed AI behaviors from YAML data."""
    if not force and session.query(AIBehavior).count() > 0:
        print("  AI behaviors: already seeded, skipping (use --force to re-seed)")
        return 0

    if force:
        session.query(AIBehavior).delete()

    count = 0
    for b in behaviors:
        session.add(AIBehavior(
            name=b["name"],
            display_label=b["display_label"],
            system_prompt=b["system_prompt"],
            user_prompt=b["user_prompt"],
            model=b["model"],
        ))
        count += 1
    return count


def main():
    parser = argparse.ArgumentParser(description="Seed reference data into the database")
    parser.add_argument("--force", action="store_true", help="Delete existing data and re-seed")
    args = parser.parse_args()

    print(f"Loading seed data from {DATA_FILE.name}...")
    with open(DATA_FILE) as f:
        data = yaml.safe_load(f)

    engine = create_engine_for("intelligence_producers")
    session_factory = create_session_factory(engine)

    with session_factory() as session:
        platform_count = seed_social_platforms(session, data["social_platforms"], force=args.force)
        if platform_count:
            print(f"  Social platforms: {platform_count} inserted")

        lookup_count = seed_lookup_values(session, data["lookup_values"], force=args.force)
        if lookup_count:
            print(f"  Lookup values: {lookup_count} inserted")

        behavior_count = seed_ai_behaviors(session, data["ai_behaviors"], force=args.force)
        if behavior_count:
            print(f"  AI behaviors: {behavior_count} inserted")

        session.commit()

    print("Done.")


if __name__ == "__main__":
    main()
