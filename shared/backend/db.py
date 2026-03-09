"""
Database plumbing for the Intelligence platform.

PostgreSQL, one database per tool. Shared provides the machinery —
each tool uses it with its own database name.

Usage by a tool:

    from shared.backend.db import Base, create_engine_for, create_session_factory, create_tables

    class MyModel(Base):
        __tablename__ = "my_table"
        ...

    engine = create_engine_for("intelligence_mytool")
    create_tables(engine, [MyModel])
    session_factory = create_session_factory(engine)
"""

from urllib.parse import quote_plus

from sqlalchemy import create_engine as sa_create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from shared.backend.config import settings


class Base(DeclarativeBase):
    """Shared declarative base. All tool models inherit from this."""
    pass


def create_engine_for(database_name: str):
    """Create a SQLAlchemy engine connected to a specific database.

    The database must already exist in PostgreSQL — this does not create it.
    Password is URL-encoded to handle special characters safely.
    """
    password = quote_plus(settings.db_password) if settings.db_password else ""
    url = (
        f"postgresql://{settings.db_user}:{password}"
        f"@{settings.db_host}:{settings.db_port}/{database_name}"
    )
    return sa_create_engine(url)


def create_session_factory(engine):
    """Create a sessionmaker bound to the given engine.

    Use as a context manager:
        with session_factory() as session:
            session.query(...)
    """
    return sessionmaker(bind=engine)


def create_tables(engine, models: list):
    """Create tables for the specified models only.

    Only creates the tables for the given model classes — does not touch
    tables belonging to other tools, even though they share the same Base.
    Safe to call multiple times (idempotent).
    """
    tables = [model.__table__ for model in models]
    Base.metadata.create_all(bind=engine, tables=tables)
