import { useEffect, useState } from 'react'

export type Loaded<T> = { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready'; data: T }

/**
 * Runs `load` when `key` changes (and every `every` ms, if given). Aborts the request on cleanup.
 * `initial` (pre-rendered data) shows at once; the request still runs to bring it up to date.
 */
export function useAsync<T>(
  load: (signal: AbortSignal) => Promise<T>,
  key: string,
  every?: number,
  initial?: T,
): Loaded<T> {
  const [state, setState] = useState<{ key: string; value: Loaded<T> }>({
    key,
    value: initial ? { status: 'ready', data: initial } : { status: 'loading' },
  })
  useEffect(() => {
    const ctl = new AbortController()
    const run = () =>
      load(ctl.signal).then(
        (data) => setState({ key, value: { status: 'ready', data } }),
        (error) => {
          if (!ctl.signal.aborted) setState((s) => (s.key === key && s.value.status === 'ready' ? s : { key, value: { status: 'error', error } }))
        },
      )
    run()
    const timer = every ? setInterval(run, every) : undefined
    return () => {
      ctl.abort()
      clearInterval(timer)
    }
    // `load` is a fresh closure each render; `key` says when it really changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, every])
  // A different key means a different request: show loading until it answers.
  if (state.key === key) return state.value
  return initial ? { status: 'ready', data: initial } : { status: 'loading' }
}
