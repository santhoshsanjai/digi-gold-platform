"""The configuration layers stored per tenant. Defaults here are the platform defaults."""

from datetime import time
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

HexColor = Annotated[str, Field(pattern=r"^#[0-9A-Fa-f]{6}$")]
Money = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)]
Grams = Annotated[Decimal, Field(gt=0, max_digits=10, decimal_places=4)]
Percent = Annotated[Decimal, Field(ge=0, le=100, max_digits=5, decimal_places=2)]

# Legal ceiling: an advance for goods must be used within 365 days (see the MVP design doc).
MAX_LOT_VALIDITY_DAYS = 365


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Branding(_Strict):
    """Set by the platform owner in the Platform Console."""

    display_name: str = Field("", max_length=100)
    logo_url: str = Field("", max_length=500)
    favicon_url: str = Field("", max_length=500)
    primary_color: HexColor = "#B8860B"
    secondary_color: HexColor = "#1F2937"
    background_color: HexColor = "#FFFFFF"
    font_family: str = Field("Inter", max_length=60)
    heading_font_family: str = Field("", max_length=60, description="Empty means the main font")
    support_email: str = Field("", max_length=254)
    support_phone: str = Field("", max_length=20)


class Features(_Strict):
    """Feature flags, switched per tenant in the Platform Console."""

    savings_scheme: bool = True
    autopay_plans: bool = False
    gifting: bool = False
    referrals: bool = False
    partner_digital_gold: bool = False
    # Test payments: a mock checkout with success, failure and pending buttons.
    # Switched off once the client's Razorpay account is connected.
    test_payments: bool = True


class SchemeSettings(_Strict):
    """Business rules the client edits on the CRM settings page."""

    purity: Literal["22K", "24K"] = "22K"
    min_payment_inr: Money = Decimal("100")
    max_payment_inr: Money = Decimal("50000")
    redemption_threshold_grams: Grams = Decimal("1")
    making_charge_discount_pct: Percent = Decimal("0")
    lot_validity_days: int = Field(MAX_LOT_VALIDITY_DAYS, ge=1, le=MAX_LOT_VALIDITY_DAYS)
    price_lock_minutes: int = Field(5, ge=1, le=30)
    daily_rate_deadline: time = time(11, 0)
    rate_change_confirm_pct: Percent = Decimal("3")
    settlement_hold_days: int = Field(2, ge=0, le=7)
    pan_required_above_inr: Money = Decimal("200000")
    reminder_days_before_expiry: list[int] = Field(default_factory=lambda: [60, 30, 7])
    reminder_every_days_after_expiry: int = Field(7, ge=1, le=30)
    manual_refund_enabled: bool = False

    @field_validator("reminder_days_before_expiry")
    @classmethod
    def _reminders(cls, v: list[int]) -> list[int]:
        if len(v) > 5 or any(d < 1 or d > MAX_LOT_VALIDITY_DAYS for d in v):
            raise ValueError("up to 5 reminders, each between 1 and 365 days")
        return sorted(set(v), reverse=True)

    @model_validator(mode="after")
    def _payment_range(self) -> "SchemeSettings":
        if self.min_payment_inr > self.max_payment_inr:
            raise ValueError("min_payment_inr must not exceed max_payment_inr")
        return self


def merged(model: type[_Strict], stored: dict) -> _Strict:
    """Stored values over platform defaults, so new settings get defaults automatically."""
    return model.model_validate(stored or {})
