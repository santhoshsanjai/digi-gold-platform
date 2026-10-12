import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ConfigProvider, Result, Spin, theme as antdTheme } from 'antd'
import { usePublicConfigQuery } from '../store/api/authApi.ts'
import { errorStatus } from '@digigold/web-common/utils/errors.ts'
import { ThemeContext, type Brand, type ThemeMode } from './themeContext.ts'

const MODE_KEY = 'dg.crm.theme'
const DARK_SURFACES = {
  colorBgLayout: '#020617',
  colorBgContainer: '#0f172a',
  colorBgElevated: '#1e293b',
  colorBorder: '#334155',
  colorBorderSecondary: '#1e293b',
}
const SYSTEM_FONTS = new Set(['system-ui', 'sans-serif', 'serif', 'monospace'])

function initialMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(MODE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // ignore blocked storage
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function loadFont(family: string) {
  if (!family || SYSTEM_FONTS.has(family)) return
  const id = 'brand-font'
  const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;500;600;700&display=swap`
  const existing = document.getElementById(id) as HTMLLinkElement | null
  if (existing?.href === href) return
  const link = existing ?? Object.assign(document.createElement('link'), { id, rel: 'stylesheet' })
  link.href = href
  if (!existing) document.head.appendChild(link)
}

function setFavicon(url: string) {
  if (!url) return
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (link) {
    link.href = url
    link.removeAttribute('type')
  }
}

/**
 * Colours, logo, name and font come from the client's branding, set in the Platform
 * Console. Nothing about any one client is built into the CRM.
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(initialMode)
  const { data: config, error, isLoading, refetch } = usePublicConfigQuery()

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

  const brand = useMemo<Brand>(() => {
    const b = config?.branding
    return {
      name: b?.display_name || config?.name || 'CRM',
      logoUrl: b?.logo_url ?? '',
      primaryColor: b?.primary_color ?? '#B8860B',
      secondaryColor: b?.secondary_color ?? '#1F2937',
      supportEmail: b?.support_email ?? '',
      supportPhone: b?.support_phone ?? '',
    }
  }, [config])
  const fontFamily = config?.branding.font_family || 'Inter'

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', mode === 'dark')
    root.style.colorScheme = mode
    root.style.setProperty('--brand-primary', brand.primaryColor)
    root.style.setProperty('--brand-secondary', brand.secondaryColor)
    root.style.setProperty('--brand-font', `'${fontFamily}'`)
  }, [mode, brand, fontFamily])

  useEffect(() => {
    if (!config) return
    document.title = `${brand.name} · CRM`
    setFavicon(config.branding.favicon_url ?? '')
    loadFont(fontFamily)
  }, [config, brand.name, fontFamily])

  const contextValue = useMemo(
    () => ({ mode, setMode, toggleTheme, brand }),
    [mode, setMode, toggleTheme, brand],
  )

  const themeConfig = useMemo(
    () => ({
      algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: brand.primaryColor,
        colorLink: brand.primaryColor,
        borderRadius: 8,
        fontFamily: `'${fontFamily}', system-ui, sans-serif`,
        // In dark mode, match Ant Design surfaces to the Tailwind slate used elsewhere.
        ...(mode === 'dark' ? DARK_SURFACES : {}),
      },
    }),
    [mode, brand.primaryColor, fontFamily],
  )

  let body = children
  if (isLoading) {
    body = (
      <div className="min-h-screen grid place-items-center">
        <Spin size="large" />
      </div>
    )
  } else if (error) {
    body =
      errorStatus(error) === 404 ? (
        <Result
          status="404"
          title="This address is not set up"
          subTitle="No jeweller is linked to this CRM address. Check the link you were given."
        />
      ) : (
        <Result
          status="warning"
          title="Cannot reach the server"
          subTitle="Check your connection and try again."
          extra={
            <button className="text-primary-600 font-medium" onClick={() => refetch()}>
              Try again
            </button>
          }
        />
      )
  }

  return (
    <ThemeContext.Provider value={contextValue}>
      <ConfigProvider theme={themeConfig}>{body}</ConfigProvider>
    </ThemeContext.Provider>
  )
}
