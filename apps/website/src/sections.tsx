import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api, type Section, type SectionOf, type Site } from './api/client'
import { Icon } from './ui/Icon'
import { Img } from './ui/Img'
import { telLink, waLink } from './ui/links'
import { useAsync } from './useAsync'

/** Internal links stay in the app; anything else is a normal link (new tab for other sites). */
export function A({ href, className, children, label }: { href: string; className?: string; children: ReactNode; label?: string }) {
  if (href.startsWith('/')) return <Link className={className} to={href} aria-label={label}>{children}</Link>
  const external = /^https?:/.test(href)
  return (
    <a className={className} href={href} aria-label={label} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {children}
    </a>
  )
}

// The API has already cleaned this HTML down to formatting tags and safe links.
const Html = ({ html }: { html: string }) => <div className="rich" dangerouslySetInnerHTML={{ __html: html }} />

/** Eyebrow, heading and an optional introduction, with the hairline ornament. */
function Head({ eyebrow, heading, intro, align = 'center' }: { eyebrow?: string; heading: string; intro?: string; align?: 'center' | 'start' }) {
  if (!eyebrow && !heading && !intro) return null
  return (
    <header className={`sec-head ${align}`} data-reveal>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      {heading ? <h2>{heading}</h2> : null}
      {align === 'center' && heading ? <span className="ornament" aria-hidden="true" /> : null}
      {intro ? <p className="lede">{intro}</p> : null}
    </header>
  )
}

function Block({ children, tone, narrow, id }: { children: ReactNode; tone?: 'tint' | 'dark'; narrow?: boolean; id?: string }) {
  return (
    <section className={`block ${tone ?? ''}`} id={id}>
      <div className={narrow ? 'wrap narrow' : 'wrap'}>{children}</div>
    </section>
  )
}

function Button({ href, children, variant = 'solid' }: { href: string; children: ReactNode; variant?: 'solid' | 'ghost' | 'light' | 'line' }) {
  return (
    <A className={`btn ${variant}`} href={href}>
      <span>{children}</span>
      <Icon name="arrow" size={16} />
    </A>
  )
}

function Hero({ s }: { s: SectionOf<'hero'> }) {
  const compact = s.size === 'compact'
  const pictured = Boolean(s.image_url)
  return (
    <section className={`hero ${compact ? 'compact' : 'full'} ${pictured ? 'pictured' : 'plain'}`}>
      {pictured ? <Img className="hero-bg" src={s.image_url} alt={s.image_alt} sample={s.sample_image} eager /> : null}
      <div className="wrap hero-in">
        <div className="hero-copy">
          {s.eyebrow ? <p className="eyebrow">{s.eyebrow}</p> : null}
          {s.heading ? <h1>{s.heading}</h1> : null}
          {s.subheading ? <p className="hero-sub">{s.subheading}</p> : null}
          {(s.cta_label && s.cta_url) || (s.cta2_label && s.cta2_url) ? (
            <div className="actions">
              {s.cta_label && s.cta_url ? <Button href={s.cta_url}>{s.cta_label}</Button> : null}
              {s.cta2_label && s.cta2_url ? (
                <Button href={s.cta2_url} variant={pictured ? 'light' : 'line'}>{s.cta2_label}</Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function ImageText({ s }: { s: SectionOf<'image_text'> }) {
  return (
    <Block>
      <div className={`split ${s.image_side}`}>
        <div className="split-copy" data-reveal>
          {s.eyebrow ? <p className="eyebrow">{s.eyebrow}</p> : null}
          {s.heading ? <h2>{s.heading}</h2> : null}
          <Html html={s.body_html} />
          {s.cta_label && s.cta_url ? <div className="actions"><Button href={s.cta_url} variant="line">{s.cta_label}</Button></div> : null}
        </div>
        <div className="split-media" data-reveal>
          <Img className="framed" src={s.image_url} alt={s.image_alt || s.heading} sample={s.sample_image} />
        </div>
      </div>
    </Block>
  )
}

type Card = SectionOf<'categories'>['items'][number]

function CardLink({ card, className, children }: { card: Card; className: string; children: ReactNode }) {
  return card.link_url ? <A className={className} href={card.link_url}>{children}</A> : <div className={className}>{children}</div>
}

function Categories({ s }: { s: SectionOf<'categories'> }) {
  if (!s.items.length) return null
  return (
    <Block>
      <Head eyebrow={s.eyebrow} heading={s.heading} intro={s.intro} />
      <ul className="tiles" role="list">
        {s.items.map((c, i) => (
          <li key={i} data-reveal style={{ '--i': i % 4 } as CSSProperties}>
            <CardLink card={c} className="tile">
              <Img src={c.image_url} alt={c.image_alt || c.title} sample={c.sample_image} />
              <span className="tile-body">
                <span className="tile-title">{c.title}</span>
                {c.text ? <span className="tile-text">{c.text}</span> : null}
                {c.link_url ? (
                  <span className="tile-link">
                    {c.link_label || 'Explore'} <Icon name="arrow" size={14} />
                  </span>
                ) : null}
              </span>
            </CardLink>
          </li>
        ))}
      </ul>
    </Block>
  )
}

function Collections({ s }: { s: SectionOf<'collections'> }) {
  if (!s.items.length) return null
  return (
    <Block tone="tint">
      <Head eyebrow={s.eyebrow} heading={s.heading} intro={s.intro} />
      <ol className="editorial" role="list">
        {s.items.map((c, i) => (
          <li key={i} className={i % 2 ? 'flip' : ''}>
            <div className="ed-media" data-reveal>
              <Img src={c.image_url} alt={c.image_alt || c.title} sample={c.sample_image} />
            </div>
            <div className="ed-copy" data-reveal>
              <span className="ed-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <h3>{c.title}</h3>
              {c.text ? <p>{c.text}</p> : null}
              {c.link_url ? <Button href={c.link_url} variant="line">{c.link_label || 'Discover the collection'}</Button> : null}
            </div>
          </li>
        ))}
      </ol>
    </Block>
  )
}

function Features({ s }: { s: SectionOf<'features'> | SectionOf<'steps'> }) {
  const numbered = s.type === 'steps'
  if (!s.items.length) return null
  return (
    <Block>
      <Head eyebrow={s.eyebrow} heading={s.heading} />
      <ul className={`points ${numbered ? 'steps' : ''}`} role="list">
        {s.items.map((it, i) => (
          <li key={i} data-reveal style={{ '--i': i % 4 } as CSSProperties}>
            {numbered ? (
              <span className="point-mark num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
            ) : (
              <span className="point-mark"><Icon name={it.icon} fallback="sparkles" size={26} /></span>
            )}
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
    <Block tone="tint" narrow>
      <div className="rate-card" data-reveal>
        <p className="eyebrow">{s.eyebrow || 'Live from the store'}</p>
        <h2>{s.heading || "Today's gold rate"}</h2>
        <div className="rate" aria-live="polite">
          {rate.status === 'loading' ? <span className="skeleton-line" aria-label="Loading the rate" /> : null}
          {rate.status === 'error' ? <span className="muted">The rate is not available right now.</span> : null}
          {r && r.rate_per_gram ? (
            <>
              <div className="rate-n">{inr.format(Number(r.rate_per_gram))}<small> / gram · {r.purity}</small></div>
              {r.updated_at ? <div className="muted small">Updated {when.format(new Date(r.updated_at))}</div> : null}
            </>
          ) : null}
          {r && !r.rate_per_gram ? <span className="muted">Today's rate has not been published yet.</span> : null}
        </div>
        {s.note ? <p className="muted small">{s.note}</p> : null}
      </div>
    </Block>
  )
}

function Faq({ s }: { s: SectionOf<'faq'> }) {
  if (!s.items.length) return null
  return (
    <Block narrow>
      <Head eyebrow={s.eyebrow} heading={s.heading} />
      <div className="faq" data-reveal>
        {s.items.map((q, i) => (
          <details key={i}>
            <summary>{q.question}</summary>
            <p>{q.answer}</p>
          </details>
        ))}
      </div>
    </Block>
  )
}

function Gallery({ s }: { s: SectionOf<'gallery'> }) {
  const [open, setOpen] = useState<number | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const images = s.images
  const count = images.length

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open !== null && !d.open) d.showModal()
    if (open === null && d.open) d.close()
  }, [open])

  if (!count) return null
  const step = (by: number) => setOpen((i) => (i === null ? i : (i + by + count) % count))
  const current = open === null ? null : images[open]

  return (
    <Block>
      <Head eyebrow={s.eyebrow} heading={s.heading} />
      <ul className="gallery" role="list">
        {images.map((im, i) => (
          <li key={i} data-reveal style={{ '--i': i % 4 } as CSSProperties}>
            <button type="button" className="gallery-item" onClick={() => setOpen(i)} aria-label={`View larger: ${im.caption || `picture ${i + 1}`}`}>
              <Img src={im.url} alt={im.caption} sample={im.sample} />
            </button>
            {im.caption ? <p className="caption">{im.caption}</p> : null}
          </li>
        ))}
      </ul>
      <dialog
        ref={dialog}
        className="lightbox"
        aria-label={current?.caption || 'Picture'}
        onClose={() => setOpen(null)}
        onClick={(e) => e.target === e.currentTarget && setOpen(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') step(1)
          if (e.key === 'ArrowLeft') step(-1)
        }}
      >
        <button type="button" className="lb-btn lb-close" onClick={() => setOpen(null)} aria-label="Close">
          <Icon name="close" size={22} />
        </button>
        {current ? (
          <figure>
            <img src={current.url} alt={current.caption} />
            <figcaption>
              {current.caption}
              {current.sample ? <span className="sample-inline">Sample image</span> : null}
              <span className="muted"> {open! + 1} / {count}</span>
            </figcaption>
          </figure>
        ) : null}
        {count > 1 ? (
          <>
            <button type="button" className="lb-btn lb-prev" onClick={() => step(-1)} aria-label="Previous picture">
              <Icon name="left" size={22} />
            </button>
            <button type="button" className="lb-btn lb-next" onClick={() => step(1)} aria-label="Next picture">
              <Icon name="right" size={22} />
            </button>
          </>
        ) : null}
      </dialog>
    </Block>
  )
}

function Cta({ s }: { s: SectionOf<'cta'> }) {
  return (
    <Block tone="dark" narrow>
      <div className="cta" data-reveal>
        {s.eyebrow ? <p className="eyebrow">{s.eyebrow}</p> : null}
        {s.heading ? <h2>{s.heading}</h2> : null}
        <span className="ornament" aria-hidden="true" />
        {s.text ? <p className="lede">{s.text}</p> : null}
        {s.button_label && s.button_url ? <div className="actions center"><Button href={s.button_url}>{s.button_label}</Button></div> : null}
      </div>
    </Block>
  )
}

function Contact({ s, site }: { s: SectionOf<'contact'>; site: Site }) {
  const c = site.settings.contact
  const wa = waLink(c.whatsapp)
  const map = s.show_map ? c.map_embed_url : ''
  const rows: [string, string, ReactNode][] = [
    ['pin', 'Address', c.address ? <span className="pre">{c.address}</span> : null],
    ['clock', 'Opening hours', c.hours ? <span className="pre">{c.hours}</span> : null],
    ['phone', 'Phone', c.phone ? <a href={telLink(c.phone)}>{c.phone}</a> : null],
    ['chat', 'WhatsApp', wa ? <a href={wa} target="_blank" rel="noopener noreferrer">{c.whatsapp}</a> : null],
    ['mail', 'Email', c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : null],
  ]
  const shown = rows.filter(([, , v]) => v)
  return (
    <Block>
      <div className={`visit ${map ? 'with-map' : ''}`}>
        <div className="visit-copy" data-reveal>
          <p className="eyebrow">{s.eyebrow || 'Visit the store'}</p>
          <h2>{s.heading || 'Visit or contact us'}</h2>
          {shown.length ? (
            <dl className="contact">
              {shown.map(([icon, label, value]) => (
                <div key={label}>
                  <dt><Icon name={icon} size={18} /> {label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="muted">Contact details will appear here soon.</p>
          )}
          {(s.show_map && c.map_url) || c.phone ? (
            <div className="actions">
              {s.show_map && c.map_url ? <Button href={c.map_url}>Get directions</Button> : null}
              {c.phone ? <Button href={telLink(c.phone)} variant="line">Call the store</Button> : null}
            </div>
          ) : null}
        </div>
        {map ? (
          <div className="visit-map" data-reveal>
            <iframe src={map} title="Map showing the store" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
          </div>
        ) : null}
      </div>
    </Block>
  )
}

export function SectionView({ section: s, site }: { section: Section; site: Site }) {
  switch (s.type) {
    case 'hero':
      return <Hero s={s} />
    case 'rich_text':
      return (
        <Block narrow>
          <Head eyebrow={s.eyebrow} heading={s.heading} align="start" />
          <div data-reveal><Html html={s.body_html} /></div>
        </Block>
      )
    case 'image_text':
      return <ImageText s={s} />
    case 'categories':
      return <Categories s={s} />
    case 'collections':
      return <Collections s={s} />
    case 'features':
    case 'steps':
      return <Features s={s} />
    case 'gold_rate':
      return <GoldRate s={s} />
    case 'faq':
      return <Faq s={s} />
    case 'gallery':
      return <Gallery s={s} />
    case 'cta':
      return <Cta s={s} />
    case 'contact':
      return <Contact s={s} site={site} />
    default:
      // A section type this build does not know yet (the API is newer): skip it.
      return null
  }
}
