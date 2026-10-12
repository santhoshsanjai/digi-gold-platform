import type { Dispatch } from '@reduxjs/toolkit'
import type { TokensOut } from '../api/types.ts'
import { API_BASE_URL } from '../config/tenant.ts'
import { refreshTokenStore, signedIn, signedOut } from './authSlice.ts'

let inFlight: Promise<boolean> | null = null

/** Run fn while holding a lock shared by every tab of this site, where supported. */
function withTabLock<T>(fn: () => Promise<T>): Promise<T> {
  return navigator.locks ? navigator.locks.request('dg.crm.refresh', fn) : fn()
}

async function exchange(dispatch: Dispatch): Promise<boolean> {
  // Read the token inside the lock: another tab may have just rotated it, and sending
  // the old one would look like a stolen token and sign the user out everywhere.
  const refreshToken = refreshTokenStore.get()
  if (!refreshToken) {
    dispatch(signedOut())
    return false
  }
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) {
      dispatch(signedOut())
      return false
    }
    const tokens = (await res.json()) as TokensOut
    dispatch(signedIn({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token }))
    return true
  } catch {
    // Offline: keep the saved token so the next attempt can still succeed.
    return false
  }
}

/**
 * Swap the saved refresh token for a new access token. Requests that fail together
 * share one exchange, and tabs take turns.
 */
export function refreshSession(dispatch: Dispatch): Promise<boolean> {
  inFlight ??= withTabLock(() => exchange(dispatch)).finally(() => {
    inFlight = null
  })
  return inFlight
}
