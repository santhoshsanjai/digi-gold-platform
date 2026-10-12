"""Payment providers behind one interface, so Razorpay can replace the mock without
changing the app or the ledger."""

import secrets
from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol


@dataclass(frozen=True)
class ProviderOrder:
    provider: str
    provider_order_id: str


class PaymentProvider(Protocol):
    name: str

    def create_order(self, amount_inr: Decimal, receipt: str) -> ProviderOrder: ...


class MockProvider:
    """Test payments: the app shows success, failure and pending buttons instead of a
    real checkout. Only allowed while the tenant's test_payments feature is on."""

    name = "mock"

    def create_order(self, amount_inr: Decimal, receipt: str) -> ProviderOrder:
        return ProviderOrder(self.name, f"mock_order_{secrets.token_hex(8)}")


def provider_for(test_payments: bool) -> PaymentProvider:
    if test_payments:
        return MockProvider()
    raise NotImplementedError("Razorpay is connected once the client shares its account keys")
