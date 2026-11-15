# Client-review deployment on Render

`render.yaml` at the repository root creates the API and a PostgreSQL database on Render's
free plans, in Singapore (closest to India).

## Free-plan limits

- The API sleeps after 15 minutes without requests; the first request after that takes
  about a minute.
- The free database expires 30 days after it is created. Upgrade it, or move to another
  host, before then.
- Uploaded images live on the container's disk and are lost on every deploy or restart.
- `DG_ENV=dev`: with no SMS provider yet, SMS codes appear in the service's **Logs** tab.
- Free services cannot use SMTP ports, so email is sent through Brevo's HTTPS API. Set
  `DG_BREVO_API_KEY` and `DG_EMAIL_FROM` as described in [email-setup.md](email-setup.md);
  until then, emails also go to the **Logs** tab.

## First deploy

1. Sign up at <https://render.com> with GitHub and allow access to `digi-gold-platform`.
2. **New > Blueprint**, pick the repository and the release branch, and apply.
   Render creates `digigold-db`, then builds the API, which runs the migrations on start.
3. Check `https://<service>.onrender.com/health` returns `{"status":"ok"}`.

## Copy a local database into Render

Back up the local database as a superuser (the API's own role cannot read past row-level
security), then restore it into Render with the database's **External Database URL**
(Render dashboard > `digigold-db` > Connect):

```powershell
pg_dump -h localhost -p 5433 -U postgres -d digigold -Fc --no-owner --no-privileges -f digigold.dump
pg_restore --clean --if-exists --no-owner --no-privileges -d "<External Database URL>" digigold.dump
```

`--clean` replaces the tables the first deploy created. Restart the API afterwards
(**Manual Deploy > Restart service**) so it drops cached tenant settings.

## Android test build

The mobile app reads the API address at build time:

```powershell
$env:EXPO_PUBLIC_API_URL='https://<service>.onrender.com/api/v1'
$env:EXPO_PUBLIC_TENANT_SLUG='sivashree'
$env:APP_NAME='Sivashree Jewellers'; $env:APP_ID='com.sivashree.jewellers'
npx expo prebuild --platform android --clean
cd android; .\gradlew.bat assembleRelease
```

The APK is at `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`. It is
signed with the debug key, which is fine for side-loading but not for the Play Store.
