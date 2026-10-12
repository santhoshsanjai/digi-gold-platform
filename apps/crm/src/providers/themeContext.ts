import { createContext, useContext } from 'react'

export type ThemeMode = 'light' | 'dark'

export interface Brand {
  /** The client's display name, shown in the header and the browser tab. */
  name: string
  logoUrl: string
  primaryColor: string
  secondaryColor: string
  supportEmail: string
  supportPhone: string
}

export interface ThemeContextType {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  toggleTheme: () => void
  brand: Brand
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
