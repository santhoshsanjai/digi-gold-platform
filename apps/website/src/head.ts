import { useEffect } from 'react'
import type { HeadData } from './seo'

function meta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!content) return el?.remove()
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.append(el)
  }
  el.content = content
}

/** Keeps the tab title, search description, sharing tags and structured data in step with the page. */
export function useHead(d: HeadData) {
  const ld = d.jsonLd ? JSON.stringify(d.jsonLd) : ''
  useEffect(() => {
    document.title = d.title
    meta('name', 'description', d.description)
    meta('property', 'og:type', 'website')
    meta('property', 'og:site_name', d.siteName)
    meta('property', 'og:title', d.title)
    meta('property', 'og:description', d.description)
    meta('property', 'og:image', d.image)
    meta('property', 'og:url', d.canonical)
    meta('name', 'twitter:card', d.image ? 'summary_large_image' : 'summary')

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (d.canonical) {
      if (!canonical) {
        canonical = document.createElement('link')
        canonical.rel = 'canonical'
        document.head.append(canonical)
      }
      canonical.href = d.canonical
    } else canonical?.remove()

    let script = document.getElementById('ld-json')
    if (ld) {
      if (!script) {
        script = document.createElement('script')
        script.id = 'ld-json'
        script.setAttribute('type', 'application/ld+json')
        document.head.append(script)
      }
      script.textContent = ld
    } else script?.remove()
  }, [d.title, d.description, d.siteName, d.image, d.canonical, ld])
}

export function setFavicon(href: string) {
  if (!href) return
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!el) {
    el = document.createElement('link')
    el.rel = 'icon'
    document.head.append(el)
  }
  el.href = href
}
