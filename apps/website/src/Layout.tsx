import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import type { Site, SiteConfig } from './api/client'
import { A } from './sections'
import { siteNameOf } from './seo'
import { Icon } from './ui/Icon'
import { telLink as tel, waLink } from './ui/links'

const SOCIAL = [
  ['instagram', 'Instagram'],
  ['facebook', 'Facebook'],
  ['youtube', 'YouTube'],
  ['x', 'X'],
] as const

export function Layout({ config, site, children }: { config: SiteConfig; site: Site; children: ReactNode }) {
  const { pathname } = useLocation()
  // The menu belongs to the address it was opened on, so moving to another page closes it.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === pathname
  const [scrolled, setScrolled] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  const drawer = useRef<HTMLDivElement>(null)

  const name = siteNameOf(config, site)
  const s = site.settings
  const { contact, social, app_links: apps } = s
  const socials = SOCIAL.filter(([k]) => social[k])
  const appUrl = apps.android || apps.ios
  const wa = waLink(contact.whatsapp)
  const href = (slug: string) => (slug === 'home' ? '/' : `/${slug}`)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // While the menu is open: no page scrolling, Escape closes it, and Tab stays inside it.
  useEffect(() => {
    if (!open) return
    const panel = drawer.current
    document.body.style.overflow = 'hidden'
    panel?.querySelector<HTMLElement>('a, button')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenOn(null)
        toggle.current?.focus()
      }
      if (e.key !== 'Tab' || !panel) return
      const items = [...panel.querySelectorAll<HTMLElement>('a, button')]
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        toggle.current?.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        toggle.current?.focus()
      } else if (document.activeElement === toggle.current) {
        e.preventDefault()
        ;(e.shiftKey ? last : first)?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      {s.announcement ? (
        <div className="announce">
          <div className="wrap">
            {s.announcement_url ? <A href={s.announcement_url}>{s.announcement}</A> : <span>{s.announcement}</span>}
          </div>
        </div>
      ) : null}
      <header className={`bar ${scrolled ? 'scrolled' : ''} ${open ? 'menu-open' : ''}`}>
        <div className="wrap bar-in">
          <Link to="/" className="brand" aria-label={`${name}, home`}>
            {config.branding.logo_url ? <img src={config.branding.logo_url} alt="" width={44} height={44} /> : null}
            <span className="brand-name">{name}</span>
          </Link>
          <nav className="nav-main" aria-label="Main">
            {site.nav.map((n) => (
              <NavLink key={n.slug} to={href(n.slug)} end>{n.title}</NavLink>
            ))}
          </nav>
          <div className="bar-actions">
            {contact.phone ? (
              <a className="bar-call" href={tel(contact.phone)} aria-label={`Call ${contact.phone}`}>
                <Icon name="phone" size={18} />
                <span>{contact.phone}</span>
              </a>
            ) : null}
            {appUrl ? <a className="btn solid small bar-app" href={appUrl}>Get the app</a> : null}
            <button
              ref={toggle}
              type="button"
              className="menu-btn"
              aria-expanded={open}
              aria-controls="site-menu"
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpenOn(open ? null : pathname)}
            >
              <Icon name={open ? 'close' : 'menu'} size={24} />
            </button>
          </div>
        </div>
      </header>
      <div className={`drawer ${open ? 'open' : ''}`} id="site-menu" ref={drawer} inert={!open}>
        <div className="drawer-scrim" onClick={() => setOpenOn(null)} />
        <div className="drawer-panel" role="dialog" aria-modal="true" aria-label="Menu">
          <nav aria-label="Menu">
            {site.nav.map((n, i) => (
              <NavLink key={n.slug} to={href(n.slug)} end style={{ '--i': i } as CSSProperties} onClick={() => setOpenOn(null)}>
                {n.title}
              </NavLink>
            ))}
          </nav>
          <div className="drawer-foot">
            {contact.phone ? <a href={tel(contact.phone)}><Icon name="phone" size={18} /> {contact.phone}</a> : null}
            {contact.email ? <a href={`mailto:${contact.email}`}><Icon name="mail" size={18} /> {contact.email}</a> : null}
            {appUrl ? <a className="btn solid" href={appUrl}>Get the app</a> : null}
          </div>
        </div>
      </div>

      <main id="main" inert={open}>{children}</main>

      <footer className="foot" inert={open}>
        <div className="wrap foot-grid">
          <div className="foot-brand">
            {config.branding.logo_url ? <img src={config.branding.logo_url} alt="" width={56} height={56} loading="lazy" /> : null}
            <p className="foot-name">{name}</p>
            {s.tagline ? <p className="foot-tag">{s.tagline}</p> : null}
            {s.footer_text ? <p className="foot-text">{s.footer_text}</p> : null}
          </div>
          {site.nav.length ? (
            <nav aria-label="Footer">
              <h2 className="foot-h">Explore</h2>
              <ul role="list">
                {site.nav.map((n) => (
                  <li key={n.slug}><Link to={href(n.slug)}>{n.title}</Link></li>
                ))}
              </ul>
            </nav>
          ) : null}
          {contact.address || contact.hours ? (
            <div>
              <h2 className="foot-h">Visit</h2>
              {contact.address ? <p className="pre">{contact.address}</p> : null}
              {contact.hours ? <p className="pre muted-light">{contact.hours}</p> : null}
              {contact.map_url ? <p><A href={contact.map_url}>Get directions →</A></p> : null}
            </div>
          ) : null}
          <div>
            <h2 className="foot-h">Connect</h2>
            <ul role="list">
              {contact.phone ? <li><a href={tel(contact.phone)}>{contact.phone}</a></li> : null}
              {contact.email ? <li><a href={`mailto:${contact.email}`}>{contact.email}</a></li> : null}
              {wa ? <li><a href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a></li> : null}
              {apps.android ? <li><a href={apps.android}>Android app</a></li> : null}
              {apps.ios ? <li><a href={apps.ios}>iPhone app</a></li> : null}
            </ul>
            {socials.length ? (
              <div className="socials">
                {socials.map(([k, label]) => (
                  <a key={k} href={social[k]} target="_blank" rel="noopener noreferrer" aria-label={label}>
                    <Icon name={k} size={18} />
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="wrap foot-base">
          <span>© {new Date().getFullYear()} {name}</span>
        </div>
      </footer>
      {wa ? (
        <a className="wa-float" href={wa} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp" inert={open}>
          <Icon name="chat" size={24} />
        </a>
      ) : null}
    </>
  )
}
