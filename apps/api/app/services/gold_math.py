"""Gold arithmetic. Grams are always rounded DOWN so no unpaid gold is ever credited."""

from decimal import ROUND_DOWN, Decimal

GRAM_STEP = Decimal("0.0001")
PAISA = Decimal("0.01")


def grams_for(amount_inr: Decimal, rate_per_gram: Decimal) -> tuple[Decimal, Decimal]:
    """Grams bought by an amount at a rate, and the rupees left over (kept for next time)."""
    if rate_per_gram <= 0:
        raise ValueError("rate must be positive")
    grams = (amount_inr / rate_per_gram).quantize(GRAM_STEP, rounding=ROUND_DOWN)
    leftover = (amount_inr - grams * rate_per_gram).quantize(PAISA, rounding=ROUND_DOWN)
    return grams, leftover


def change_pct(old: Decimal, new: Decimal) -> Decimal:
    return ((new - old) / old * 100).quantize(PAISA)
