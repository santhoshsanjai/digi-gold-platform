"""Moves grams and rupees. Every change writes a ledger entry and updates the customer's
running totals in the same transaction."""

from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
from typing import Literal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import local_date
from app.core.security import now
from app.models import Customer, GoldLot, LedgerEntry, PaymentOrder, Redemption, Tenant
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


class RedemptionRefused(Exception):
    pass


async def redeem_all(
    session: AsyncSession,
    customer: Customer,
    scheme: SchemeSettings,
    staff_user_id: UUID,
    store_id: UUID | None,
) -> Redemption:
    """Close every open lot of the customer for one jewellery purchase (full balance only)."""
    customer = await session.get(
        Customer, customer.id, with_for_update=True, populate_existing=True
    )
    lots = list(
        await session.scalars(
            select(GoldLot)
            .where(GoldLot.customer_id == customer.id, GoldLot.status == "open")
            .order_by(GoldLot.paid_at)
            .with_for_update()
        )
    )
    grams = sum((lot.grams for lot in lots), Decimal("0"))
    if not lots or grams < scheme.redemption_threshold_grams:
        raise RedemptionRefused(
            f"balance {grams} g is below the {scheme.redemption_threshold_grams} g needed to redeem"
        )
    settling = [lot for lot in lots if lot.redeemable_at > now()]
    if settling:
        until = max(lot.redeemable_at for lot in settling)
        raise RedemptionRefused(
            f"recent payments are still settling; redeem after {local_date(until).isoformat()}"
        )

    today = local_date(now())
    count = await session.scalar(
        select(func.count()).where(
            Redemption.tenant_id == customer.tenant_id,
            Redemption.slip_number.like(f"R{today:%Y%m%d}-%"),
        )
    )
    redemption = Redemption(
        tenant_id=customer.tenant_id,
        customer_id=customer.id,
        store_id=store_id,
        staff_user_id=staff_user_id,
        slip_number=f"R{today:%Y%m%d}-{count + 1:04d}",
        grams=grams,
        amount_paid_inr=sum((lot.amount_inr for lot in lots), Decimal("0")),
        lots_count=len(lots),
        purity=lots[0].purity,
        making_charge_discount_pct=scheme.making_charge_discount_pct,
    )
    session.add(redemption)
    await session.flush()
    closed_at = now()
    for lot in lots:
        lot.status = "redeemed"
        lot.closed_at = closed_at
        lot.redemption_id = redemption.id
        session.add(
            LedgerEntry(
                tenant_id=customer.tenant_id,
                customer_id=customer.id,
                lot_id=lot.id,
                kind="redeem",
                grams=-lot.grams,
                amount_inr=Decimal("0"),
                note=f"redeemed in store, slip {redemption.slip_number}",
                created_by=staff_user_id,
            )
        )
    customer.gold_grams -= grams
    return redemption


async def refund_lot(session: AsyncSession, lot: GoldLot, staff_user_id: UUID, note: str) -> None:
    """Record that a lot's money was returned to the customer (paid outside the system)."""
    lot = await session.get(GoldLot, lot.id, with_for_update=True, populate_existing=True)
    if lot.status != "open":
        raise RedemptionRefused("only open lots can be refunded")
    customer = await session.get(Customer, lot.customer_id, with_for_update=True)
    lot.status = "refunded"
    lot.closed_at = now()
    session.add(
        LedgerEntry(
            tenant_id=lot.tenant_id,
            customer_id=customer.id,
            lot_id=lot.id,
            kind="refund",
            grams=-lot.grams,
            amount_inr=-lot.amount_inr,
            note=note,
            created_by=staff_user_id,
        )
    )
    customer.gold_grams -= lot.grams
    customer.total_paid_inr -= lot.amount_inr
