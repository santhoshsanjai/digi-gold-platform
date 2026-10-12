import { useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import type { Site, SiteConfig } from './api/client'

export function Layout({ config, site, children }: { config: SiteConfig; site: Site; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const name = site.settings.site_title || config.branding.display_name || config.name
  const { contact, social, app_links: apps } = site.settings
  const socials = [
    ['Facebook', social.facebook],
    ['Instagram', social.instagram],
    ['YouTube', social.youtube],
    ['X', social.x],
  ].filter(([, url]) => url)
  const close = () => setOpen(false)

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="bar">
        <div className="wrap bar-in">
          <Link to="/" className="brand" onClick={close}>
            {config.branding.logo_url ? <img src={config.branding.logo_url} alt="" /> : null}
            <span>{name}</span>
          </Link>
          <button className="menu" aria-expanded={open} aria-controls="nav" onClick={() => setOpen(!open)}>
            {open ? 'Close' : 'Menu'}
          </button>
          <nav id="nav" aria-label="Main" className={open ? 'open' : ''}>
            {site.nav.map((n) => (
              <NavLink key={n.slug} to={n.slug === 'home' ? '/' : `/${n.slug}`} end onClick={close}>
                {n.title}
              </NavLink>
            ))}
            {apps.android || apps.ios ? (
              <a className="btn small" href={apps.android || apps.ios}>
                Get the app
              </a>
            ) : null}
          </nav>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="foot">
        <div className="wrap foot-in">
          <div>
            <strong>{name}</strong>
            {site.settings.tagline ? <p>{site.settings.tagline}</p> : null}
            {site.settings.footer_text ? <p className="muted">{site.settings.footer_text}</p> : null}
          </div>
          <div>
            {contact.phone ? <p><a href={`tel:${contact.phone}`}>{contact.phone}</a></p> : null}
            {contact.email ? <p><a href={`mailto:${contact.email}`}>{contact.email}</a></p> : null}
            {contact.address ? <p className="pre">{contact.address}</p> : null}
          </div>
          <div>
            {socials.map(([label, url]) => (
              <p key={label}>
                <a href={url} rel="noopener noreferrer" target="_blank">{label}</a>
              </p>
            ))}
            {apps.android ? <p><a href={apps.android}>Android app</a></p> : null}
            {apps.ios ? <p><a href={apps.ios}>iPhone app</a></p> : null}
          </div>
        </div>
      </footer>
    </>
  )
}
