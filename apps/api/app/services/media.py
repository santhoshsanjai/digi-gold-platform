"""Image uploads: type sniffing, size limits and storage.

Files are written to local disk (DG_MEDIA_DIR) and served by the API. To move to object
storage later, replace LocalStorage with a class offering the same save/delete methods
and set DG_MEDIA_BASE_URL to the bucket or CDN address.
"""

import os
from pathlib import Path
from uuid import uuid4

from app.core.config import get_settings

# Detected from the file's first bytes, never from its name or the browser's claim.
# SVG is left out on purpose: it can carry scripts.
_SIGNATURES: list[tuple[bytes, int, str, str]] = [
    (b"\x89PNG\r\n\x1a\n", 0, "image/png", "png"),
    (b"\xff\xd8\xff", 0, "image/jpeg", "jpg"),
    (b"GIF87a", 0, "image/gif", "gif"),
    (b"GIF89a", 0, "image/gif", "gif"),
    (b"WEBP", 8, "image/webp", "webp"),
    (b"\x00\x00\x01\x00", 0, "image/x-icon", "ico"),
]


class MediaError(ValueError):
    pass


def sniff(head: bytes) -> tuple[str, str]:
    for magic, offset, content_type, ext in _SIGNATURES:
        if head[offset : offset + len(magic)] == magic:
            if content_type == "image/webp" and head[:4] != b"RIFF":
                continue
            return content_type, ext
    raise MediaError("upload a PNG, JPEG, WebP, GIF or ICO image")


class LocalStorage:
    def __init__(self, root: str) -> None:
        self.root = Path(root)

    def save(self, key: str, data: bytes) -> None:
        path = self.root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".part")
        tmp.write_bytes(data)
        os.replace(tmp, path)

    def delete(self, key: str) -> None:
        (self.root / key).unlink(missing_ok=True)


def storage() -> LocalStorage:
    return LocalStorage(get_settings().media_dir)


def new_key(tenant_slug: str, ext: str) -> str:
    return f"{tenant_slug}/{uuid4().hex}.{ext}"


def public_url(key: str, request_base: str) -> str:
    """Absolute URL, so the website and app (on other domains) can load the image."""
    settings = get_settings()
    base = settings.media_base_url or f"{request_base.rstrip('/')}{settings.media_url_path}"
    return f"{base.rstrip('/')}/{key}"


def max_bytes() -> int:
    return get_settings().media_max_mb * 1024 * 1024


def validate(data: bytes) -> tuple[str, str]:
    limit = max_bytes()
    if not data:
        raise MediaError("the file is empty")
    if len(data) > limit:
        raise MediaError(f"images must be {get_settings().media_max_mb} MB or smaller")
    return sniff(data[:16])
