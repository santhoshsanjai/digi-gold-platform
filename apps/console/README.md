# Platform Console

Where the platform owner runs the platform: add clients, set each client's branding and
features, and edit each client's website. Only platform admins can sign in. Same stack
and layout as the CRM (React 19, Vite, TypeScript, Ant Design 6, Tailwind 4, RTK Query),
with shared pieces from `packages/web-common`.

```
src/
  api/types.ts        short names for the generated API types
  config/env.ts       API address and the CRM address used by "Open CRM"
  store/              Redux store; api/consoleApi.ts holds the Console endpoints
  providers/          theme (dark mode) and auth (session)
  routes/             router and the platform-admin guard
  layouts/            signed-in shell; sign-in shell
  pages/              clients list, one client (tabs), page editor, sign-in screens
  components/         image field and picker, rich text editor, section editors
```

**Screens**

- **Clients**: every client, and **Add client** (the address is filled from the name; the
  owner gets a temporary password by email).
- **A client**: Overview (rename, suspend or reactivate), Branding (logo, icon, colours,
  font, with a live preview), Features, Website (pages and site settings) and Images.
- **Page editor**: add, reorder and remove sections, edit each one, then **Save draft** or
  **Publish**. Leaving with unsaved edits asks first. The rich text editor (Jodit) loads
  only when the editor opens, and its toolbar offers only what the API keeps.

Suspending a client signs out its staff and customers at once and takes its website
offline; reactivating restores everything.

**Environment** (`.env.local`)

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `/api/v1` | API address as the browser sees it |
| `VITE_API_PROXY_TARGET` | `http://localhost:8000` | Where the dev server sends `/api` and `/media` |
| `VITE_CRM_URL_TEMPLATE` | `https://{slug}.crm.example.com` | "Open CRM" link; `{slug}` is the client's address |

```bash
npm run dev        # http://localhost:5174
npm run lint
npm run build
```
