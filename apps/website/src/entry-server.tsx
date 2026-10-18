import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import App from './App'
import { PreloadContext, type Preload } from './preload'
import { headData, headHtml, scriptJson } from './seo'
import { fontHref, themeCss } from './theme'

/** Used by scripts/prerender.mjs at build time. */
export function render(url: string, preload: Preload): string {
  return renderToString(
    <PreloadContext.Provider value={preload}>
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    </PreloadContext.Provider>,
  )
}

/** The <head> tags for a pre-rendered page: the same title, sharing tags and data the browser sets. */
export function head(preload: Preload, siteUrl: string): string {
  const { config, site, page, url } = preload
  const b = config.branding
  const fonts = fontHref(b)
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  return [
    headHtml(headData(config, site, page ?? null, url, siteUrl)),
    b.favicon_url ? `<link rel="icon" href="${esc(b.favicon_url)}" />` : '',
    fonts ? '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />' : '',
    fonts ? `<link rel="stylesheet" id="brand-font" href="${esc(fonts)}" />` : '',
    `<style>${themeCss(b).replace(/</g, '')}</style>`,
  ]
    .filter(Boolean)
    .join('\n    ')
}

export { scriptJson }
