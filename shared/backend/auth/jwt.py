"""
JWT token creation and validation for Intelligence auth.

Sessions last 2 weeks. When a token is within 3 days of expiry, the auth
middleware refreshes it automatically — so active users stay logged in
without re-authenticating.

Tokens contain: email, name, picture, exp.
"""

import datetime

from jose import JWTError, jwt

from shared.backend.config import settings

ALGORITHM = "HS256"
SESSION_LIFETIME = datetime.timedelta(weeks=2)
REFRESH_THRESHOLD = datetime.timedelta(days=3)


def create_token(data: dict) -> str:
    """Create a signed JWT with the given payload data and a 2-week expiry."""
    payload = data.copy()
    payload["exp"] = datetime.datetime.now(datetime.timezone.utc) + SESSION_LIFETIME
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_token(token: str) -> dict | None:
    """Decode and validate a JWT. Returns the payload dict, or None if invalid/expired."""
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except JWTError:
        return None


def should_refresh(payload: dict) -> bool:
    """Check if a token is close enough to expiry that it should be refreshed."""
    exp = datetime.datetime.fromtimestamp(payload["exp"], tz=datetime.timezone.utc)
    remaining = exp - datetime.datetime.now(datetime.timezone.utc)
    return remaining < REFRESH_THRESHOLD
