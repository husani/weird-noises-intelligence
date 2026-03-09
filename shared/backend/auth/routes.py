"""
Auth API routes for the Intelligence platform.

Endpoints:
- GET /api/auth/login    — Redirects to Google OAuth. Accepts ?redirect= for post-login destination.
- GET /api/auth/callback — Handles the OAuth callback, validates WN domain, sets JWT cookie.
- GET /api/auth/me       — Returns the current user's identity (email, name, picture).
- GET /api/auth/logout   — Clears the session cookie and redirects to /.
"""

from fastapi import APIRouter, Request
from starlette.responses import JSONResponse, RedirectResponse

from shared.backend.auth.jwt import create_token
from shared.backend.auth.middleware import COOKIE_NAME
from shared.backend.auth.oauth import oauth
from shared.backend.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/login")
async def login(request: Request, redirect: str = "/"):
    """Initiate Google OAuth flow. Stores the redirect destination in the session."""
    callback_url = f"{settings.app_domain}/api/auth/callback"
    request.session["redirect_after_login"] = redirect
    return await oauth.google.authorize_redirect(request, callback_url)


@router.get("/callback")
async def callback(request: Request):
    """Handle the Google OAuth callback.

    Validates the user's email domain against ALLOWED_DOMAIN, creates a JWT,
    sets it as an httpOnly cookie, and redirects to the original destination.
    """
    token_data = await oauth.google.authorize_access_token(request)
    user_info = token_data.get("userinfo")

    allowed = f"@{settings.allowed_domain}"
    if not user_info or not user_info.get("email", "").endswith(allowed):
        return JSONResponse({"detail": f"Access restricted to {settings.allowed_domain} accounts"}, status_code=403)

    jwt_token = create_token({
        "email": user_info["email"],
        "name": user_info.get("name", ""),
        "picture": user_info.get("picture", ""),
    })

    redirect_path = request.session.pop("redirect_after_login", "/")
    response = RedirectResponse(redirect_path)
    response.set_cookie(
        COOKIE_NAME, jwt_token, httponly=True, samesite="lax",
        secure=settings.environment != "development", max_age=14 * 86400
    )
    return response


@router.get("/me")
async def me(request: Request):
    """Return the current authenticated user's identity."""
    return request.state.user


@router.get("/logout")
async def logout():
    """Clear the session cookie and redirect to home."""
    response = RedirectResponse("/")
    response.delete_cookie(COOKIE_NAME)
    return response
