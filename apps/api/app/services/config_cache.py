"""In-process cache of each tenant's public configuration.

The app fetches config on every launch, so this avoids a database read per launch.
Entries are dropped when the tenant's config changes on this instance and expire
after config_cache_seconds otherwise (enough while the API runs as a single instance).
"""

import time
from typing import Any

from app.core.config import get_settings

_entries: dict[str, tuple[float, dict[str, Any]]] = {}


def get(slug: str) -> dict[str, Any] | None:
    hit = _entries.get(slug)
    if hit and hit[0] > time.monotonic():
        return hit[1]
    return None


def put(slug: str, value: dict[str, Any]) -> None:
    _entries[slug] = (time.monotonic() + get_settings().config_cache_seconds, value)


def invalidate(slug: str) -> None:
    _entries.pop(slug, None)


def clear() -> None:
    _entries.clear()
