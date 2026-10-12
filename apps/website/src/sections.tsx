import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api, type Section, type SectionOf, type Site } from './api/client'
import { useAsync } from './useAsync'

/** Internal links stay in the app; anything else is a normal link. */
function A({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  if (href.startsWith('/')) return <Link className={className} to={href}>{children}</Link>
  return <a className={className} href={href}>{children}</a>
}

// The API has already cleaned this HTML down to formatting tags and safe links.
const Html = ({ html }: { html: string }) => <div className="rich" dangerouslySetInnerHTML={{ __html: html }} />

function Block({ heading, children, tone }: { heading: string; children: ReactNode; tone?: string }) {
  return (
    <section className={`block ${tone ?? ''}`}>
      <div className="wrap">
        {heading ? <h2>{heading}</h2> : null}
        {children}
      </div>
    </section>
  )
}

function Hero({ s }: { s: SectionOf<'hero'> }) {
  return (
    <section className="hero" style={s.image_url ? { backgroundImage: `linear-gradient(#0008, #0008), url("${s.image_url}")` } : undefined}>
      <div className="wrap">
        {s.heading ? <h1>{s.heading}</h1> : null}
        {s.subheading ? <p>{s.subheading}</p> : null}
        {s.cta_label && s.cta_url ? <A className="btn" href={s.cta_url}>{s.cta_label}</A> : null}
      </div>
    </section>
  )
}

function Cards({ s }: { s: SectionOf<'features'> | SectionOf<'steps'> }) {
  const numbered = s.type === 'steps'
  return (
    <Block heading={s.heading}>
      <ul className={`cards ${numbered ? 'steps' : ''}`}>
        {s.items.map((it, i) => (
          <li key={i}>
            {numbered ? <span className="badge">{i + 1}</span> : it.icon ? <span className="badge" aria-hidden>{it.icon}</span> : null}
            {it.title ? <h3>{it.title}</h3> : null}
            {it.text ? <p>{it.text}</p> : null}
          </li>
        ))}
      </ul>
    </Block>
  )
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 })
const when = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

function GoldRate({ s }: { s: SectionOf<'gold_rate'> }) {
  const rate = useAsync((sig) => api.rate(sig), 'rate', 60_000)
  const r = rate.status === 'ready' ? rate.data : null
  return (
    <Block heading={s.heading || "Today's gold rate"} tone="tint">
      <div className="rate" aria-live="polite">
        {rate.status === 'loading' ? <span className="muted">Loading the rate…</span> : null}
        {rate.status === 'error' ? <span className="muted">The rate is not available right now.</span> : null}
        {r && r.rate_per_gram ? (
          <>
            <div className="rate-n">{inr.format(Number(r.rate_per_gram))}<small> / gram · {r.purity}</small></div>
            {r.updated_at ? <div className="muted">Updated {when.format(new Date(r.updated_at))}</div> : null}
          </>
        ) : null}
        {r && !r.rate_per_gram ? <span className="muted">Today's rate has not been published yet.</span> : null}
      </div>
      {s.note ? <p className="muted">{s.note}</p> : null}
    </Block>
  )
}

function Contact({ s, site }: { s: SectionOf<'contact'>; site: Site }) {
  const c = site.settings.contact
  const wa = c.whatsapp.replace(/\D/g, '')
  return (
    <Block heading={s.heading || 'Visit or contact us'}>
      <dl className="contact">
        {c.address ? <><dt>Address</dt><dd className="pre">{c.address}</dd></> : null}
        {c.hours ? <><dt>Hours</dt><dd>{c.hours}</dd></> : null}
        {c.phone ? <><dt>Phone</dt><dd><a href={`tel:${c.phone}`}>{c.phone}</a></dd></> : null}
        {wa ? <><dt>WhatsApp</dt><dd><a href={`https://wa.me/${wa}`}>{c.whatsapp}</a></dd></> : null}
        {c.email ? <><dt>Email</dt><dd><a href={`mailto:${c.email}`}>{c.email}</a></dd></> : null}
      </dl>
      {s.show_map && c.map_url ? <A className="btn" href={c.map_url}>Open in maps</A> : null}
    </Block>
  )
}

export function SectionView({ section: s, site }: { section: Section; site: Site }) {
  switch (s.type) {
    case 'hero':
      return <Hero s={s} />
    case 'rich_text':
      return <Block heading={s.heading}><Html html={s.body_html} /></Block>
    case 'image_text':
      return (
        <Block heading={s.heading}>
          <div className={`split ${s.image_side}`}>
            <Html html={s.body_html} />
            {s.image_url ? <img src={s.image_url} alt={s.heading} loading="lazy" /> : null}
          </div>
        </Block>
      )
    case 'features':
    case 'steps':
      return <Cards s={s} />
    case 'gold_rate':
      return <GoldRate s={s} />
    case 'faq':
      return (
        <Block heading={s.heading}>
          <div className="faq">
            {s.items.map((q, i) => (
              <details key={i}>
                <summary>{q.question}</summary>
                <p>{q.answer}</p>
              </details>
            ))}
          </div>
        </Block>
      )
    case 'gallery':
      return (
        <Block heading={s.heading}>
          <ul className="gallery">
            {s.images.map((im, i) => (
              <li key={i}>
                <img src={im.url} alt={im.caption} loading="lazy" />
                {im.caption ? <span>{im.caption}</span> : null}
              </li>
            ))}
          </ul>
        </Block>
      )
    case 'cta':
      return (
        <Block heading={s.heading} tone="accent">
          {s.text ? <p>{s.text}</p> : null}
          {s.button_label && s.button_url ? <A className="btn light" href={s.button_url}>{s.button_label}</A> : null}
        </Block>
      )
    case 'contact':
      return <Contact s={s} site={site} />
  }
}
