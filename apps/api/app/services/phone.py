import re

_INDIAN_MOBILE = re.compile(r"^(?:\+?91|0)?([6-9]\d{9})$")


def normalise_phone(raw: str) -> str:
    """Indian mobile numbers in any common form, stored as +91XXXXXXXXXX."""
    digits = re.sub(r"[\s-]", "", raw)
    match = _INDIAN_MOBILE.match(digits)
    if not match:
        raise ValueError("enter a valid 10-digit Indian mobile number")
    return f"+91{match.group(1)}"
