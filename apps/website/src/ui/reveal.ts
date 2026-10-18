import { useEffect, type RefObject } from 'react'

/**
 * Fades `[data-reveal]` elements in as they scroll into view (transform and opacity only).
 * Content is visible without JavaScript and for visitors who prefer less motion: the hidden
 * state only applies once <html> has the `reveal` class, which is never added for them.
 */
export function useReveal(root: RefObject<HTMLElement | null>, key: unknown) {
  useEffect(() => {
    const el = root.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const items = [...el.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-in)')]
    // Whatever is already on screen shows at once, so nothing flickers on load.
    for (const item of items) if (item.getBoundingClientRect().top < window.innerHeight) item.classList.add('is-in')
    document.documentElement.classList.add('reveal')

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          e.target.classList.add('is-in')
          io.unobserve(e.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )
    items.filter((i) => !i.classList.contains('is-in')).forEach((i) => io.observe(i))
    return () => io.disconnect()
  }, [root, key])
}
