import React, { useCallback, useEffect, useMemo } from 'react'
import type { TokensOut } from '../api/types.ts'
import { apiSlice } from '../store/api/apiSlice.ts'
import { useLogoutMutation, useMeQuery } from '../store/api/authApi.ts'
import { refreshTokenStore, sessionChecked, signedIn, signedOut } from '../store/authSlice.ts'
import { refreshSession } from '../store/session.ts'
import { useAppDispatch, useAppSelector } from '../store/hooks.ts'
import { AuthContext } from './authContext.ts'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useAppDispatch()
  const { accessToken, restored } = useAppSelector((s) => s.auth)
  const [logout] = useLogoutMutation()
  const { data: user, isLoading: meLoading } = useMeQuery(undefined, { skip: !accessToken })

  // Restore the session after a reload from the saved refresh token. refreshSession
  // shares one exchange, so StrictMode running this effect twice is harmless.
  useEffect(() => {
    if (restored) return
    refreshSession(dispatch).then((ok) => {
      if (!ok) dispatch(sessionChecked())
    })
  }, [restored, dispatch])

  const signIn = useCallback(
    (tokens: TokensOut) =>
      dispatch(signedIn({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token })),
    [dispatch],
  )

  const signOut = useCallback(async () => {
    const saved = refreshTokenStore.get()
    if (saved) await logout({ refresh_token: saved }).catch(() => undefined)
    dispatch(signedOut())
    dispatch(apiSlice.util.resetApiState())
  }, [dispatch, logout])

  const permissions = useMemo(() => new Set(user?.permissions ?? []), [user])
  const can = useCallback((permission: string) => permissions.has(permission), [permissions])

  const value = useMemo(
    () => ({
      user: user ?? null,
      isAuthenticated: Boolean(accessToken),
      isLoading: !restored || (Boolean(accessToken) && meLoading),
      can,
      signIn,
      signOut,
    }),
    [user, accessToken, restored, meLoading, can, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
