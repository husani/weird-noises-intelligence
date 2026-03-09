"""
FastAPI dependencies for auth.

Usage in any route:

    from shared.backend.auth.dependencies import get_current_user

    @router.get("/my-endpoint")
    def my_endpoint(user: dict = Depends(get_current_user)):
        print(user["email"])  # guaranteed to exist — middleware already validated
"""

from fastapi import Request


def get_current_user(request: Request) -> dict:
    """FastAPI dependency that returns the authenticated user from request state.

    Returns a dict with keys: email, name, picture.
    Only works on routes behind the AuthMiddleware (which is all of them).
    """
    return request.state.user
