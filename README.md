# Digi Gold Platform

A white-label gold savings platform for jewellers. One codebase serves many clients
(tenants); each client's name, branding, scheme rules and features are configuration,
never code.

| App | Path | Stack | Status |
| --- | --- | --- | --- |
| Backend API (app, CRM, Console, website) | `apps/api` | FastAPI, PostgreSQL | Foundation, gold rate, customers, ledger |
| CRM for client staff | `apps/crm` | React + Vite | Planned |
| Platform Console with the website CMS | `apps/console` | React + Vite | Planned |
| Business website | `apps/website` | React + Vite, pre-rendered | Planned |
| Customer mobile app | `apps/mobile` | React Native + Expo | Planned |

## How tenants are kept apart

Every tenant-owned table has a `tenant_id`, and PostgreSQL row-level security hides other
tenants' rows even if a query forgets to filter. The API sets `app.tenant_id` at the start
of each request's transaction. The API must connect as a **non-superuser** role, because
superusers bypass row-level security.

## Run the API locally

Needs Docker and [uv](https://docs.astral.sh/uv/).

```bash
docker compose up -d db mail          # PostgreSQL + email inbox (http://localhost:8025)
cd apps/api
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run python -m app.cli create-platform-admin --email you@example.com --name "Your Name"
uv run uvicorn app.main:app --reload  # API docs at http://localhost:8000/docs
```

The temporary password is printed and emailed to the Mailpit inbox. Sign in through
`POST /api/v1/auth/login` without a `tenant`, set a new password with
`POST /api/v1/auth/first-login`, then create a client with `POST /api/v1/console/tenants`.

## Tests

```bash
cd apps/api
uv run pytest           # needs the database from docker compose (digigold_test)
uv run ruff check . && uv run ruff format --check .
```

## Design documents

- Plan review: https://claude.ai/code/artifact/300527f5-57ad-438b-a409-4b093c2d1ef4
- Gold savings scheme MVP design: https://claude.ai/code/artifact/2d33af12-7281-48af-8a4d-b96301dab842
- Tech stack: https://claude.ai/code/artifact/fbc08f46-f02b-4d38-abf9-5157951f8d31
