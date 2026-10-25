import { API_URL } from '../config'
import { getItem, removeItem, setItem } from '../storage'
import type { Tokens } from './types'

/** Only the refresh token is kept on the phone (keychain / keystore); the access token lives
 * in memory and is fetched again with it after a restart. */
const REFRESH_KEY = 'dg.refresh'
/** Refresh this many ms before the access token's expiry, so requests rarely meet a 401. */
const EARLY_MS = 30_000

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Machine-readable reason from the API, such as `pan_required` or `email_taken`. */
    readonly code?: string,
  ) {
    super(message)
  }
}

let accessToken: string | null = null
let accessExpiresAt = 0
let onSessionLost: () => void = () => {}
let refreshing: Promise<boolean> | null = null

/** Called once when the refresh token is rejected, so the app can return to sign-in. */
export const setSessionLostHandler = (fn: () => void) => {
  onSessionLost = fn
}

export async function storeTokens(tokens: Pick<Tokens, 'access_token' | 'refresh_token' | 'expires_in'>) {
  accessToken = tokens.access_token
  accessExpiresAt = Date.now() + tokens.expires_in * 1000
  await setItem(REFRESH_KEY, tokens.refresh_token)
}

export async function clearTokens() {
  accessToken = null
  accessExpiresAt = 0
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

/**
 * Exchanges the refresh token for a new pair. Concurrent callers share one request, because
 * the API rotates refresh tokens and a second use of the old one would end the session.
 *
 * Resolves `true` when a session is still usable (including when the phone is offline, so a
 * dropped connection never signs anyone out), `false` once the API has rejected the token.
 */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    const token = await getItem(REFRESH_KEY)
    if (!token) return false
    const res = await send('/app/auth/refresh', 'POST', { refresh_token: token }, false).catch(
      () => null,
    )
    if (!res) return true
    if (res.status === 401) {
      await clearTokens()
      return false
    }
    if (!res.ok) return true // A server hiccup is not a reason to sign out.
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
  if (res.status >= 500) detail = 'Something went wrong on our side. Please try again.'
  detail = detail.charAt(0).toUpperCase() + detail.slice(1)
  return new ApiError(detail, res.status, code)
}

interface Options {
  method?: 'GET' | 'POST' | 'PATCH'
  body?: unknown
  /** Public endpoints and sign-in send no token and never trigger a refresh. */
  auth?: boolean
}

/**
 * Calls the API. Authenticated calls refresh an expired access token first, and a 401 is
 * refreshed and retried exactly once: the API rejects a stale token before doing any work,
 * so the retry cannot repeat a payment or other change.
 */
export async function api<T>(path: string, { method = 'GET', body, auth = true }: Options = {}): Promise<T> {
  if (auth && (!accessToken || Date.now() > accessExpiresAt - EARLY_MS)) {
    await refreshSession()
  }
  let res = await send(path, method, body, auth)
  if (res.status === 401 && auth) {
    if (await refreshSession()) res = await send(path, method, body, auth)
    if (res.status === 401) onSessionLost()
  }
  if (!res.ok) throw await toError(res)
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}
