import type { SiteConfig } from './api/client'
import { setFavicon } from './head'

type Branding = SiteConfig['branding']

const SYSTEM_FONTS = /^(system-ui|sans-serif|serif|georgia|arial|helvetica|times)/i
const clean = (font: string) => font.trim().replace(/["\\<>;{}]/g, '')

/** The client's colours and fonts as CSS variables; nothing about a client is in the CSS. */
export function brandVars(b: Branding): Record<string, string> {
  const vars: Record<string, string> = {
    '--primary': b.primary_color,
    '--secondary': b.secondary_color,
    '--bg': b.background_color,
  }
  const body = clean(b.font_family)
  const heading = clean(b.heading_font_family)
  if (body) vars['--font'] = `"${body}", system-ui, sans-serif`
  if (heading) vars['--heading-font'] = `"${heading}", Georgia, serif`
  return vars
}

/** One Google Fonts request for the body and heading fonts, or null when both are system fonts. */
export function fontHref(b: Branding): string | null {
  const wanted: [string, string][] = [
    [clean(b.font_family), 'wght@300;400;500;600'],
    [clean(b.heading_font_family), 'ital,wght@0,400;0,500;0,600;1,400'],
  ]
  const families = wanted.filter(([f], i) => f && !SYSTEM_FONTS.test(f) && wanted.findIndex(([g]) => g === f) === i)
  if (!families.length) return null
  const q = families.map(([f, axes]) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:${axes}`).join('&')
  return `https://fonts.googleapis.com/css2?${q}&display=swap`
}

/** For pre-rendered pages: the same variables as a style rule, so there is no flash of default colours. */
export function themeCss(b: Branding): string {
  return `:root{${Object.entries(brandVars(b)).map(([k, v]) => `${k}:${v}`).join(';')}}`
}

export function applyBranding(b: Branding) {
  const root = document.documentElement.style
  for (const [k, v] of Object.entries(brandVars(b))) root.setProperty(k, v)
  const href = fontHref(b)
  const existing = document.getElementById('brand-font') as HTMLLinkElement | null
  if (href && existing?.href !== href) {
    const link = existing ?? document.createElement('link')
    link.id = 'brand-font'
    link.rel = 'stylesheet'
    link.href = href
    if (!existing) document.head.append(link)
  }
  setFavicon(b.favicon_url)
}
