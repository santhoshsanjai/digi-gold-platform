import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, ApiError, clearTokens, refreshSession, setSessionLostHandler, storedRefreshToken, storeTokens } from '../api/client'
import type { Me, Tokens } from '../api/types'
import { TENANT_SLUG } from '../config'
import { normaliseEmail } from './validation'

/**
 * The one place that knows whether someone is signed in. Navigation guards, screens and the
 * API client all follow `status`:
 *
 * - initializing: restoring a saved session at launch; nothing protected is drawn yet.
 * - signedOut: the landing and sign-in screens.
 * - passwordChange: signed in with an emailed temporary password. Only the change-password
 *   screen is reachable, and the API refuses every session until it is done. The token for
 *   that step is kept in memory only, so restarting the app returns to sign-in.
 * - signedIn: the app.
 */
export type AuthStatus = 'initializing' | 'signedOut' | 'passwordChange' | 'signedIn'

export interface Notice {
  tone: 'success' | 'warning'
  text: string
}

export interface Registration {
  name: string
  email: string
  phone: string
  password: string
}

type LoginOut = Tokens | { status: 'password_change_required'; password_change_token: string }

interface Auth {
  status: AuthStatus
  /** A message for the sign-in screen, such as "your session has expired". */
  notice: Notice | null
  clearNotice: () => void
  /** The email to prefill on sign-in after registering or resetting a password. */
  lastEmail: string
  signIn: (email: string, password: string) => Promise<void>
  /** For the SMS-code sign-in, which returns tokens directly. */
  signInWithTokens: (tokens: Tokens) => Promise<void>
  startRegistration: (r: Registration) => Promise<void>
  pendingRegistration: () => Registration | null
  resendRegistrationCode: () => Promise<void>
  completeRegistration: (code: string) => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  completePasswordChange: (newPassword: string) => Promise<void>
  cancelPasswordChange: () => void
  changePassword: (currentPassword: string | null, newPassword: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<Auth | null>(null)

export function useAuth(): Auth {
  const a = useContext(AuthContext)
  if (!a) throw new Error('useAuth outside AuthProvider')
  return a
}

const EXPIRED: Notice = { tone: 'warning', text: 'Your session has expired. Please sign in again.' }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('initializing')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [lastEmail, setLastEmail] = useState('')
  const qc = useQueryClient()
  // Held in memory only: never written to storage.
  const changeToken = useRef<string | null>(null)
  const registration = useRef<Registration | null>(null)

  const endSession = useCallback(
    (why: Notice | null) => {
      changeToken.current = null
      qc.clear() // drop the previous customer's balances and history
      setNotice(why)
      setStatus('signedOut')
    },
    [qc],
  )

  const begin = useCallback(
    async (tokens: Tokens) => {
      await storeTokens(tokens)
      // Load the profile before the app is shown, so the first screen has data.
      await qc.prefetchQuery({ queryKey: ['me'], queryFn: () => api<Me>('/app/me') })
      setNotice(null)
      setStatus('signedIn')
    },
    [qc],
  )

  useEffect(() => {
    setSessionLostHandler(() => {
      void clearTokens().then(() => endSession(EXPIRED))
    })
    let live = true
    ;(async () => {
      const had = !!(await storedRefreshToken())
      const ok = had && (await refreshSession())
      if (ok) await qc.prefetchQuery({ queryKey: ['me'], queryFn: () => api<Me>('/app/me') })
      if (!live) return
      if (had && !ok) setNotice(EXPIRED)
      setStatus(ok ? 'signedIn' : 'signedOut')
    })()
    return () => {
      live = false
    }
  }, [endSession, qc])

  const value = useMemo<Auth>(
    () => ({
      status,
      notice,
      lastEmail,
      clearNotice: () => setNotice(null),

      signIn: async (email, password) => {
        const out = await api<LoginOut>('/app/auth/login', {
          method: 'POST',
          auth: false,
          body: { tenant: TENANT_SLUG, email: normaliseEmail(email), password },
        })
        setLastEmail(normaliseEmail(email))
        if (out.status === 'password_change_required') {
          changeToken.current = out.password_change_token
          setNotice(null)
          setStatus('passwordChange')
          return
        }
        await begin(out)
      },

      signInWithTokens: begin,

      startRegistration: async (r) => {
        const body = { ...r, email: normaliseEmail(r.email), name: r.name.trim() }
        await api('/app/auth/register/otp', { method: 'POST', auth: false, body: { tenant: TENANT_SLUG, ...body } })
        registration.current = body
      },

      pendingRegistration: () => registration.current,

      resendRegistrationCode: async () => {
        const r = registration.current
        if (!r) throw new ApiError('Start again from the sign-up form.', 0)
        await api('/app/auth/register/otp', { method: 'POST', auth: false, body: { tenant: TENANT_SLUG, ...r } })
      },

      completeRegistration: async (code) => {
        const r = registration.current
        if (!r) throw new ApiError('Start again from the sign-up form.', 0)
        await api('/app/auth/register', { method: 'POST', auth: false, body: { tenant: TENANT_SLUG, ...r, code } })
        registration.current = null
        setLastEmail(r.email)
        setNotice({ tone: 'success', text: 'Your account is ready. Sign in with your email and password.' })
      },

      requestPasswordReset: async (email) => {
        await api('/app/auth/forgot-password', {
          method: 'POST',
          auth: false,
          body: { tenant: TENANT_SLUG, email: normaliseEmail(email) },
        })
        setLastEmail(normaliseEmail(email))
      },

      completePasswordChange: async (newPassword) => {
        const token = changeToken.current
        if (!token) {
          endSession(EXPIRED)
          return
        }
        try {
          await api('/app/auth/set-password', {
            method: 'POST',
            auth: false,
            body: { password_change_token: token, new_password: newPassword },
          })
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) {
            endSession({ tone: 'warning', text: 'That took too long. Sign in with your temporary password again.' })
            return
          }
          throw e
        }
        endSession({ tone: 'success', text: 'Password updated. Sign in with your new password.' })
      },

      cancelPasswordChange: () => endSession(null),

      changePassword: async (currentPassword, newPassword) => {
        const tokens = await api<Tokens>('/app/auth/change-password', {
          method: 'POST',
          body: { current_password: currentPassword, new_password: newPassword },
        })
        await storeTokens(tokens) // other devices are signed out; this one carries on
        await qc.invalidateQueries({ queryKey: ['me'] })
      },

      signOut: async () => {
        const refresh_token = await storedRefreshToken()
        if (refresh_token) {
          // Best effort: the session ends on this phone even if the API can't be reached.
          await api('/app/auth/logout', { method: 'POST', body: { refresh_token }, auth: false }).catch(() => {})
        }
        await clearTokens()
        endSession(null)
      },
    }),
    [status, notice, lastEmail, begin, endSession, qc],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Friendlier wording for the API's auth errors; anything else keeps the API's message. */
export function authMessage(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!(e instanceof ApiError)) return fallback
  switch (e.code) {
    case 'invalid_login':
      return 'The email or password is incorrect.'
    case 'locked':
      return 'Too many attempts. Wait a few minutes, then try again.'
    case 'account_disabled':
      return 'This account has been disabled. Please contact the store.'
    case 'temp_expired':
      return 'This temporary password has expired. Request a new one from "Forgot password".'
    case 'email_taken':
      return 'This email is already registered. Sign in instead.'
    case 'phone_taken':
      return 'This mobile number already has an account. Sign in instead.'
    case 'bad_code':
      return 'That code is incorrect or has expired.'
    case 'bad_password':
      return 'Your current password is incorrect.'
    default:
      return e.message || fallback
  }
}
