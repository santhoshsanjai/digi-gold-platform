import type { ExpoConfig } from 'expo/config'

/**
 * One codebase, one app per client. A client's build is set by environment variables:
 *   EXPO_PUBLIC_TENANT_SLUG   which client this app serves
 *   EXPO_PUBLIC_API_URL       the API, for example https://api.example.com/api/v1
 *   APP_NAME, APP_ID          store name and bundle / package id for that client's store accounts
 * Everything else (logo, colours, rules) is read from the API when the app opens.
 */
const config: ExpoConfig = {
  name: process.env.APP_NAME ?? 'Digi Gold',
  slug: process.env.APP_SLUG ?? 'digi-gold',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: process.env.APP_SCHEME ?? 'digigold',
  userInterfaceStyle: 'automatic',
  ios: { supportsTablet: false, bundleIdentifier: process.env.APP_ID ?? 'com.example.digigold' },
  android: { package: process.env.APP_ID ?? 'com.example.digigold' },
  web: { bundler: 'metro', output: 'single' },
  plugins: ['expo-router', 'expo-secure-store'],
  experiments: { typedRoutes: false },
}

export default config
