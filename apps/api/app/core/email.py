"""Outgoing email. "console" keeps messages in memory and logs them (dev and tests);
"smtp" sends through any SMTP server (Mailpit locally, Amazon SES in production);
"brevo" sends through Brevo's HTTPS API, for hosts that block SMTP ports."""

import json
import logging
import smtplib
import urllib.error
import urllib.request
from dataclasses import dataclass
from email.message import EmailMessage

from app.core.config import get_settings

log = logging.getLogger("digigold.email")


@dataclass(frozen=True)
class Email:
    to: str
    subject: str
    body: str


# Messages sent with the console backend, newest last. Tests read this.
outbox: list[Email] = []


BREVO_URL = "https://api.brevo.com/v3/smtp/email"


def send_email(message: Email) -> None:
    settings = get_settings()
    if settings.email_backend == "brevo" and not settings.brevo_api_key:
        log.error("DG_EMAIL_BACKEND=brevo but DG_BREVO_API_KEY is empty; logging email instead")
    if settings.email_backend == "console" or (
        settings.email_backend == "brevo" and not settings.brevo_api_key
    ):
        outbox.append(message)
        if settings.env == "dev":
            # Without a mail server, developers read temporary passwords from the server log.
            log.info("email to=%s subject=%s\n%s", message.to, message.subject, message.body)
        else:
            log.info("email to=%s subject=%s", message.to, message.subject)
        return

    if settings.email_backend == "brevo":
        _send_brevo(message, settings)
        return

    msg = EmailMessage()
    msg["From"] = settings.email_from
    msg["To"] = message.to
    msg["Subject"] = message.subject
    msg.set_content(message.body)
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_username:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(msg)
    except (OSError, smtplib.SMTPException):
        log.exception("email to %s failed", message.to)


def _send_brevo(message: Email, settings) -> None:
    payload = {
        "sender": {"email": settings.email_from, "name": settings.email_from_name},
        "to": [{"email": message.to}],
        "subject": message.subject,
        "textContent": message.body,
    }
    request = urllib.request.Request(
        BREVO_URL,
        data=json.dumps(payload).encode(),
        headers={
            "api-key": settings.brevo_api_key,
            "content-type": "application/json",
            "accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            response.read()
    except urllib.error.HTTPError as exc:
        # Brevo explains refusals (unverified sender, bad key) in the response body.
        detail = exc.read().decode(errors="replace")[:500]
        log.error("email to %s failed: Brevo %s %s", message.to, exc.code, detail)
    except OSError:
        log.exception("email to %s failed", message.to)


def temp_password_email(to: str, name: str, org: str, password: str, hours: int, url: str) -> Email:
    return Email(
        to=to,
        subject=f"Your {org} account",
        body=(
            f"Hello {name},\n\n"
            f"An account has been created for you at {org}.\n\n"
            f"Sign in at: {url}\n"
            f"Email: {to}\n"
            f"Temporary password: {password}\n\n"
            f"This password expires in {hours} hours. You will be asked to choose a new "
            "password when you first sign in.\n"
        ),
    )


def customer_temp_password_email(
    to: str, name: str, org: str, password: str, minutes: int, by_store: bool = False
) -> Email:
    reason = (
        f"{org} has sent you a temporary password for the {org} app."
        if by_store
        else f"We received a request to reset the password for your {org} app account."
    )
    return Email(
        to=to,
        subject=f"Your {org} temporary password",
        body=(
            f"Hello {name or 'there'},\n\n"
            f"{reason}\n\n"
            f"Email: {to}\n"
            f"Temporary password: {password}\n\n"
            f"Sign in to the app with it within {minutes} minutes. You will be asked to choose "
            "a new password straight away, and the temporary one stops working after that.\n\n"
            "If you did not ask for this, ignore this email. Your current password still works.\n"
        ),
    )


def reset_link_email(to: str, name: str, org: str, link: str, minutes: int) -> Email:
    return Email(
        to=to,
        subject=f"Reset your {org} password",
        body=(
            f"Hello {name},\n\n"
            f"Use this link to choose a new password. It expires in {minutes} minutes.\n\n"
            f"{link}\n\n"
            "If you did not ask for this, you can ignore this email.\n"
        ),
    )
