import { useEffect, useRef, useState } from 'react'

interface Props {
  src: string
  alt: string
  /** A stock or borrowed picture: labelled so it is never taken for the client's own piece. */
  sample?: boolean
  className?: string
  /** Above the fold: load at once instead of lazily. */
  eager?: boolean
}

/**
 * A picture that copes with being missing or broken: both show a quiet placeholder panel
 * instead of a broken-image icon, so an unfinished page still looks intentional.
 */
export function Img({ src, alt, sample, className = '', eager }: Props) {
  const ref = useRef<HTMLImageElement>(null)
  const [failed, setFailed] = useState<string | null>(null)

  // A pre-rendered image can fail before React attaches its error handler.
  useEffect(() => {
    const img = ref.current
    if (img?.complete && img.naturalWidth === 0) setFailed(src)
  }, [src])

  const broken = !src || failed === src
  return (
    <div className={`media ${className}`}>
      {broken ? (
        <div className="media-ph" role={alt ? 'img' : undefined} aria-label={alt || undefined}>
          <span aria-hidden="true">✦</span>
          <small>{src ? 'Picture unavailable' : 'Picture coming soon'}</small>
        </div>
      ) : (
        <img
          ref={ref}
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={eager ? 'high' : undefined}
          onError={() => setFailed(src)}
        />
      )}
      {sample && !broken ? <span className="sample-tag">Sample image</span> : null}
    </div>
  )
}
