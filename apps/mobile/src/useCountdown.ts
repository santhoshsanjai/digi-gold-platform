import { useEffect, useState } from 'react'

/** Whole seconds left until `iso`, ticking every second; 0 once it has passed. */
export function useCountdown(iso: string | undefined): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!iso) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [iso])
  return iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 1000)) : 0
}

export const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
