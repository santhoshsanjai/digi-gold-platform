import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { PreloadContext } from './preload'
import './styles.css'

const root = document.getElementById('root')!
// A host that falls back to index.html for unknown addresses would hand us the home page's
// pre-rendered HTML here; only attach to it when it was rendered for this very address.
const here = location.pathname.replace(/(.)\/$/, '$1')
const preload = window.__PRELOAD__?.url === here ? window.__PRELOAD__ : undefined
const app = (
  <StrictMode>
    <PreloadContext.Provider value={preload}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PreloadContext.Provider>
  </StrictMode>
)
// A pre-rendered page already has its content: attach to it instead of drawing it again.
if (preload) hydrateRoot(root, app)
else {
  root.replaceChildren()
  createRoot(root).render(app)
}
