import type { SiteConfig } from './api/client'
import { setFavicon } from './head'

const SYSTEM_FONTS = /^(system-ui|sans-serif|serif|georgia|arial|helvetica|times)/i

/** The client's colours and font become CSS variables; nothing about a client is in the CSS. */
export function applyBranding(b: SiteConfig['branding']) {
  const root = document.documentElement.style
  root.setProperty('--primary', b.primary_color)
  root.setProperty('--secondary', b.secondary_color)
  root.setProperty('--bg', b.background_color)
  const font = b.font_family.trim()
  if (font) {
    root.setProperty('--font', `"${font}", system-ui, sans-serif`)
    if (!SYSTEM_FONTS.test(font) && !document.getElementById('brand-font')) {
      const link = document.createElement('link')
      link.id = 'brand-font'
      link.rel = 'stylesheet'
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;600;700&display=swap`
      document.head.append(link)
    }
  }
  setFavicon(b.favicon_url)
}
