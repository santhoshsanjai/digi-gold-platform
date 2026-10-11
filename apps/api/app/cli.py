"""Command-line tasks.

Usage: python -m app.cli create-platform-admin --email you@example.com --name "Your Name"
"""

import argparse
import asyncio

from app.core.config import get_settings
from app.core.db import SessionLocal, bypass_tenant_scope, engine
from app.core.email import send_email, temp_password_email
from app.services.users import EmailTaken, create_staff_user


async def create_platform_admin(email: str, name: str) -> None:
    settings = get_settings()
    async with SessionLocal() as session, session.begin():
        await bypass_tenant_scope(session)
        try:
            user, password = await create_staff_user(
                session,
                tenant_id=None,
                email=email,
                name=name,
                role_id=None,
                is_platform_admin=True,
            )
        except EmailTaken:
            raise SystemExit(f"a platform admin with {email} already exists") from None
    send_email(
        temp_password_email(
            user.email,
            user.name,
            "Digi Gold Platform",
            password,
            settings.temp_password_hours,
            settings.console_base_url,
        )
    )
    print(f"Created platform admin {user.email}. Temporary password: {password}")
    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(prog="app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    admin = sub.add_parser("create-platform-admin", help="create a Platform Console admin")
    admin.add_argument("--email", required=True)
    admin.add_argument("--name", required=True)
    args = parser.parse_args()
    if args.command == "create-platform-admin":
        asyncio.run(create_platform_admin(args.email, args.name))


if __name__ == "__main__":
    main()
