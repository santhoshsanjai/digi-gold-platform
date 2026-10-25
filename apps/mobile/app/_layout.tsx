import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '../src/auth/AuthProvider'
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider'
import { gold, GoldBackdrop } from '../src/ui/gold'
import { ToastProvider, useToast } from '../src/ui/toast'

export default function RootLayout() {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } }),
  )
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <Routes />
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}

/**
 * Which screens exist depends only on the auth status, so a deep link, the back button or a
 * restored navigation state cannot reach a screen the status does not allow; expo-router
 * sends it to the index, which redirects to the right place.
 */
function Routes() {
  const { status, notice } = useAuth()
  const { colors, dark } = useTheme()
  const toast = useToast()
  // Session messages (expired, password updated, account ready) appear as a toast.
  useEffect(() => {
    if (notice) (notice.tone === 'success' ? toast.success : toast.info)(notice.text)
  }, [notice, toast])
  if (status === 'initializing') {
    // Restoring the saved session: show nothing protected until it is confirmed.
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: gold.bg }}>
        <StatusBar style="light" />
        <GoldBackdrop glowY={0.5} />
        <ActivityIndicator size="large" color={gold.accent} accessibilityLabel="Loading" />
      </View>
    )
  }
  const modal = {
    headerShown: true,
    headerStyle: { backgroundColor: colors.bg },
    headerTintColor: colors.text,
    headerShadowVisible: false,
    headerTitleStyle: { fontWeight: '600' as const, fontSize: 17 },
    headerBackTitle: 'Back',
    contentStyle: { backgroundColor: colors.bg },
  }
  const auth = { contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' as const }
  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={status === 'signedIn'}>
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="buy" options={{ ...modal, title: 'Buy gold' }} />
          <Stack.Screen name="checkout" options={{ ...modal, title: 'Payment', headerBackVisible: false, gestureEnabled: false }} />
          <Stack.Screen name="redeem" options={{ ...modal, title: 'Redeem in store' }} />
          <Stack.Screen name="pan" options={{ ...modal, title: 'Add your PAN' }} />
          <Stack.Screen name="edit-profile" options={{ ...modal, title: 'Edit profile' }} />
          <Stack.Screen name="account-password" options={{ ...modal, title: 'Password' }} />
        </Stack.Protected>
        <Stack.Protected guard={status === 'signedOut'}>
          <Stack.Screen name="welcome" options={{ contentStyle: { backgroundColor: gold.bg }, animation: 'fade' }} />
          <Stack.Screen name="sign-in" options={{ ...auth, animation: 'fade_from_bottom' }} />
          <Stack.Screen name="sign-up" options={{ ...auth, animation: 'fade_from_bottom' }} />
          <Stack.Screen name="sign-up-verify" options={auth} />
          <Stack.Screen name="forgot-password" options={auth} />
          <Stack.Screen name="login" options={auth} />
          <Stack.Screen name="verify" options={auth} />
        </Stack.Protected>
        <Stack.Protected guard={status === 'passwordChange'}>
          <Stack.Screen name="change-password" options={{ ...auth, animation: 'fade', gestureEnabled: false }} />
        </Stack.Protected>
      </Stack>
    </>
  )
}
