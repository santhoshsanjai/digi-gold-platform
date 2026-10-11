"""Moves grams and rupees. Every change writes a ledger entry and updates the customer's
running totals in the same transaction."""

from dataclasses import dataclass
from datetime import timedelta
from typing import Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import now
from app.models import Customer, GoldLot, LedgerEntry, PaymentOrder, Tenant
from app.schemas.tenant_config import SchemeSettings
from app.services.gold_math import grams_for
from app.services.rates import latest_rate

Outcome = Literal["success", "failure", "pending"]


class OrderClosed(Exception):
    pass


@dataclass(frozen=True)
class Settlement:
    order: PaymentOrder
    lot: GoldLot | None
    repriced: bool = False


async def settle_order(
    session: AsyncSession,
    order: PaymentOrder,
    tenant: Tenant,
    scheme: SchemeSettings,
    outcome: Outcome,
    provider_payment_id: str = "",
    failure_reason: str = "",
) -> Settlement:
    """Apply a payment result. Safe to call twice: a paid order returns its existing lot."""
    order = await session.get(PaymentOrder, order.id, with_for_update=True, populate_existing=True)
    if order.status == "paid":
        lot = await session.scalar(select(GoldLot).where(GoldLot.order_id == order.id))
        return Settlement(order, lot)
    if order.status == "failed":
        raise OrderClosed("this payment has already failed; start a new one")

    if outcome == "failure":
        order.status = "failed"
        order.failure_reason = failure_reason or "payment failed"
        return Settlement(order, None)
    if outcome == "pending":
        order.status = "pending"
        return Settlement(order, None)

    paid_at = now()
    rate_per_gram, repriced = order.rate_per_gram, False
    if paid_at > order.lock_expires_at:
        # The quoted price lock ran out before the money arrived: use the current rate.
        current = await latest_rate(session, tenant.id, order.purity)
        if current is not None and current.rate_per_gram != order.rate_per_gram:
            rate_per_gram, repriced = current.rate_per_gram, True

    customer = await session.get(Customer, order.customer_id, with_for_update=True)
    old_balance = customer.rupee_balance_inr
    grams, leftover = grams_for(order.amount_inr + old_balance, rate_per_gram)

    lot = GoldLot(
        tenant_id=tenant.id,
        customer_id=customer.id,
        order_id=order.id,
        grams=grams,
        amount_inr=order.amount_inr,
        rate_per_gram=rate_per_gram,
        purity=order.purity,
        paid_at=paid_at,
        redeemable_at=paid_at + timedelta(days=scheme.settlement_hold_days),
        expires_at=paid_at + timedelta(days=scheme.lot_validity_days),
    )
    session.add(lot)
    await session.flush()
    session.add(
        LedgerEntry(
            tenant_id=tenant.id,
            customer_id=customer.id,
            lot_id=lot.id,
            order_id=order.id,
            kind="credit",
            grams=grams,
            amount_inr=order.amount_inr,
            rupee_balance_change=leftover - old_balance,
            note="repriced at current rate after price lock ended" if repriced else "",
        )
    )
    customer.gold_grams += grams
    customer.rupee_balance_inr = leftover
    customer.total_paid_inr += order.amount_inr

    order.status = "paid"
    order.paid_at = paid_at
    order.provider_payment_id = provider_payment_id
    return Settlement(order, lot, repriced)
