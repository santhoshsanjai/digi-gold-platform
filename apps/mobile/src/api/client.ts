import { API_URL } from '../config'
import { getItem, removeItem, setItem } from '../storage'
import type { Tokens } from './types'

const REFRESH_KEY = 'dg.refresh'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Machine-readable reason from the API, such as `pan_required` or `buying_closed`. */
    readonly code?: string,
  ) {
    super(message)
  }
}

let accessToken: string | null = null
let onSessionLost: () => void = () => {}
let refreshing: Promise<boolean> | null = null

export const setSessionLostHandler = (fn: () => void) => {
  onSessionLost = fn
}

export async function storeTokens(tokens: Tokens) {
  accessToken = tokens.access_token
  await setItem(REFRESH_KEY, tokens.refresh_token)
}

export async function clearTokens() {
  accessToken = null
  await removeItem(REFRESH_KEY)
}

export const storedRefreshToken = () => getItem(REFRESH_KEY)

async function send(path: string, method: string, body: unknown, auth: boolean) {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`
  try {
    return await fetch(API_URL + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('No connection. Check your internet and try again.', 0, 'offline')
  }
}

/** Exchanges the refresh token. Concurrent callers share one request, because tokens rotate. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    const token = await getItem(REFRESH_KEY)
    if (!token) return false
    const res = await send('/app/auth/refresh', 'POST', { refresh_token: token }, false).catch(
      () => null,
    )
    if (!res) return true // Offline: keep the session and try again later.
    if (!res.ok) {
      await clearTokens()
      return false
    }
    await storeTokens((await res.json()) as Tokens)
    return true
  })().finally(() => {
    refreshing = null
  })
  return refreshing
}

async function toError(res: Response): Promise<ApiError> {
  let detail = 'Something went wrong. Please try again.'
  let code: string | undefined
  try {
    const j = await res.json()
    if (typeof j.detail === 'string') detail = j.detail
    else if (Array.isArray(j.detail) && j.detail[0]?.msg) {
      detail = String(j.detail[0].msg).replace(/^Value error, /, '')
    }
    code = j.code
  } catch {
    // Not JSON: keep the default message.
  }
  return new ApiError(detail, res.status, code)
}

interface Options {
  method?: 'GET' | 'POST' | 'PATCH'
  body?: unknown
  /** Public endpoints and sign-in send no token and never trigger a refresh. */
  auth?: boolean
}

export async function api<T>(path: string, { method = 'GET', body, auth = true }: Options = {}): Promise<T> {
  let res = await send(path, method, body, auth)
  if (res.status === 401 && auth) {
    if (await refreshSession()) res = await send(path, method, body, auth)
    if (res.status === 401) {
      onSessionLost()
    }
  }
  if (!res.ok) throw await toError(res)
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}
