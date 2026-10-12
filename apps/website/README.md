# Business website

A static React site for one client. Content is edited in the Platform Console (Website tab);
this app only displays what is published.

| Variable | Meaning |
| --- | --- |
| `VITE_TENANT_SLUG` | The client's slug (set at build time) |
| `VITE_API_URL` | The API, default `/api/v1` (same address as the site) |
| `VITE_API_PROXY_TARGET` | Development only: where the dev server forwards `/api` and `/media` |

```bash
npm run dev          # from the repo root: npm run dev -w @digigold/website
npm run build        # tsc, then vite build into dist/
npm run api:types    # after the API changes: regenerates src/api/schema.d.ts
```

What it reads: `GET /public/tenants/{slug}/config`, `/site`, `/pages/{page}` and `/rate`.
Drafts are never served. A page's title and description go into the tab title and the
search description. Rich text arrives already cleaned by the API.

Pages are rendered in the browser. Pre-rendering each page to static HTML (better for
search engines and first paint) is a later step.
