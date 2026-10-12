"""Reports for the store owner: money in, gold out, and gold still held. Each can be
downloaded as CSV (for Excel) with `?format=csv`."""

import csv
import io
from datetime import date, timedelta
from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.clock import local_date, start_of_day, today
from app.core.config import get_settings
from app.core.deps import Session, Staff, require
from app.models import Customer, GoldLot, PaymentOrder, Redemption, Store, Tenant
from app.schemas.tenant_config import SchemeSettings, merged
from app.services.rates import buying_status

router = APIRouter(prefix="/crm/reports", tags=["crm reports"])

MAX_DAYS = 366
Reporter = Annotated[Staff, Depends(require("reports:view"))]
Format = Annotated[Literal["json", "csv"], Query(alias="format")]


def _range(start: date | None, end: date | None) -> tuple[date, date]:
    """Inclusive local dates; the last 30 days when not given."""
    end = end or today()
    start = start or end - timedelta(days=29)
    if start > end:
        raise HTTPException(422, "the start date is after the end date")
    if (end - start).days >= MAX_DAYS:
        raise HTTPException(422, f"choose a range of at most {MAX_DAYS} days")
    return start, end


def _bounds(start: date, end: date):
    return start_of_day(start), start_of_day(end + timedelta(days=1))


def _day(column):
    """The local (Indian) calendar date of a timestamp."""
    return func.date(func.timezone(get_settings().timezone, column))


def _cell(value) -> str:
    text = "" if value is None else str(value)
    # A spreadsheet runs text starting with these as a formula, and customers type their names.
    return "'" + text if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


def _csv(name: str, header: list[str], rows: list[list]) -> Response:
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(header)
    writer.writerows([[_cell(v) for v in row] for row in rows])
    return Response(
        # The byte order mark makes Excel read the file as UTF-8.
        content="﻿" + out.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{name}.csv"'},
    )


class CollectionDay(BaseModel):
    date: date
    payments: int
    amount_inr: Decimal
    grams: Decimal


class CollectionsOut(BaseModel):
    start: date
    end: date
    total_payments: int
    total_amount_inr: Decimal
    total_grams: Decimal
    days: list[CollectionDay]


@router.get("/collections", response_model=CollectionsOut)
async def collections(
    staff: Reporter,
    session: Session,
    start: date | None = None,
    end: date | None = None,
    fmt: Format = "json",
):
    """Paid payments by day: how much came in and how many grams it bought."""
    start, end = _range(start, end)
    lo, hi = _bounds(start, end)
    day = _day(PaymentOrder.paid_at)
    rows = (
        await session.execute(
            select(
                day,
                func.count(),
                func.sum(PaymentOrder.amount_inr),
                func.sum(PaymentOrder.quoted_grams),
            )
            .where(
                PaymentOrder.tenant_id == staff.tenant_id,
                PaymentOrder.status == "paid",
                PaymentOrder.paid_at >= lo,
                PaymentOrder.paid_at < hi,
            )
            .group_by(day)
            .order_by(day)
        )
    ).all()
    if fmt == "csv":
        return _csv(
            f"collections-{start}-to-{end}",
            ["Date", "Payments", "Amount (INR)", "Grams"],
            [[d, n, amount, grams] for d, n, amount, grams in rows],
        )
    days = [CollectionDay(date=d, payments=n, amount_inr=a, grams=g) for d, n, a, g in rows]
    return CollectionsOut(
        start=start,
        end=end,
        total_payments=sum(d.payments for d in days),
        total_amount_inr=sum((d.amount_inr for d in days), Decimal("0")),
        total_grams=sum((d.grams for d in days), Decimal("0")),
        days=days,
    )


class RedemptionRow(BaseModel):
    label: str  # a date, or a store name
    redemptions: int
    grams: Decimal
    amount_paid_inr: Decimal


class RedemptionsOut(BaseModel):
    start: date
    end: date
    group_by: Literal["day", "store"]
    total_redemptions: int
    total_grams: Decimal
    total_amount_paid_inr: Decimal
    rows: list[RedemptionRow]


@router.get("/redemptions", response_model=RedemptionsOut)
async def redemptions(
    staff: Reporter,
    session: Session,
    start: date | None = None,
    end: date | None = None,
    group_by: Literal["day", "store"] = "day",
    fmt: Format = "json",
):
    """Gold redeemed in store, by day or by store."""
    start, end = _range(start, end)
    lo, hi = _bounds(start, end)
    if group_by == "day":
        key = _day(Redemption.created_at)
        query = select(
            key, func.count(), func.sum(Redemption.grams), func.sum(Redemption.amount_paid_inr)
        )
    else:
        key = func.coalesce(Store.name, "No store recorded")
        query = (
            select(
                key, func.count(), func.sum(Redemption.grams), func.sum(Redemption.amount_paid_inr)
            )
            .select_from(Redemption)
            .outerjoin(Store, Store.id == Redemption.store_id)
        )
    rows = (
        await session.execute(
            query.where(
                Redemption.tenant_id == staff.tenant_id,
                Redemption.created_at >= lo,
                Redemption.created_at < hi,
            )
            .group_by(key)
            .order_by(key)
        )
    ).all()
    data = [
        RedemptionRow(label=str(k), redemptions=n, grams=g, amount_paid_inr=a)
        for k, n, g, a in rows
    ]
    if fmt == "csv":
        return _csv(
            f"redemptions-by-{group_by}-{start}-to-{end}",
            ["Date" if group_by == "day" else "Store", "Redemptions", "Grams", "Amount paid (INR)"],
            [[r.label, r.redemptions, r.grams, r.amount_paid_inr] for r in data],
        )
    return RedemptionsOut(
        start=start,
        end=end,
        group_by=group_by,
        total_redemptions=sum(r.redemptions for r in data),
        total_grams=sum((r.grams for r in data), Decimal("0")),
        total_amount_paid_inr=sum((r.amount_paid_inr for r in data), Decimal("0")),
        rows=data,
    )


class HoldingRow(BaseModel):
    customer_id: str
    name: str
    phone: str
    grams: Decimal
    value_inr: Decimal | None
    open_lots: int
    next_expiry: date | None


class HoldingsOut(BaseModel):
    rate_per_gram: Decimal | None
    purity: str
    total_customers: int
    total_grams: Decimal
    total_value_inr: Decimal | None
    rows: list[HoldingRow]


@router.get("/holdings", response_model=HoldingsOut)
async def holdings(
    staff: Reporter,
    session: Session,
    limit: Annotated[int, Query(ge=1, le=1000)] = 200,
    fmt: Format = "json",
):
    """Gold each customer holds now, largest first, valued at today's rate. This is the
    gold the jeweller owes customers."""
    tenant = await session.get(Tenant, staff.tenant_id)
    scheme = merged(SchemeSettings, tenant.settings)
    status = await buying_status(session, tenant, scheme)
    rate = status.rate.rate_per_gram if status.rate else None
    lots = (
        select(
            GoldLot.customer_id,
            func.count().label("n"),
            func.min(GoldLot.expires_at).label("soonest"),
        )
        .where(GoldLot.tenant_id == tenant.id, GoldLot.status == "open")
        .group_by(GoldLot.customer_id)
        .subquery()
    )
    rows = (
        await session.execute(
            select(Customer, lots.c.n, lots.c.soonest)
            .outerjoin(lots, lots.c.customer_id == Customer.id)
            .where(Customer.tenant_id == tenant.id, Customer.gold_grams > 0)
            .order_by(Customer.gold_grams.desc(), Customer.phone)
            .limit(limit)
        )
    ).all()
    totals = (
        await session.execute(
            select(func.count(), func.coalesce(func.sum(Customer.gold_grams), 0)).where(
                Customer.tenant_id == tenant.id, Customer.gold_grams > 0
            )
        )
    ).one()
    value = lambda g: (g * rate).quantize(Decimal("0.01")) if rate else None  # noqa: E731
    data = [
        HoldingRow(
            customer_id=str(c.id),
            name=c.name,
            phone=c.phone,
            grams=c.gold_grams,
            value_inr=value(c.gold_grams),
            open_lots=n or 0,
            next_expiry=local_date(soonest) if soonest else None,
        )
        for c, n, soonest in rows
    ]
    if fmt == "csv":
        return _csv(
            f"gold-held-{today()}",
            [
                "Name",
                "Phone",
                "Grams",
                f"Value at {rate or 'no'} per gram (INR)",
                "Open lots",
                "Next expiry",
            ],
            [[r.name, r.phone, r.grams, r.value_inr, r.open_lots, r.next_expiry] for r in data],
        )
    return HoldingsOut(
        rate_per_gram=rate,
        purity=scheme.purity,
        total_customers=totals[0],
        total_grams=totals[1],
        total_value_inr=value(totals[1]),
        rows=data,
    )
