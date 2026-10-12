import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import App from './App'
import { PreloadContext, type Preload } from './preload'

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
