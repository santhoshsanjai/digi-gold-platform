import type { Site, SiteConfig, SitePage } from './api/client'

/** Everything that goes in a page's <head>, worked out the same way in the browser and at build time. */
export interface HeadData {
  title: string
  description: string
  siteName: string
  /** Absolute, or empty when the site address is not known. */
  canonical: string
  image: string
  /** schema.org data, only when the client has asked for it in the Console. */
  jsonLd: Record<string, unknown> | null
}

export const siteNameOf = (config: SiteConfig, site: Site) =>
  site.settings.site_title || config.branding.display_name || config.name

const absolute = (url: string, origin: string) =>
  !url ? '' : /^https?:\/\//.test(url) ? url : origin && url.startsWith('/') ? origin + url : ''

/**
 * `origin` is the public address (https://www.example.com), or '' when unknown.
 * Structured data uses only what the client entered in the site settings: nothing is guessed.
 */
export function headData(config: SiteConfig, site: Site, page: SitePage | null, path: string, origin: string): HeadData {
  const s = site.settings
  const siteName = siteNameOf(config, site)
  const title = page ? `${page.seo_title || page.title} | ${siteName}` : siteName
  const description = page?.seo_description || s.seo_description
  const logo = absolute(config.branding.logo_url, origin)
  const image = absolute(s.share_image_url, origin) || logo
  const canonical = origin ? origin + path : ''

  let jsonLd: HeadData['jsonLd'] = null
  if (s.local_business) {
    const c = s.contact
    const sameAs = Object.values(s.social).filter(Boolean)
    const entries: [string, unknown][] = [
      ['@context', 'https://schema.org'],
      ['@type', s.local_business],
      ['name', siteName],
      ['description', s.seo_description],
      ['url', origin ? origin + '/' : ''],
      ['logo', logo],
      ['image', image],
      ['telephone', c.phone],
      ['email', c.email],
      ['address', c.address.split('\n').map((l) => l.trim()).filter(Boolean).join(', ')],
      ['hasMap', c.map_url],
      ['sameAs', sameAs.length ? sameAs : ''],
    ]
    jsonLd = Object.fromEntries(entries.filter(([, v]) => v))
  }
  return { title, description, siteName, canonical, image, jsonLd }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
// JSON inside a <script> must not be able to close it.
export const scriptJson = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '')

/** The <head> tags as HTML, for pre-rendered pages. */
export function headHtml(d: HeadData): string {
  const metas: [string, string, string][] = [
    ['name', 'description', d.description],
    ['property', 'og:type', 'website'],
    ['property', 'og:site_name', d.siteName],
    ['property', 'og:title', d.title],
    ['property', 'og:description', d.description],
    ['property', 'og:image', d.image],
    ['property', 'og:url', d.canonical],
    ['name', 'twitter:card', d.image ? 'summary_large_image' : 'summary'],
  ]
  return [
    `<title>${esc(d.title)}</title>`,
    ...metas.filter(([, , v]) => v).map(([attr, key, v]) => `<meta ${attr}="${key}" content="${esc(v)}" />`),
    d.canonical ? `<link rel="canonical" href="${esc(d.canonical)}" />` : '',
    d.jsonLd ? `<script type="application/ld+json" id="ld-json">${scriptJson(d.jsonLd)}</script>` : '',
  ]
    .filter(Boolean)
    .join('\n    ')
}
