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
Drafts are never served. A page's title and description go into the tab title, the
search description and the sharing (Open Graph) tags. Rich text arrives already cleaned by the API.

## Design system

`src/styles.css` derives the whole palette from the client's three brand colours (main, second,
background) and uses two fonts (body and headings), all set in the Console's Branding tab. Nothing
about a client is in the CSS or the components. Spacing, type scale and motion are tokens at the top
of the file.

| Section (Console name) | Renders as |
| --- | --- |
| Banner (`hero`) | Full-screen or compact banner, optional picture, up to two buttons |
| Picture and text (`image_text`) | Editorial split with a framed picture and an optional button |
| Category tiles (`categories`) | Picture tiles in the order set in the Console |
| Featured collections (`collections`) | Large alternating picture-and-text rows |
| Highlights / Steps | Icon or numbered points |
| Gallery | Square grid with a keyboard-friendly lightbox |
| Call to action | Dark band with a button |
| Contact | Address, hours, phone, WhatsApp, email, directions and an optional Google map |
| Today's gold rate, FAQ, Text | As before, restyled |

Every section can have a small label above its heading. Every picture has a description (alt text)
and a "sample picture" switch: samples get a visible "Sample image" tag so stock or borrowed photos
are never taken for the client's own pieces. Missing or broken pictures show a placeholder panel.
Sections fade in as they scroll into view (transform and opacity only). Visitors who prefer less
motion see no animation, and the content is visible without JavaScript.

Site settings also cover an announcement bar, a sharing picture, multi-line opening hours, a map
embed, and an opt-in "tell search engines about the shop" switch. That switch adds schema.org
`JewelryStore` or `Store` data built only from the details entered in the Console.

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
