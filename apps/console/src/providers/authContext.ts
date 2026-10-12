import { createContext, useContext } from 'react'
import type { Me, TokensOut } from '../api/types.ts'

export interface AuthContextType {
  user: Me | null
  isAuthenticated: boolean
  /** True while the saved session is being restored or the profile is loading. */
  isLoading: boolean
  can: (permission: string) => boolean
  signIn: (tokens: TokensOut) => void
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
