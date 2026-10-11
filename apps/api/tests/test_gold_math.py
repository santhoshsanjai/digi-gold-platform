from decimal import Decimal

import pytest

from app.services.gold_math import change_pct, grams_for


@pytest.mark.parametrize(
    ("amount", "rate", "grams", "leftover"),
    [
        ("2000", "11500", "0.1739", "0.15"),
        ("100", "10000", "0.0100", "0.00"),
        ("10000", "10000", "1.0000", "0.00"),
        ("99.99", "7123.45", "0.0140", "0.26"),
    ],
)
def test_grams_round_down_and_keep_the_remainder(amount, rate, grams, leftover):
    g, rest = grams_for(Decimal(amount), Decimal(rate))
    assert g == Decimal(grams)
    assert rest == Decimal(leftover)
    # Never credits gold that was not paid for.
    assert g * Decimal(rate) <= Decimal(amount)


def test_change_pct():
    assert change_pct(Decimal("10000"), Decimal("10300")) == Decimal("3.00")
    assert change_pct(Decimal("10000"), Decimal("1000")) == Decimal("-90.00")


def test_zero_rate_is_refused():
    with pytest.raises(ValueError):
        grams_for(Decimal("100"), Decimal("0"))
