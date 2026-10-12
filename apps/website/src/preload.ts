import { createContext, useContext } from 'react'
import type { Site, SiteConfig, SitePage } from './api/client'

/** Data baked into a pre-rendered page, so it shows at once and search engines can read it. */
export interface Preload {
  /** The address this page was rendered for. */
  url: string
  config: SiteConfig
  site: Site
  page?: SitePage
}

declare global {
  interface Window {
    __PRELOAD__?: Preload
  }
}

export const PreloadContext = createContext<Preload | undefined>(undefined)
export const usePreload = () => useContext(PreloadContext)
