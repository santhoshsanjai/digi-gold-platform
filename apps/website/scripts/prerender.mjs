// Writes a static HTML file for every published page, so search engines and slow phones get the
// content at once. Run after `vite build` and `vite build --ssr` (see `npm run build:static`).
//
//   PRERENDER_API_URL  where to read the published content (default http://localhost:8000/api/v1)
//   VITE_TENANT_SLUG   which client (default demo)
//   SITE_URL           the public address, for sitemap.xml (optional)
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const api = (process.env.PRERENDER_API_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')
const tenant = process.env.VITE_TENANT_SLUG || 'demo'
const siteUrl = (process.env.SITE_URL || '').replace(/\/$/, '')

const get = async (path) => {
  const res = await fetch(`${api}/public/tenants/${tenant}${path}`)
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  return res.json()
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
// JSON inside a <script> must not be able to close it.
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '')

const [config, site] = await Promise.all([get('/config'), get('/site')])
const { render } = await import(pathToFileURL(join(root, 'dist-server/entry-server.js')).href)
// 404.html is the untouched app shell written by an earlier run, so running this twice is safe.
const shell = await readFile(join(root, 'dist/404.html'), 'utf8').catch(() => null)
const template = shell ?? (await readFile(join(root, 'dist/index.html'), 'utf8'))
if (!template.includes('<div id="root"></div>')) throw new Error('dist/index.html has no root element')

const b = config.branding
const siteName = site.settings.site_title || config.branding.display_name || config.name
const theme = `:root{--primary:${b.primary_color};--secondary:${b.secondary_color};--bg:${b.background_color}${
  b.font_family ? `;--font:"${String(b.font_family).replace(/["\\<]/g, '')}",system-ui,sans-serif` : ''
}}`

let written = 0
for (const slug of site.pages) {
  const page = await get(`/pages/${encodeURIComponent(slug)}`)
  const url = slug === 'home' ? '/' : `/${slug}`
  const preload = { url, config, site, page }
  const title = `${page.seo_title || page.title} | ${siteName}`
  const description = page.seo_description || site.settings.seo_description
  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    b.favicon_url ? `<link rel="icon" href="${esc(b.favicon_url)}" />` : '',
    siteUrl ? `<link rel="canonical" href="${esc(siteUrl + (url === '/' ? '/' : url))}" />` : '',
    `<style>${theme}</style>`,
  ].join('\n    ')
  const html = template
    // Drop the placeholder icon and empty title; the page's own are added below.
    .replace(/<link rel="icon"[^>]*>\s*/, '')
    .replace(/<title><\/title>/, head)
    .replace('<div id="root"></div>', () => `<div id="root">${render(url, preload)}</div><script>window.__PRELOAD__=${json(preload)}</script>`)
  const file = slug === 'home' ? join(root, 'dist/index.html') : join(root, 'dist', `${slug}.html`)
  await mkdir(dirname(file), { recursive: true })
  if (slug === 'home') await writeFile(join(root, 'dist/404.html'), template) // the plain app, for any other address
  await writeFile(file, html)
  written++
}

await writeFile(join(root, 'dist/robots.txt'), `User-agent: *\nAllow: /\n${siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml\n` : ''}`)
if (siteUrl) {
  const urls = site.pages.map((s) => `  <url><loc>${esc(siteUrl + (s === 'home' ? '/' : `/${s}`))}</loc></url>`).join('\n')
  await writeFile(join(root, 'dist/sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`)
}
console.log(`Pre-rendered ${written} page${written === 1 ? '' : 's'} for ${tenant}`)
