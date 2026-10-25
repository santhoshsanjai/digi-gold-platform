"""Temporary passwords and emailed codes for app customers."""

import secrets
from datetime import timedelta

from app.core.config import get_settings
from app.core.email import Email, customer_temp_password_email
from app.core.security import generate_temp_password, hash_password, now
from app.models import Customer, Tenant

settings = get_settings()


def shop_name(tenant: Tenant) -> str:
    return tenant.branding.get("display_name") or tenant.name


def issue_temp_password(customer: Customer, tenant: Tenant, by_store: bool = False) -> Email:
    """Give the customer a temporary password and return the email that carries it.

    Their current password keeps working until the temporary one is used. A customer who has
    only signed in with SMS codes gets an unguessable password, so the email becomes their
    sign-in name and the temporary password is the only way in until they set their own."""
    if customer.password_hash is None:
        customer.password_hash = hash_password(secrets.token_urlsafe(32))
    password = generate_temp_password()
    customer.temp_password_hash = hash_password(password)
    customer.temp_password_expires_at = now() + timedelta(
        minutes=settings.customer_temp_password_minutes
    )
    return customer_temp_password_email(
        customer.email,
        customer.name,
        shop_name(tenant),
        password,
        settings.customer_temp_password_minutes,
        by_store=by_store,
    )


def code_email(to: str, shop: str, code: str, what: str) -> Email:
    """The SMS code, sent by email as well while SMS delivery is not set up."""
    return Email(
        to=to,
        subject=f"{code} is your {shop} {what} code",
        body=(
            f"Your {shop} {what} code is:\n\n"
            f"    {code}\n\n"
            f"It works for {settings.otp_minutes} minutes. Never share it with anyone, "
            "including store staff.\n\n"
            "If you did not ask for this code, you can ignore this email.\n"
        ),
    )
