"""Outgoing SMS. Only the console backend exists until the client picks an SMS provider."""

import logging
from collections import deque
from dataclasses import dataclass

from app.core.config import get_settings

log = logging.getLogger("digigold.sms")


@dataclass(frozen=True)
class Sms:
    to: str
    body: str


# The latest messages only, so a long-running server does not keep every code in memory.
outbox: deque[Sms] = deque(maxlen=200)


def send_sms(message: Sms) -> None:
    outbox.append(message)
    if get_settings().env == "dev":
        # Without an SMS provider, developers read the sign-in code from the server log.
        log.info("sms to=%s body=%s", message.to, message.body)
    else:
        log.info("sms to=%s", message.to)
