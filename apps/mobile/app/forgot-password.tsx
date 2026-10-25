import { useState } from 'react'
import { router } from 'expo-router'
import { authMessage, useAuth } from '../src/auth/AuthProvider'
import { emailError } from '../src/auth/validation'
import { Button, Field, Text } from '../src/ui'
import { AuthScreen, SuccessMark } from '../src/ui/auth'
import { useToast } from '../src/ui/toast'

/**
 * Asks the API to email a temporary password to the registered address. The answer is the
 * same whether or not the email has an account, so this screen never reveals who does.
 */
export default function ForgotPassword() {
  const { requestPasswordReset, lastEmail } = useAuth()
  const toast = useToast()
  const [email, setEmail] = useState(lastEmail)
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const bad = emailError(email)

  const submit = async () => {
    setTried(true)
    if (busy || bad) return
    setBusy(true)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch (e) {
      toast.error(authMessage(e, 'Could not send the email. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <AuthScreen
        back={false}
        title="Check your email"
        subtitle={
          <Text tone="muted">
            If an account uses <Text style={{ fontWeight: '600' }}>{email.trim().toLowerCase()}</Text>, we have sent it a temporary
            password that works for 30 minutes. Sign in with it to choose a new password.
          </Text>
        }
      >
        <SuccessMark />
        <Button label="Back to sign in" onPress={() => router.dismissTo('/sign-in')} />
        <Button variant="text" label="Didn't get it? Try again" onPress={() => setSent(false)} />
      </AuthScreen>
    )
  }

  return (
    <AuthScreen title="Forgot password" subtitle="Enter your registered email and we'll send you a temporary password.">
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        autoFocus={!email}
        returnKeyType="send"
        onSubmitEditing={submit}
        placeholder="name@example.com"
        error={tried ? bad : null}
      />
      <Button label="Send temporary password" onPress={submit} loading={busy} />
    </AuthScreen>
  )
}
