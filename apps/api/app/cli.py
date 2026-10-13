"""Command-line tasks.

Usage: python -m app.cli create-platform-admin --email you@example.com --name "Your Name"
"""

import argparse
import asyncio
import json

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


async def create_tenant_cmd(slug: str, name: str, owner_email: str, owner_name: str) -> None:
    """Set up a client for local work without the Platform Console."""
    from app.services.tenants import create_tenant

    async with SessionLocal() as session, session.begin():
        await bypass_tenant_scope(session)
        tenant, owner, password = await create_tenant(
            session,
            slug=slug,
            name=name,
            owner_email=owner_email,
            owner_name=owner_name,
            actor_id=None,
        )
    print(f"Created {tenant.name} ({tenant.slug}).")
    print(f"Owner {owner.email}, temporary password: {password}")
    await engine.dispose()


async def _seed_demo() -> None:
    from app.services.demo import OWNER, PASSWORD, PLATFORM_ADMIN, SLUG, seed_demo

    for note in await seed_demo():
        print(f"- {note}")
    print(f"Platform Console: {PLATFORM_ADMIN} / {PASSWORD}")
    print(f"CRM (client '{SLUG}'): {OWNER} / {PASSWORD}")


async def _reminders() -> None:
    from app.services.expiry import send_reminders

    print(await send_reminders())
    await engine.dispose()


def export_openapi(path: str) -> None:
    """Write the API schema the web apps generate their TypeScript types from."""
    from app.main import app

    with open(path, "w") as f:
        json.dump(app.openapi(), f, indent=2, sort_keys=True)
        f.write("\n")


def main() -> None:
    parser = argparse.ArgumentParser(prog="app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    admin = sub.add_parser("create-platform-admin", help="create a Platform Console admin")
    admin.add_argument("--email", required=True)
    admin.add_argument("--name", required=True)
    client = sub.add_parser("create-tenant", help="create a client and its Owner user")
    client.add_argument("--slug", required=True)
    client.add_argument("--name", required=True)
    client.add_argument("--owner-email", required=True)
    client.add_argument("--owner-name", required=True)
    sub.add_parser("seed-demo", help="(development only) create a demo client with known passwords")
    sub.add_parser(
        "send-expiry-reminders", help="send today's lot expiry reminders now (also runs daily)"
    )
    schema = sub.add_parser("export-openapi", help="write the OpenAPI schema to a file")
    schema.add_argument("path", nargs="?", default="openapi.json")
    args = parser.parse_args()
    if args.command == "create-platform-admin":
        asyncio.run(create_platform_admin(args.email, args.name))
    elif args.command == "create-tenant":
        asyncio.run(create_tenant_cmd(args.slug, args.name, args.owner_email, args.owner_name))
    elif args.command == "seed-demo":
        asyncio.run(_seed_demo())
    elif args.command == "send-expiry-reminders":
        asyncio.run(_reminders())
    elif args.command == "export-openapi":
        export_openapi(args.path)


if __name__ == "__main__":
    main()
