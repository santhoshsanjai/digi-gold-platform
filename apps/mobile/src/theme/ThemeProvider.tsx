import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Branding, PublicConfig } from '../api/types'
import { TENANT_SLUG } from '../config'
import { getItem, setItem } from '../storage'
import { buildColors, type Colors } from './colors'

interface Theme {
  colors: Colors
  config: PublicConfig
  brand: Branding
  /** The name shown in the app: the display name, else the business name. */
  name: string
  dark: boolean
}

const ThemeContext = createContext<Theme | null>(null)
const CACHE_KEY = 'dg.config'

export function useTheme(): Theme {
  const t = useContext(ThemeContext)
  if (!t) throw new Error('useTheme outside ThemeProvider')
  return t
}

/**
 * Loads the client's branding and rules from the API before anything is drawn. The last
 * copy is kept on the phone, so the app still opens with no connection.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme()
  const qc = useQueryClient()
  const { data: config, isPending, refetch } = useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      try {
        const fresh = await api<PublicConfig>(`/public/tenants/${TENANT_SLUG}/config`, { auth: false })
        await setItem(CACHE_KEY, JSON.stringify(fresh))
        return fresh
      } catch (e) {
        const cached = await getItem(CACHE_KEY)
        if (cached) return JSON.parse(cached) as PublicConfig
        throw e
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  })

  const dark = scheme === 'dark'
  const value = useMemo<Theme | null>(
    () =>
      config
        ? {
            config,
            brand: config.branding,
            name: config.branding.display_name || config.name,
            dark,
            colors: buildColors(config.branding, dark),
          }
        : null,
    [config, dark],
  )

  if (!value) {
    return (
      <View style={styles.center}>
        {isPending ? (
          <ActivityIndicator size="large" />
        ) : (
          <>
            <Text style={styles.title}>Can&apos;t reach the service</Text>
            <Text style={styles.body}>Check your internet connection and try again.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                qc.removeQueries({ queryKey: ['config'] })
                void refetch()
              }}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Try again</Text>
            </Pressable>
          </>
        )}
      </View>
    )
  }
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, backgroundColor: '#0d0b08' },
  // The same warm black as the welcome screen that usually follows, so nothing flashes.
  title: { fontSize: 20, fontWeight: '600', color: '#f4eee2' },
  body: { fontSize: 15, color: '#a39883', textAlign: 'center' },
  button: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, backgroundColor: '#d9b45a' },
  buttonText: { color: '#1c1407', fontWeight: '600' },
})
