from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from app.core.config import get_settings
from app.core.security import now

_zone = ZoneInfo(get_settings().timezone)


def local_now() -> datetime:
    return now().astimezone(_zone)


def local_date(moment: datetime) -> date:
    return moment.astimezone(_zone).date()


def today() -> date:
    return local_now().date()


def start_of_day(day: date) -> datetime:
    """Midnight at the start of a local (Indian) date, as an aware datetime."""
    return datetime.combine(day, time.min, tzinfo=_zone)
