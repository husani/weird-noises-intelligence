"""
Auth middleware for the Intelligence platform.

Runs on every request. Validates the JWT session cookie and attaches user
identity to request.state.user. Behavior:

- Public paths (/api/auth/*) pass through without auth.
- API requests without a valid cookie get a 401 JSON response.
- Browser requests without a valid cookie are redirected to the login page.
- Tokens approaching expiry are automatically refreshed.

Cookie security (secure flag) is disabled in development so HTTP localhost works.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, RedirectResponse

from shared.backend.auth.jwt import create_token, decode_token, should_refresh
from shared.backend.config import settings

COOKIE_NAME = "intelligence_session"
PUBLIC_PATHS = {"/api/auth/login", "/api/auth/callback", "/api/auth/logout"}


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Auth endpoints and static files don't require authentication.
        if path in PUBLIC_PATHS or path.startswith("/static"):
            return await call_next(request)

        # MCP endpoint uses bearer token auth, not cookie auth.
        # LLM API connectors pass the token via Authorization header.
        if path.startswith("/mcp"):
            auth_header = request.headers.get("authorization", "")
            if auth_header == f"Bearer {settings.mcp_secret}":
                return await call_next(request)
            return JSONResponse({"detail": "Invalid MCP token"}, status_code=401)

        token = request.cookies.get(COOKIE_NAME)
        if not token:
            if path.startswith("/api/"):
                return JSONResponse({"detail": "Not authenticated"}, status_code=401)
            return RedirectResponse(f"/api/auth/login?redirect={request.url.path}")

        payload = decode_token(token)
        if payload is None:
            if path.startswith("/api/"):
                return JSONResponse({"detail": "Invalid session"}, status_code=401)
            return RedirectResponse(f"/api/auth/login?redirect={request.url.path}")

        # Attach user identity to the request for downstream handlers
        request.state.user = {
            "email": payload["email"],
            "name": payload["name"],
            "picture": payload.get("picture", ""),
        }

        response = await call_next(request)

        # Silently refresh tokens that are approaching expiry
        if should_refresh(payload):
            new_token = create_token(
                {"email": payload["email"], "name": payload["name"], "picture": payload.get("picture", "")}
            )
            response.set_cookie(
                COOKIE_NAME, new_token, httponly=True, samesite="lax",
                secure=settings.environment != "development", max_age=14 * 86400
            )

        return response
