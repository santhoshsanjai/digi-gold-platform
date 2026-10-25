import { useRef, useState } from 'react'
import { View, type TextInput } from 'react-native'
import { router } from 'expo-router'
import { authMessage, useAuth } from '../src/auth/AuthProvider'
import { emailError } from '../src/auth/validation'
import { useTheme } from '../src/theme/ThemeProvider'
import { Button, Field } from '../src/ui'
import { AuthScreen, SwitchLine, TextLink } from '../src/ui/auth'
import { useToast } from '../src/ui/toast'

export default function SignIn() {
  const { name } = useTheme()
  const { signIn, lastEmail } = useAuth()
  const toast = useToast()
  const [email, setEmail] = useState(lastEmail)
  const [password, setPassword] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const passwordRef = useRef<TextInput>(null)

  const emailBad = emailError(email)
  const passwordBad = password ? null : 'Enter your password'

  const submit = async () => {
    setTried(true)
    if (busy || emailBad || passwordBad) return
    setBusy(true)
    try {
      await signIn(email, password)
      // The navigation guard moves on to the app, or to the password change.
    } catch (e) {
      toast.error(authMessage(e, 'Could not sign you in. Try again.'))
      setBusy(false)
    }
  }

  return (
    <AuthScreen title="Sign in" subtitle={`Welcome back to ${name}.`}>
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        placeholder="name@example.com"
        error={tried ? emailBad : null}
      />
      <View>
        <Field
          ref={passwordRef}
          label="Password"
          password
          value={password}
          onChangeText={setPassword}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
          error={tried ? passwordBad : null}
        />
        <View style={{ alignItems: 'flex-end' }}>
          <TextLink label="Forgot password?" onPress={() => router.push('/forgot-password')} style={{ fontSize: 14 }} />
        </View>
      </View>
      <Button label="Sign in" onPress={submit} loading={busy} />
      <View style={{ flexGrow: 1 }} />
      <View style={{ alignItems: 'center' }}>
        <TextLink label="Use a mobile code instead" onPress={() => router.push('/login')} style={{ fontWeight: '500' }} />
        <SwitchLine prompt="Don't have an account?" action="Sign up" onPress={() => router.replace('/sign-up')} />
      </View>
    </AuthScreen>
  )
}
