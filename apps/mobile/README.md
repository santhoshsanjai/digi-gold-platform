# Customer app (Expo)

Customers sign in with a mobile number and a one-time code, see today's rate, buy gold from
the minimum amount set in the CRM, watch each purchase's validity, and show a redemption code
in the store. Payments are a practice screen (success, failure, pending) until Razorpay is connected.

One build serves one client. Nothing about the client is in the code:

| Variable | Meaning |
| --- | --- |
| `EXPO_PUBLIC_TENANT_SLUG` | The client's slug, as created in the Console |
| `EXPO_PUBLIC_API_URL` | The API, for example `https://api.example.com/api/v1` |
| `APP_NAME`, `APP_SLUG`, `APP_SCHEME`, `APP_ID` | Optional store-build identity (see `app.config.ts`) |

The name, logo, colours and support contacts are fetched from the client's branding at start-up.

```bash
npm ci
npm run web         # browser preview on http://localhost:8081
npm start           # Expo Go on a phone; use your computer's address for the API
npm run typecheck && npm run lint
npm run api:types   # after the API changes: regenerates src/api/schema.d.ts
```

On a phone, `localhost` is the phone itself, so set `EXPO_PUBLIC_API_URL` to your computer's
address. In development the one-time codes are written to the API log (no SMS provider yet).

Sessions are kept in the secure store. Refresh tokens rotate; the app shares one refresh at a
time so a second request never replays an old token.
