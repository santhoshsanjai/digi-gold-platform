import { useParams } from 'react-router-dom'
import { api, NotFound, type Site } from './api/client'
import { useHead } from './head'
import { SectionView } from './sections'
import { usePreload } from './preload'
import { useAsync } from './useAsync'

export function PageView({ slug: fixed, site }: { slug?: string; site: Site }) {
  const params = useParams()
  const slug = fixed ?? params.slug ?? 'home'
  const pre = usePreload()
  const first = pre?.page?.slug === slug ? pre.page : undefined
  const page = useAsync((s) => api.page(slug, s), `page:${slug}`, undefined, first)
  const data = page.status === 'ready' ? page.data : null
  const siteName = site.settings.site_title || site.name

  useHead(
    data ? `${data.seo_title || data.title} | ${siteName}` : siteName,
    data?.seo_description || site.settings.seo_description,
  )

  if (page.status === 'loading') return <div className="center" aria-busy="true" />
  if (page.status === 'error') {
    const missing = page.error instanceof NotFound
    return (
      <div className="center">
        <h1>{missing ? 'Page not found' : 'We could not load this page'}</h1>
        <p>{missing ? 'The page may have moved. Use the menu to find what you need.' : 'Please try again in a moment.'}</p>
      </div>
    )
  }
  return (
    <>
      {page.data.content.sections.map((s) => (
        <SectionView key={s.id} section={s} site={site} />
      ))}
    </>
  )
}
