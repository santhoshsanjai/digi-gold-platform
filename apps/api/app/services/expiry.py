"""Lot expiry: which lots are close to or past their 365-day limit, and the daily
reminder emails the client chose instead of automatic refunds."""

import asyncio
import logging
from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import or_, select, text

from app.core.clock import local_date, local_now, start_of_day
from app.core.db import SessionLocal, bypass_tenant_scope
from app.core.email import Email, send_email
from app.models import Customer, GoldLot, Tenant
from app.schemas.tenant_config import SchemeSettings, merged

log = logging.getLogger("digigold.expiry")

# Any constant works; it stops two API instances sending the same reminders.
_LOCK_KEY = 72_001


def reminder_due(expires_on: date, today: date, before: list[int], every_after: int) -> bool:
    days_left = (expires_on - today).days
    if days_left > 0:
        return days_left in before
    return (-days_left) % every_after == 0  # expiry day itself, then every N days


def _email(customer: Customer, tenant: Tenant, lots: list[GoldLot], today: date) -> Email:
    name = tenant.branding.get("display_name") or tenant.name
    lines = []
    for lot in lots:
        expires_on = local_date(lot.expires_at)
        state = "expired on" if expires_on <= today else "expires on"
        lines.append(f"- {lot.grams} g bought {local_date(lot.paid_at)}, {state} {expires_on}")
    return Email(
        to=customer.email,
        subject=f"{name}: please redeem your gold savings",
        body=(
            f"Hello {customer.name or 'there'},\n\n"
            f"Some of your gold savings with {name} need to be used within one year of "
            "payment:\n\n" + "\n".join(lines) + "\n\n"
            "Please visit any of our stores and show your redemption code from the app.\n"
        ),
    )


async def send_reminders(today: date | None = None) -> dict[str, int]:
    """Email each customer once a day about their due lots. Safe to run more than once a day."""
    today = today or local_now().date()
    sent = marked = 0
    async with SessionLocal() as session, session.begin():
        got_lock = await session.scalar(text(f"SELECT pg_try_advisory_xact_lock({_LOCK_KEY})"))
        if not got_lock:
            return {"emails": 0, "lots": 0}
        await bypass_tenant_scope(session)
        tenants = await session.scalars(select(Tenant).where(Tenant.status == "active"))
        for tenant in tenants:
            scheme = merged(SchemeSettings, tenant.settings)
            horizon = start_of_day(
                today + timedelta(days=max(scheme.reminder_days_before_expiry, default=0) + 1)
            )
            rows = await session.execute(
                select(GoldLot, Customer)
                .join(Customer, Customer.id == GoldLot.customer_id)
                .where(
                    GoldLot.tenant_id == tenant.id,
                    GoldLot.status == "open",
                    GoldLot.expires_at < horizon,
                    or_(GoldLot.last_reminded_on.is_(None), GoldLot.last_reminded_on < today),
                )
            )
            due: dict[Customer, list[GoldLot]] = defaultdict(list)
            for lot, customer in rows:
                if reminder_due(
                    local_date(lot.expires_at),
                    today,
                    scheme.reminder_days_before_expiry,
                    scheme.reminder_every_days_after_expiry,
                ):
                    due[customer].append(lot)
            for customer, lots in due.items():
                for lot in lots:
                    lot.last_reminded_on = today
                marked += len(lots)
                if customer.email:
                    send_email(_email(customer, tenant, lots, today))
                    sent += 1
    log.info("expiry reminders: %s emails, %s lots", sent, marked)
    return {"emails": sent, "lots": marked}


async def run_daily(hour: int) -> None:
    """Background loop inside the API process: no separate worker or queue to pay for."""
    while True:
        current = local_now()
        next_run = current.replace(hour=hour, minute=0, second=0, microsecond=0)
        if next_run <= current:
            next_run += timedelta(days=1)
        await asyncio.sleep((next_run - current).total_seconds())
        try:
            await send_reminders()
        except Exception:
            log.exception("expiry reminders failed")
