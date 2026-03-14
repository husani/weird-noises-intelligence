"""
Central configuration for the Intelligence platform.

All settings are loaded from environment variables via a `.env` file.
Every field is required — there are no defaults. If a value is missing,
the app will fail to start with a validation error.

See `.env.example` for the full list of required variables.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """All environment-dependent configuration for Intelligence."""

    # Database — PostgreSQL connection
    db_host: str
    db_port: int
    db_user: str
    db_password: str

    # Auth — Google OAuth for WN Workspace accounts
    google_client_id: str
    google_client_secret: str
    jwt_secret: str  # Used for both JWT signing and session middleware

    # GCS — Google Cloud Storage for file operations
    gcs_project: str
    gcs_bucket: str  # GCS bucket name, e.g. "wn-intelligence-dev"
    gcs_credentials_path: str  # Path to service account JSON

    # AI — API keys for AI services
    anthropic_api_key: str
    google_ai_api_key: str

    # MCP — bearer token for authenticating MCP endpoint access
    mcp_secret: str

    # App
    app_domain: str  # Full origin, e.g. "http://localhost:8005" or "https://intelligence.husani.dev"
    environment: str  # "development" or "production" — controls cookie security, etc.
    allowed_domain: str  # Email domain allowed to log in, e.g. "husani.com" or "wemakeweirdnoises.com"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
