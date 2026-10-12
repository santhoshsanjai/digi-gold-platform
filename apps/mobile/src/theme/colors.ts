import type { Branding } from '../api/types'

export interface Colors {
  primary: string
  onPrimary: string
  /** Soft tint of the primary colour, for highlights. */
  primarySoft: string
  bg: string
  surface: string
  text: string
  muted: string
  line: string
  header: string
  onHeader: string
  success: string
  successSoft: string
  warning: string
  warningSoft: string
  danger: string
  dangerSoft: string
}

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))

function rgb(hex: string): [number, number, number] {
  const h = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '000000'
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

const toHex = ([r, g, b]: number[]) => '#' + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')

/** Mixes `hex` towards `into` by `amount` (0 to 1). */
export function mix(hex: string, into: string, amount: number): string {
  const a = rgb(hex)
  const b = rgb(into)
  return toHex(a.map((v, i) => v + (b[i] - v) * amount))
}

function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Black or white, whichever reads better on `hex`. */
export const readableOn = (hex: string) => (luminance(hex) > 0.4 ? '#111827' : '#ffffff')

/** The client's colours, with surfaces, text and status colours derived so contrast holds. */
export function buildColors(b: Branding, dark: boolean): Colors {
  const primary = dark ? mix(b.primary_color, '#ffffff', 0.15) : b.primary_color
  const status = dark
    ? { success: '#7fcf9b', warning: '#e9be5c', danger: '#f08a82' }
    : { success: '#1f7a45', warning: '#8a5a00', danger: '#b42318' }
  const bg = dark ? '#0f1115' : b.background_color
  const surface = dark ? '#181b21' : mix(b.background_color, '#ffffff', 0.7)
  const header = dark ? '#181b21' : b.secondary_color
  return {
    primary,
    onPrimary: readableOn(primary),
    primarySoft: mix(primary, dark ? '#0f1115' : '#ffffff', dark ? 0.75 : 0.88),
    bg,
    surface,
    text: dark ? '#f1efe9' : mix(b.secondary_color, '#000000', 0.2),
    muted: dark ? '#a4a09a' : '#6b7280',
    line: dark ? '#2a2e36' : mix(b.background_color, '#000000', 0.1),
    header,
    onHeader: readableOn(header),
    ...status,
    successSoft: dark ? '#173325' : '#e4f3ea',
    warningSoft: dark ? '#3a2f12' : '#fbefd2',
    dangerSoft: dark ? '#3b1c19' : '#fde8e6',
  }
}
