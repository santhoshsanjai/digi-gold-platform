import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { App as AntApp, ConfigProvider, theme as antdTheme } from 'antd'
import { ThemeContext, type ThemeMode } from './themeContext.ts'

const MODE_KEY = 'dg.console.theme'
/** The Console is the platform's own tool, so it keeps one look for every client. */
const CONSOLE_COLOR = '#4f46e5'
const DARK_SURFACES = {
  colorBgLayout: '#020617',
  colorBgContainer: '#0f172a',
  colorBgElevated: '#1e293b',
  colorBorder: '#334155',
  colorBorderSecondary: '#1e293b',
}

function initialMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(MODE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // ignore blocked storage
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(initialMode)

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    try {
      localStorage.setItem(MODE_KEY, next)
    } catch {
      // ignore blocked storage
    }
  }, [])
  const toggleTheme = useCallback(
    () => setMode(mode === 'light' ? 'dark' : 'light'),
    [mode, setMode],
  )

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', mode === 'dark')
    root.style.colorScheme = mode
    root.style.setProperty('--brand-primary', CONSOLE_COLOR)
  }, [mode])

  const contextValue = useMemo(() => ({ mode, setMode, toggleTheme }), [mode, setMode, toggleTheme])
  const themeConfig = useMemo(
    () => ({
      algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: CONSOLE_COLOR,
        borderRadius: 8,
        fontFamily: "'Inter', system-ui, sans-serif",
        ...(mode === 'dark' ? DARK_SURFACES : {}),
      },
    }),
    [mode],
  )

  return (
    <ThemeContext.Provider value={contextValue}>
      <ConfigProvider theme={themeConfig}>
        <AntApp>{children}</AntApp>
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}
