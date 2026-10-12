import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

/**
 * The access token lives only in memory. The refresh token is kept in localStorage so
 * a reload stays signed in; the API rotates it on every use.
 */
const REFRESH_KEY = 'dg.console.refresh'

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
