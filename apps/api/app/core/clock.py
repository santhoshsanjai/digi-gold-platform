from datetime import date, datetime
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
