/** Line icons drawn for this site (24px grid, 1.5 stroke). Names match the Console's icon list. */
const PATHS: Record<string, string> = {
  // Highlight icons the Console offers
  coins:
    'M9 4.5c3.3 0 6 1.3 6 3s-2.7 3-6 3-6-1.3-6-3 2.7-3 6-3zM3 7.5v4c0 1.7 2.7 3 6 3M3 11.5v4c0 1.7 2.7 3 6 3 .8 0 1.6-.1 2.3-.2M15 10.5c3.3 0 6 1.3 6 3s-2.7 3-6 3-6-1.3-6-3 2.7-3 6-3zM9 13.5v4c0 1.7 2.7 3 6 3s6-1.3 6-3v-4',
  'shield-check': 'M12 3l7 3v5.5c0 4.3-2.9 7.9-7 9.5-4.1-1.6-7-5.2-7-9.5V6zM9 12l2.2 2.2L15.5 10',
  store: 'M3.5 9.5L5 4h14l1.5 5.5M3.5 9.5h17M5 9.5V20h14V9.5M10 20v-5.5h4V20',
  smartphone: 'M8.5 2.5h7a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 20V4a1.5 1.5 0 0 1 1.5-1.5zM11 18h2',
  gift: 'M3.5 8h17v4h-17zM5 12v8.5h14V12M12 8v12.5M12 8C10.5 5 7 4 7 6.5 7 8 10 8 12 8zM12 8c1.5-3 5-4 5-1.5C17 8 14 8 12 8z',
  clock: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 7.5V12l3 2',
  'badge-percent': 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM9 15l6-6M9.5 9.5h.01M14.5 14.5h.01',
  gem: 'M7 3.5h10l3.5 5.5L12 20.5 3.5 9zM3.5 9h17M12 20.5L8.5 9 12 3.5 15.5 9z',
  wallet: 'M4.5 6.5h15A1.5 1.5 0 0 1 21 8v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19V8a1.5 1.5 0 0 1 1.5-1.5zM3 10.5h18M16 15.5h2M5 6.5l10-3v3',
  sparkles: 'M11 3l1.7 5.3L18 10l-5.3 1.7L11 17l-1.7-5.3L4 10l5.3-1.7zM18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
  // Interface
  menu: 'M4 7h16M4 12h16M4 17h10',
  close: 'M6 6l12 12M18 6L6 18',
  arrow: 'M4 12h15M14 7l5 5-5 5',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  phone: 'M5 3.5h3.5l1.7 4.3-2.2 1.4a11 11 0 0 0 6.8 6.8l1.4-2.2 4.3 1.7V19a1.5 1.5 0 0 1-1.5 1.5A16.5 16.5 0 0 1 3.5 5 1.5 1.5 0 0 1 5 3.5z',
  mail: 'M3.5 5.5h17v13h-17zM3.5 6l8.5 7 8.5-7',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 7a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z',
  chat: 'M4 20l1.3-4A8 8 0 1 1 8 18.7zM9 10.5h.01M12 10.5h.01M15 10.5h.01',
  instagram: 'M7.5 3h9A4.5 4.5 0 0 1 21 7.5v9a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 16.5v-9A4.5 4.5 0 0 1 7.5 3zM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM17.3 6.7h.01',
  facebook: 'M14.5 21v-7.5H17l.5-3h-3V8.8c0-.9.4-1.5 1.6-1.5h1.5V4.6c-.3 0-1.2-.1-2.3-.1-2.4 0-3.8 1.4-3.8 4v2h-2.5v3H11.5V21',
  youtube: 'M6.5 5.5h11a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4h-11a4 4 0 0 1-4-4v-5a4 4 0 0 1 4-4zM10 9.5v5l4.5-2.5z',
  x: 'M4 4h4.5L20 20h-4.5zM19.5 4l-6.4 7M4.5 20l6.4-7',
}

/** `fallback` is drawn when `name` is empty or unknown (content from the CMS may be either). */
export function Icon({ name, size = 20, className, fallback }: { name: string; size?: number; className?: string; fallback?: string }) {
  const d = PATHS[name] ?? (fallback ? PATHS[fallback] : undefined)
  if (!d) return null
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  )
}
