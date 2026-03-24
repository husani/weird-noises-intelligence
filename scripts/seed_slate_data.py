"""
Seed reference data into the Slate database from seed_slate_data.yml.

Inserts lookup values that the Slate tool expects to exist.
Skips if data already exists unless --force is passed.

Usage:
    poetry run python scripts/seed_slate_data.py
    poetry run python scripts/seed_slate_data.py --force
"""

import argparse
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from shared.backend.db import create_engine_for, create_session_factory
from slate.backend.models import SlateAIBehavior, SlateLookupValue

DATA_FILE = Path(__file__).parent / "seed_slate_data.yml"


def seed_lookup_values(session, lookup_data, force=False):
    """Seed lookup values from YAML data."""
    if not force and session.query(SlateLookupValue).count() > 0:
        print("  Lookup values: already seeded, skipping (use --force to re-seed)")
        return 0

    if force:
        session.query(SlateLookupValue).delete()

    count = 0
    for section_key, section in lookup_data.items():
        category = section_key
        entity_type = section["entity_type"]

        for sort_order, entry in enumerate(section["values"]):
            session.add(SlateLookupValue(
                category=category,
                entity_type=entity_type,
                value=entry["value"],
                display_label=entry["display_label"],
                description=entry.get("description"),
                css_class=entry.get("css_class"),
                sort_order=sort_order,
                applies_to=entry.get("applies_to"),
            ))
            count += 1
    return count


def seed_ai_behaviors(session, behaviors, force=False):
    """Seed AI behaviors from YAML data."""
    if not force and session.query(SlateAIBehavior).count() > 0:
        print("  AI behaviors: already seeded, skipping (use --force to re-seed)")
        return 0

    if force:
        session.query(SlateAIBehavior).delete()

    count = 0
    for entry in behaviors:
        session.add(SlateAIBehavior(
            name=entry["name"],
            display_label=entry["display_label"],
            system_prompt=entry["system_prompt"].strip(),
            user_prompt=entry["user_prompt"].strip(),
            model=entry["model"],
        ))
        count += 1
    return count


def main():
    parser = argparse.ArgumentParser(description="Seed Slate reference data")
    parser.add_argument("--force", action="store_true", help="Delete existing data and re-seed")
    args = parser.parse_args()

    print(f"Loading seed data from {DATA_FILE.name}...")
    with open(DATA_FILE) as f:
        data = yaml.safe_load(f)

    engine = create_engine_for("intelligence_slate")
    session_factory = create_session_factory(engine)

    with session_factory() as session:
        lookup_count = seed_lookup_values(session, data["lookup_values"], force=args.force)
        if lookup_count:
            print(f"  Lookup values: {lookup_count} inserted")

        if "ai_behaviors" in data:
            behavior_count = seed_ai_behaviors(session, data["ai_behaviors"], force=args.force)
            if behavior_count:
                print(f"  AI behaviors: {behavior_count} inserted")

        session.commit()

    print("Done.")


if __name__ == "__main__":
    main()
