"""
AI client initialization for the Intelligence platform.

Provides lazy-initialized clients for Anthropic (Claude) and Google (Gemini).
Clients are created on first use, not at import time, so the app can start
even if API keys haven't been configured yet (they'll fail when actually called).

Usage:

    from shared.backend.ai.clients import get_anthropic_client, get_google_ai_client

    response = get_anthropic_client().messages.create(model="claude-sonnet-4-20250514", ...)
    response = get_google_ai_client().models.generate_content(model="gemini-2.0-flash", ...)
"""

import anthropic
from google import genai

from shared.backend.config import settings

_anthropic_client = None
_google_ai_client = None


def get_anthropic_client():
    """Return the shared Anthropic client, creating it on first call."""
    global _anthropic_client
    if _anthropic_client is None:
        _anthropic_client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    return _anthropic_client


def get_google_ai_client():
    """Return the shared Google GenAI client, creating it on first call."""
    global _google_ai_client
    if _google_ai_client is None:
        _google_ai_client = genai.Client(api_key=settings.google_ai_api_key)
    return _google_ai_client
