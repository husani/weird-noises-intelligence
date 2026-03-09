"""
Google OAuth configuration for Intelligence auth.

Uses Authlib's Starlette integration. The OAuth flow is:
1. /api/auth/login redirects to Google
2. Google redirects back to /api/auth/callback
3. Callback validates the user's email domain and sets a JWT cookie

Only @weirdnoises.com accounts are allowed (enforced in the callback route).
"""

from authlib.integrations.starlette_client import OAuth

from shared.backend.config import settings

oauth = OAuth()

oauth.register(
    name="google",
    client_id=settings.google_client_id,
    client_secret=settings.google_client_secret,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)
