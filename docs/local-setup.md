# Run everything on your computer and check it works

This takes about 20 minutes the first time. You will start the API, then each app, and try
the main things a client would do. Commands are for macOS, Linux, or Windows with WSL.

## 0. What you need

| Tool | Why | Check |
| --- | --- | --- |
| Git | get the code | `git --version` |
| Docker Desktop | runs PostgreSQL and a fake email inbox | `docker --version` |
| Node 22 | the web apps and the mobile app | `node --version` |
| [uv](https://docs.astral.sh/uv/getting-started/installation/) | runs the API and fetches the right Python | `uv --version` |
| Expo Go (optional) | try the mobile app on your phone | App Store or Play Store |

Ports used: 5432 (database), 8025 and 1025 (email inbox), 8000 (API), 5173 (CRM),
5174 (Console), 5175 (website), 8081 (mobile app preview).

## 1. Get the code and install

```bash
git clone https://github.com/santhoshsanjai/digi-gold-platform.git
cd digi-gold-platform
npm install                      # the CRM, Console and website, in one go
cd apps/mobile && npm ci && cd ../..   # the mobile app has its own install
```

## 2. Start the database and the email inbox

```bash
docker compose up -d db mail
```

The inbox is at <http://localhost:8025>. Every email the platform sends (temporary passwords,
reminders) lands there instead of going out.

## 3. Start the API and load demo data

Open a terminal and leave it running. **Sign-in codes for customers appear in this terminal.**

```bash
cd apps/api
cp .env.example .env
uv sync
uv run alembic upgrade head                 # creates the tables
uv run python -m app.cli seed-demo          # demo client, logins, a rate, a store, a home page
uv run uvicorn app.main:app --reload --port 8000
```

Check: <http://localhost:8000/docs> shows the API. `seed-demo` only works on a development
machine and can be run again to reset the demo passwords.

**Demo logins** (the same password for both):

| Who | Where | Email | Password |
| --- | --- | --- | --- |
| You, the platform owner | Console | `admin@platform.example.com` | `Demo-pass-2026` |
| The client's owner (staff) | CRM | `owner@example.com` | `Demo-pass-2026` |
| A customer | Mobile app | any 10-digit number, for example `9876543210` | a code printed in the API terminal |

## 4. Platform Console (you) - http://localhost:5174

```bash
cd apps/console && cp .env.example .env.local && npm run dev
```

Sign in as the platform owner, then check:

1. **Clients** lists *Demo Jewellers*. Open it.
2. **Branding:** change the colours and name, save, and see the preview change. Upload a logo.
3. **Features:** switch a feature on and off.
4. **Website:** edit the site details, open the *Home* page, add a section, press **Save draft**, then **Publish**.
5. **Images:** upload a PNG or JPEG. A fake image file renamed to `.png` is refused.
6. Back on **Clients**, create a second client. Its owner's temporary password arrives in the email inbox (<http://localhost:8025>).

## 5. CRM (the client's staff) - http://localhost:5173

```bash
cd apps/crm && cp .env.example .env.local && npm run dev
```

Sign in as the owner (`owner@example.com`). The side menu follows the user's role. Check:

1. **Gold rate:** publish a rate. A change of more than 3% asks you to confirm. Pause and resume buying.
2. **Settings:** set *Days before a payment can be redeemed* to **0** so you can test redemption today. Look at the minimum payment, the redemption threshold and the other scheme settings.
3. **Stores, Users, Roles:** add a store. Add a user with the *Store staff* role. Their temporary password arrives in the email inbox, and they must change it at first sign-in. Sign in as them in a private window and see that their menu is shorter.
4. Come back here after step 7 to see customers, payments, redemptions, expiring lots, reports and the dashboard.

## 6. Business website - http://localhost:5175

```bash
cd apps/website && cp .env.example .env && npm run dev
```

Check:

1. The home page shows what you published in the Console, in the colours and logo you set under *Branding*.
2. Edit and publish again in the Console. Reload the website to see the change within a minute.
3. Add a *Today's gold rate* section in the Console and publish. It shows the rate from the CRM.
4. Try an address that does not exist, such as `/nothing-here`. It shows "Page not found".
5. Shrink the window to phone width. The menu becomes a button.

To see the static pages search engines get: `npm run build:static` (needs the API running), then `npm run preview` and open <http://localhost:4175>.

## 7. Customer mobile app

```bash
cd apps/mobile && cp .env.example .env
npm run web          # opens at http://localhost:8081
```

`.env` already points at `demo` and `http://localhost:8000/api/v1`. Check:

1. The sign-in screen shows the client's name. Enter `9876543210` and press **Send code**.
2. Find the code in the **API terminal**: a line like `sms to=+919876543210 body=123456 is your ...`. Enter it.
3. **Home** shows today's rate. Tap **Buy gold**, pick ₹2,000, continue. The practice payment screen has three buttons:
   - **Pay** adds the gold. Check that it equals ₹2,000 divided by the rate.
   - **Make the payment fail** and **Leave it pending** add nothing.
4. **My gold** shows each purchase with its days left. **History** shows the ledger.
5. Buy ₹6,000 more so you hold at least 1 g. Home now offers **Get redemption code**: a 6-digit code and a QR that expires in a few minutes.
6. **Profile:** save your name and email. Add a PAN (format `ABCDE1234F`).

On a real phone: run `npm start`, scan the QR with Expo Go, and set `EXPO_PUBLIC_API_URL` in `.env` to your computer's address, for example `http://192.168.1.20:8000/api/v1`. Start the API with `--host 0.0.0.0` so the phone can reach it. The phone and computer must be on the same Wi-Fi. If Expo Go says it does not support this version, use the browser preview instead.

## 8. Back in the CRM: close the loop

1. **Customers:** the customer from step 7 is listed with their grams. Open them to see lots, payments and the ledger.
2. **Payments:** the paid, failed and pending payments are all there.
3. **Redemptions:** enter the customer's mobile number and the code from the app. The redemption succeeds, the customer's balance becomes zero, and a slip opens to print.
4. **Dashboard:** customers, gold held, today's collections.
5. **Reports:** collections, redemptions and gold held. Download a CSV and open it in Excel.
6. **Expiring lots:** empty for now, because the lots are new. To see something here, set *Each payment is valid for* in Settings to 10 days, then buy again: the new lot is about to expire.

## 9. Run the automated checks

```bash
cd apps/api && uv run pytest -q                      # 92 API tests
uv run ruff check . && uv run ruff format --check .
cd ../.. && npm run lint && npm run build            # CRM, Console, website
cd apps/mobile && npm run typecheck && npm run lint
```

## If something goes wrong

| Problem | Fix |
| --- | --- |
| `docker compose` cannot connect | Start Docker Desktop and try again |
| API: `connection refused` on 5432 | `docker compose up -d db` and wait a few seconds |
| Port already in use | Stop the other program, or choose another port (Vite: `npm run dev -- --port 5180`) |
| CRM says the client is unknown | `apps/crm/.env.local` must have `VITE_TENANT_SLUG=demo` and `seed-demo` must have run |
| No sign-in code in the app | Look at the API terminal, not the email inbox |
| Reset everything | `docker compose down -v`, then repeat from step 2 |
