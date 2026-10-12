"""In-process cache of each tenant's published website (settings, menu and pages).

Everything for a tenant is dropped when the platform owner saves or publishes;
otherwise entries expire after config_cache_seconds, like the config cache.
"""

import time
from typing import Any

from app.core.config import get_settings

_entries: dict[tuple[str, str], tuple[float, Any]] = {}


def get(slug: str, key: str) -> Any | None:
    hit = _entries.get((slug, key))
    if hit and hit[0] > time.monotonic():
        return hit[1]
    return None


def put(slug: str, key: str, value: Any) -> None:
    _entries[(slug, key)] = (time.monotonic() + get_settings().config_cache_seconds, value)


def invalidate(slug: str) -> None:
    for entry in [k for k in _entries if k[0] == slug]:
        _entries.pop(entry, None)


def clear() -> None:
    _entries.clear()
