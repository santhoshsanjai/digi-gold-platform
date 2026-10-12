# CRM

The staff web app for each jeweller. React 19, Vite, TypeScript, Ant Design 6, Tailwind 4
and RTK Query, following the team's React setup.

```
src/
  api/types.ts        short names for the generated API types
  config/tenant.ts    which client this build is serving (host name or VITE_TENANT_SLUG)
  store/              Redux store; api/ holds RTK Query endpoints per area
  providers/          theme (client branding, dark mode) and auth (session, permissions)
  routes/             router, sign-in and permission guards
  layouts/            signed-in shell with the role-based side menu; sign-in shell
  pages/              one file per screen, loaded on demand
  components/common   Can, BrandMark
```

Components the Console also uses live in `packages/web-common` and are imported as
`@digigold/web-common/...`: InputContainer and the App* inputs, Card, StatCard, Badge,
PageHeader, StatusBadge, ErrorBoundary, the pagination and debounce hooks, formatting,
error messages, validation and the generated API types.

**Nothing about a client is hard-coded.** Name, logo, favicon, colours and font come from
`GET /public/tenants/{slug}/config`. Tailwind's `primary-*` shades and Ant Design's
primary colour are both derived from the client's brand colour at runtime.

**The side menu comes from the API.** `GET /auth/me` returns the menu the user's role
allows; pages also check permissions, so a typed-in address shows "No access".

**Sessions.** The access token stays in memory. The refresh token is kept in
`localStorage` and rotated on every use; when a request gets a 401 the app refreshes once
and retries. Tabs take turns refreshing so they never send a stale token, which the API
would treat as theft and end every session.
