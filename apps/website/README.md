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

## Static pages for search engines

`npm run build` makes the plain app (what CI builds). For production use `npm run build:static`,
which also writes one HTML file per published page with its content, title and description
already in it, plus `robots.txt` and (with `SITE_URL`) `sitemap.xml`. The browser then takes over
and refreshes the content, so a visitor never sees stale text for long.

| Variable | Meaning |
| --- | --- |
| `PRERENDER_API_URL` | The API to read published content from at build time (default `http://localhost:8000/api/v1`) |
| `SITE_URL` | The public address, for `sitemap.xml` and canonical links, for example `https://www.example.com` |

Publishing in the Console does not change these files by itself: rebuild (or run
`node scripts/prerender.mjs` again after a build) to update them.

Host settings: serve `/page` from `page.html`, and send unknown addresses to `404.html`. With nginx:

```nginx
location / { try_files $uri $uri.html $uri/index.html /404.html; }
```

Netlify, Cloudflare Pages and similar hosts do this on their own.
