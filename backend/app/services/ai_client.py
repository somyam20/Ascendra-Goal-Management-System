"""Direct Gemini REST integration returning parsed JSON. The model never touches the database."""
import json
import logging

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


class AIUnavailable(Exception):
    """Gemini is not configured, unreachable, or returned something unusable."""


def is_configured() -> bool:
    return bool(settings.gemini_api_key)


def _strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.rstrip().endswith("```"):
            text = text.rstrip()[:-3]
    return text.strip()


def generate_json(system_prompt: str, user_prompt: str, *, temperature: float = 0.4) -> dict:
    if not is_configured():
        raise AIUnavailable("Gemini API key is not configured")
    body = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "generationConfig": {"temperature": temperature, "responseMimeType": "application/json"},
    }
    try:
        resp = httpx.post(
            GEMINI_URL.format(model=settings.gemini_model),
            params={"key": settings.gemini_api_key},
            json=body,
            timeout=settings.gemini_timeout_seconds,
        )
    except httpx.HTTPError as exc:
        log.warning("Gemini request failed: %s", exc.__class__.__name__)
        raise AIUnavailable("Gemini API is unreachable") from exc
    if resp.status_code != 200:
        log.warning("Gemini returned HTTP %s", resp.status_code)
        raise AIUnavailable(f"Gemini API error (HTTP {resp.status_code})")
    try:
        data = resp.json()
        text = "".join(p.get("text", "") for p in data["candidates"][0]["content"]["parts"])
        parsed = json.loads(_strip_fences(text))
    except (KeyError, IndexError, ValueError, TypeError) as exc:
        log.warning("Gemini returned invalid JSON")
        raise AIUnavailable("Gemini returned an invalid response") from exc
    if not isinstance(parsed, dict):
        raise AIUnavailable("Gemini returned an unexpected JSON structure")
    return parsed
