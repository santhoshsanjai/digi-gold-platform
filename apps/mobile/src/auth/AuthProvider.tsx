import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, clearTokens, refreshSession, setSessionLostHandler, storedRefreshToken, storeTokens } from '../api/client'
import type { Tokens } from '../api/types'

type Status = 'loading' | 'signedOut' | 'signedIn'

interface Auth {
  status: Status
  signIn: (tokens: Tokens) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<Auth | null>(null)

export function useAuth(): Auth {
  const a = useContext(AuthContext)
  if (!a) throw new Error('useAuth outside AuthProvider')
  return a
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const qc = useQueryClient()

  const end = useCallback(() => {
    qc.clear()
    setStatus('signedOut')
  }, [qc])

  useEffect(() => {
    setSessionLostHandler(() => {
      void clearTokens().then(end)
    })
    let live = true
    ;(async () => {
      const ok = (await storedRefreshToken()) ? await refreshSession() : false
      if (live) setStatus(ok ? 'signedIn' : 'signedOut')
    })()
    return () => {
      live = false
    }
  }, [end])

  const value = useMemo<Auth>(
    () => ({
      status,
      signIn: async (tokens) => {
        await storeTokens(tokens)
        setStatus('signedIn')
      },
      signOut: async () => {
        const refresh_token = await storedRefreshToken()
        if (refresh_token) await api('/app/auth/logout', { method: 'POST', body: { refresh_token }, auth: false }).catch(() => {})
        await clearTokens()
        end()
      },
    }),
    [status, end],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
