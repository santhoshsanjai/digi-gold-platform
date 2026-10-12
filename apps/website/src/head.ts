import { useEffect } from 'react'

function meta(name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.name = name
    document.head.append(el)
  }
  el.content = content
}

/** Sets the tab title and search description for the current page. */
export function useHead(title: string, description: string) {
  useEffect(() => {
    document.title = title
    meta('description', description)
  }, [title, description])
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
