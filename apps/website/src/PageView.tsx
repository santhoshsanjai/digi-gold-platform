import { useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, NotFound, type Site, type SiteConfig } from './api/client'
import { useHead } from './head'
import { SectionView } from './sections'
import { headData } from './seo'
import { usePreload } from './preload'
import { useReveal } from './ui/reveal'
import { useAsync } from './useAsync'

export function PageView({ slug: fixed, site, config }: { slug?: string; site: Site; config: SiteConfig }) {
  const params = useParams()
  const slug = fixed ?? params.slug ?? 'home'
  const pre = usePreload()
  const first = pre?.page?.slug === slug ? pre.page : undefined
  const page = useAsync((s) => api.page(slug, s), `page:${slug}`, undefined, first)
  const data = page.status === 'ready' ? page.data : null
  const root = useRef<HTMLDivElement>(null)

  const origin = typeof window === 'undefined' ? '' : window.location.origin
  useHead(headData(config, site, data, slug === 'home' ? '/' : `/${slug}`, origin))
  useReveal(root, data)

  if (page.status === 'loading') return <PageSkeleton />
  if (page.status === 'error') {
    const missing = page.error instanceof NotFound
    return (
      <Notice
        title={missing ? 'Page not found' : 'We could not load this page'}
        text={missing ? 'The page may have moved. Use the menu to find what you need.' : 'Please check your connection and try again.'}
        retry={!missing}
      />
    )
  }
  if (!page.data.content.sections.length) {
    return <Notice title={page.data.title} text="This page is being prepared. Please visit again soon." />
  }
  return (
    <div ref={root}>
      {page.data.content.sections.map((s) => (
        <SectionView key={s.id} section={s} site={site} />
      ))}
    </div>
  )
}

export function Notice({ title, text, retry }: { title: string; text: string; retry?: boolean }) {
  return (
    <div className="notice">
      <span className="ornament" aria-hidden="true" />
      <h1>{title}</h1>
      <p>{text}</p>
      <div className="actions center">
        {retry ? (
          <button type="button" className="btn solid" onClick={() => window.location.reload()}>
            <span>Try again</span>
          </button>
        ) : null}
        <Link className="btn line" to="/"><span>Back to home</span></Link>
      </div>
    </div>
  )
}

/** Shown while a page loads: the shape of a banner and a row of tiles, gently shimmering. */
export function PageSkeleton() {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Loading">
      <div className="sk-hero" />
      <div className="wrap sk-row">
        {[0, 1, 2, 3].map((i) => <div key={i} className="sk-tile" />)}
      </div>
    </div>
  )
}
