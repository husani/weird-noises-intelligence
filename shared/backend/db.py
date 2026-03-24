"""
Database plumbing for the Intelligence platform.

PostgreSQL, one database per tool. Shared provides connection machinery.
Each tool defines its own Base and models — no shared Base, no table
name collisions between tools.

Usage by a tool:

    from sqlalchemy.orm import DeclarativeBase
    from shared.backend.db import create_engine_for, create_session_factory

    class Base(DeclarativeBase):
        pass

    class MyModel(Base):
        __tablename__ = "my_table"
        ...

    engine = create_engine_for("intelligence_mytool")
    session_factory = create_session_factory(engine)
"""

from urllib.parse import quote_plus

from sqlalchemy import create_engine as sa_create_engine
from sqlalchemy.orm import sessionmaker

from shared.backend.config import settings


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
