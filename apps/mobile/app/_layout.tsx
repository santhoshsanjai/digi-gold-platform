import { useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '../src/auth/AuthProvider'
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider'

export default function RootLayout() {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } }),
  )
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <AuthProvider>
            <Routes />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}

function Routes() {
  const { status } = useAuth()
  const { colors, dark } = useTheme()
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }
  const modal = {
    headerShown: true,
    headerStyle: { backgroundColor: colors.header },
    headerTintColor: colors.onHeader,
    headerTitleStyle: { fontWeight: '600' as const },
    contentStyle: { backgroundColor: colors.bg },
  }
  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={status === 'signedIn'}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="buy" options={{ ...modal, title: 'Buy gold' }} />
          <Stack.Screen name="checkout" options={{ ...modal, title: 'Payment', headerBackVisible: false, gestureEnabled: false }} />
          <Stack.Screen name="redeem" options={{ ...modal, title: 'Redeem in store' }} />
          <Stack.Screen name="pan" options={{ ...modal, title: 'Add your PAN' }} />
        </Stack.Protected>
        <Stack.Protected guard={status === 'signedOut'}>
          <Stack.Screen name="login" />
          <Stack.Screen name="verify" options={{ ...modal, title: '' , headerTransparent: true, headerTintColor: colors.text }} />
        </Stack.Protected>
      </Stack>
    </>
  )
}
