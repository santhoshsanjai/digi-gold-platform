# Putting the platform on a server

This is a checklist of what production needs, written from how the code behaves today. It does
not pick a hosting provider. Nothing here has been run on a real server yet, so treat the first
deployment as a rehearsal.

## What runs

| Part | What it is | Needs |
| --- | --- | --- |
| API | `apps/api`, one FastAPI process (`Dockerfile` included) | PostgreSQL 16, a folder for uploaded images, an SMTP server |
| CRM and Console | `npm run build` gives static files in `apps/crm/dist` and `apps/console/dist` | Any static host. Serve `index.html` for unknown paths |
| Website | `npm run build:static -w @digigold/website`, one build per client | Any static host (see `apps/website/README.md`) |
| Mobile app | Expo build per client | Apple and Google developer accounts |

One small server is enough to start: the API uses one worker and a small database pool.

## Same address for the web apps and the API

The CRM, Console and website call `/api/v1` and `/media` on their own address. Put a reverse
proxy in front that sends those two paths to the API and serves the static files for everything
else. Then no CORS setup is needed. The CRM reads the client from the first part of its host
name (`sri-gold.crm.example.com` is the client `sri-gold`), so each client needs its own host
name and certificate, or a wildcard certificate for `*.crm.example.com`.

## API settings (environment variables, prefix `DG_`)

| Variable | Production value |
| --- | --- |
| `DG_ENV` | `prod`. The API refuses to start in `prod` with the sample `DG_JWT_SECRET` or one shorter than 32 characters |
| `DG_JWT_SECRET` | A long random string, for example `openssl rand -hex 32`. Changing it signs everyone out |
| `DG_DATABASE_URL` | `postgresql+asyncpg://USER:PASSWORD@HOST:5432/DB` |
| `DG_EMAIL_BACKEND`, `DG_SMTP_*`, `DG_EMAIL_FROM` | A real SMTP service (`smtp`). Staff temporary passwords and expiry reminders are sent by email |
| `DG_CRM_BASE_URL`, `DG_CONSOLE_BASE_URL` | The public CRM and Console addresses, used in email links |
| `DG_MEDIA_DIR` | A folder on a persistent disk. Uploaded images live here; `DG_MEDIA_BASE_URL` points at a CDN if you move them |
| `DG_RUN_SCHEDULER` | `true` on exactly one API process (the daily reminder job runs inside the API). Set `false` on any others |

## The database

The API must connect as a role that is **not** a superuser, because superusers skip the
row-level security that keeps clients apart. `infra/postgres/init.sql` shows the role; use your
own password. Then run, from `apps/api`:

```bash
uv run alembic upgrade head                      # on every release, before starting the new API
uv run python -m app.cli create-platform-admin --email you@example.com --name "Your name"
uv run python -m app.cli create-tenant --slug sri-gold --name "Sri Gold" \
    --owner-email owner@sri.example --owner-name "Owner"
```

Each command prints a temporary password that must be changed at first sign-in. Back up the
database and the media folder daily and test a restore once.

## Before real customers use it

These are not finished and are waiting on the client's accounts:

- **SMS for sign-in codes.** Only a stand-in exists, so customers cannot receive codes in production.
- **Razorpay.** Payments are the practice screen. Switch off `test_payments` for the client in the Console once live payments exist.
- **PAN verification.** PAN is collected but not checked.
- The client's lawyer should review the scheme terms.
