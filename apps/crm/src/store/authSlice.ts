import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { TENANT_SLUG } from '../config/tenant.ts'

/**
 * The access token lives only in memory, so a script injected into the page cannot
 * read a long-lived credential from storage. The refresh token is kept in
 * localStorage so a reload stays signed in; the API rotates it on every use and
 * ends all sessions if an old one is replayed.
 */
const REFRESH_KEY = `dg.crm.${TENANT_SLUG}.refresh`

export const refreshTokenStore = {
  get: (): string | null => {
    try {
      return localStorage.getItem(REFRESH_KEY)
    } catch {
      return null
    }
  },
  set: (token: string | null) => {
    try {
      if (token) localStorage.setItem(REFRESH_KEY, token)
      else localStorage.removeItem(REFRESH_KEY)
    } catch {
      // Storage blocked (private mode): the session simply ends on reload.
    }
  },
}

interface AuthState {
  accessToken: string | null
  /** False until the first refresh attempt on page load has finished. */
  restored: boolean
}

const initialState: AuthState = { accessToken: null, restored: false }

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    signedIn(state, action: PayloadAction<{ accessToken: string; refreshToken: string }>) {
      refreshTokenStore.set(action.payload.refreshToken)
      state.accessToken = action.payload.accessToken
      state.restored = true
    },
    /** Restoring failed without an answer (offline): keep the saved token for later. */
    sessionChecked(state) {
      state.restored = true
    },
    signedOut(state) {
      refreshTokenStore.set(null)
      state.accessToken = null
      state.restored = true
    },
  },
})

export const { signedIn, sessionChecked, signedOut } = authSlice.actions
export const authReducer = authSlice.reducer
