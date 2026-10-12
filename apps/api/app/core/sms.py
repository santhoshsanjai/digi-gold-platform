"""Outgoing SMS. Only the console backend exists until the client picks an SMS provider."""

import logging
from dataclasses import dataclass

log = logging.getLogger("digigold.sms")


@dataclass(frozen=True)
class Sms:
    to: str
    body: str


outbox: list[Sms] = []


def send_sms(message: Sms) -> None:
    outbox.append(message)
    log.info("sms to=%s", message.to)
