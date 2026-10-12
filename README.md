# Digi Gold Platform

A white-label gold savings platform for jewellers. One codebase serves many clients
(tenants); each client's name, branding, scheme rules and features are configuration,
never code.

| App | Path | Stack | Status |
| --- | --- | --- | --- |
| Backend API (app, CRM, Console, website) | `apps/api` | FastAPI, PostgreSQL | Foundation, gold rate, customers, ledger, website content |
| Shared web components and API types | `packages/web-common` | React, TypeScript | Used by the CRM and Console |
| CRM for client staff | `apps/crm` | React + Vite, Ant Design, Tailwind, RTK Query | Sign-in, rates, customers, redemptions, expiry, settings, users and roles |
| Platform Console with the website CMS | `apps/console` | React + Vite, Ant Design, Tailwind, RTK Query | Clients, branding, features, website pages, images |
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

## Run the web apps locally

Needs Node 22 and the API running on port 8000. The web apps are npm workspaces, so one
install at the repository root covers all of them.

```bash
npm install                    # at the repository root
```

**Platform Console** (you, the platform owner): create clients, set their branding and
features, and edit their websites.

```bash
cd apps/console
cp .env.example .env.local
npm run dev                    # http://localhost:5174
```

Sign in with the platform admin's email and temporary password; it asks for a new one.

**CRM** (each client's staff):

```bash
cd apps/api
uv run python -m app.cli create-tenant --slug demo --name "Demo Jewellers" \
  --owner-email owner@example.com --owner-name "Owner"   # prints a temporary password
cd ../crm
cp .env.example .env.local     # VITE_TENANT_SLUG=demo
npm run dev                    # http://localhost:5173
```

Clients created in the Console work the same way: the owner gets the temporary password by
email. One CRM build serves every client: in production the client is read from the host
name (`demo.crm.example.com`), and its name, logo, colours and font come from its branding.

When an API endpoint changes, refresh the shared types:

```bash
cd apps/api && uv run python -m app.cli export-openapi   # writes openapi.json
cd ../.. && npm run api:types -w @digigold/web-common    # writes packages/web-common/src/api/schema.d.ts
```

CI fails if either file is out of date.

## Reports

In the CRM, **Reports** has three tabs: collections by day, redemptions by day or by store, and
the gold each customer holds now (valued at today's rate). Each has a date range (up to a year)
and a CSV download that opens in Excel. The API is `GET /crm/reports/{collections,redemptions,holdings}`,
with `?format=csv`, and needs the `reports:view` permission.

## Customer mobile app

`apps/mobile` is an Expo app (iOS, Android, and web for previews). One build serves one client:
the client's slug and API address are environment variables, and the name, logo and colours
come from that client's branding in the API. See [apps/mobile/README.md](apps/mobile/README.md).

```bash
cd apps/mobile && npm ci
cp .env.example .env     # set EXPO_PUBLIC_TENANT_SLUG and EXPO_PUBLIC_API_URL
npm run web              # or: npm start, then scan the QR code with Expo Go
```

## Business website

`apps/website` shows the content published in the Console: the site settings, the menu, each
published page's sections, and today's rate (refreshed every minute). It is plain React with
no UI library, so the bundle is small. Colours, font, logo and favicon come from the client's
branding, so one build serves one client.

```bash
cd apps/website && cp .env.example .env   # set VITE_TENANT_SLUG
npm run dev                               # http://localhost:5175, proxies /api and /media to the API
npm run build                             # the plain app in dist/
npm run build:static                      # production: also one HTML file per page, for search engines
```

In production serve `dist/` (see apps/website/README.md for the host settings), and send `/api` and `/media` to the API.

## Website content

Each client's website is content, not code. In the Console's **Website** tab you edit:

- **Site settings** (title, contact details, social and app links), live as soon as saved.
- **Pages**, each a list of sections: banner, text, picture and text, highlights, steps,
  today's gold rate, questions and answers, gallery, call to action and contact. Edits
  are a draft until you press **Publish**. Every new client starts with a draft home page.

Images are uploaded in the **Images** tab or from any image field. The API checks each
file's bytes (PNG, JPEG, GIF, WebP or ICO, up to `DG_MEDIA_MAX_MB`, 5 MB by default),
stores it under `DG_MEDIA_DIR` and serves it at `/media`. Rich text is cleaned on save,
keeping only formatting tags and safe links.

The website reads published content from `GET /public/tenants/{slug}/site`,
`/public/tenants/{slug}/pages/{page}` and `/public/tenants/{slug}/rate`.

## Tests

```bash
cd apps/api
uv run pytest           # needs the database from docker compose (digigold_test)
uv run ruff check . && uv run ruff format --check .
cd ../..
npm run lint && npm run build  # CRM, Console and shared components
cd apps/mobile && npm run typecheck && npm run lint
```

## Deploying

See [docs/deployment.md](docs/deployment.md) for what production needs.

## Design documents

- Plan review: https://claude.ai/code/artifact/300527f5-57ad-438b-a409-4b093c2d1ef4
- Gold savings scheme MVP design: https://claude.ai/code/artifact/2d33af12-7281-48af-8a4d-b96301dab842
- Tech stack: https://claude.ai/code/artifact/fbc08f46-f02b-4d38-abf9-5157951f8d31
