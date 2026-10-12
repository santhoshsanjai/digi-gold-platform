import React from 'react'
import { Provider } from 'react-redux'
import { Toaster } from 'sonner'
import { store } from '../store/index.ts'
import { AuthProvider } from './AuthProvider.tsx'
import { ThemeProvider } from './ThemeProvider.tsx'

export interface AppProvidersProps {
  children: React.ReactNode
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <AuthProvider>
          {children}
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </ThemeProvider>
    </Provider>
  )
}
