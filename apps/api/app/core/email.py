"""Outgoing email. "console" keeps messages in memory and logs them (dev and tests);
"smtp" sends through any SMTP server (Mailpit locally, Amazon SES in production)."""

import logging
import smtplib
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


def send_email(message: Email) -> None:
    settings = get_settings()
    if settings.email_backend == "console":
        outbox.append(message)
        if settings.env == "dev":
            # Without a mail server, developers read temporary passwords from the server log.
            log.info("email to=%s subject=%s\n%s", message.to, message.subject, message.body)
        else:
            log.info("email to=%s subject=%s", message.to, message.subject)
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
    to: str, name: str, org: str, password: str, minutes: int
) -> Email:
    return Email(
        to=to,
        subject=f"Your {org} temporary password",
        body=(
            f"Hello {name or 'there'},\n\n"
            f"We received a request to reset the password for your {org} app account.\n\n"
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
