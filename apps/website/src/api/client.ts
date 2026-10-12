import type { components } from './schema'

type S = components['schemas']
// The schema marks fields with defaults as optional, but the API always sends them.
type Full<T> = T extends (infer U)[] ? Full<U>[] : T extends object ? { [K in keyof T]-?: Full<T[K]> } : T
export type SiteConfig = Full<S['PublicConfig']>
export type Site = Full<S['PublicSite']>
export type SitePage = Full<S['PublicPage']>
export type Rate = S['PublicRate']
export type Section = SitePage['content']['sections'][number]
export type SectionOf<T extends Section['type']> = Extract<Section, { type: T }>

export const TENANT = import.meta.env.VITE_TENANT_SLUG || 'demo'
const BASE = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '')

export class NotFound extends Error {}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}/public/tenants/${TENANT}${path}`, { signal })
  if (res.status === 404) throw new NotFound(path)
  if (!res.ok) throw new Error(`Request failed (${res.status})`)
  return res.json()
}

export const api = {
  config: (s?: AbortSignal) => get<SiteConfig>('/config', s),
  site: (s?: AbortSignal) => get<Site>('/site', s),
  page: (slug: string, s?: AbortSignal) => get<SitePage>(`/pages/${encodeURIComponent(slug)}`, s),
  rate: (s?: AbortSignal) => get<Rate>('/rate', s),
}
