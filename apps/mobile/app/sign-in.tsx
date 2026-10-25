import { useRef, useState } from 'react'
import { View, type TextInput } from 'react-native'
import { router } from 'expo-router'
import { authMessage, useAuth } from '../src/auth/AuthProvider'
import { emailError } from '../src/auth/validation'
import { useTheme } from '../src/theme/ThemeProvider'
import { AuthField, AuthScreen, Banner, GoldButton, SwitchLine, TextLink } from '../src/ui/gold'

export default function SignIn() {
  const { name } = useTheme()
  const { signIn, notice, clearNotice, lastEmail } = useAuth()
  const [email, setEmail] = useState(lastEmail)
  const [password, setPassword] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const passwordRef = useRef<TextInput>(null)

  const emailBad = emailError(email)
  const passwordBad = password ? null : 'Enter your password'

  const submit = async () => {
    setTried(true)
    if (busy || emailBad || passwordBad) return
    setError(null)
    clearNotice()
    setBusy(true)
    try {
      await signIn(email, password)
      // The navigation guard moves on to the app, or to the password change.
    } catch (e) {
      setError(authMessage(e, 'Could not sign you in. Try again.'))
      setBusy(false)
    }
  }

  return (
    <AuthScreen title="Welcome back" subtitle={`Sign in to your ${name} account.`}>
      <Banner tone={notice?.tone ?? 'success'} text={notice?.text} />
      <AuthField
        label="Email"
        value={email}
        onChangeText={(t) => {
          setEmail(t)
          setError(null)
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        placeholder="you@example.com"
        error={tried ? emailBad : null}
      />
      <View style={{ gap: 4 }}>
        <AuthField
          ref={passwordRef}
          label="Password"
          password
          value={password}
          onChangeText={(t) => {
            setPassword(t)
            setError(null)
          }}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
          error={tried ? passwordBad : null}
        />
        <View style={{ alignItems: 'flex-end' }}>
          <TextLink label="Forgot password?" onPress={() => router.push('/forgot-password')} />
        </View>
      </View>
      <Banner tone="danger" text={error} />
      <GoldButton label="Sign in" onPress={submit} loading={busy} />
      <View style={{ flexGrow: 1 }} />
      <View style={{ alignItems: 'center', gap: 4 }}>
        <TextLink label="Sign in with a mobile code instead" onPress={() => router.push('/login')} style={{ fontWeight: '500' }} />
        <SwitchLine prompt="New here?" action="Create an account" onPress={() => router.replace('/sign-up')} />
      </View>
    </AuthScreen>
  )
}
