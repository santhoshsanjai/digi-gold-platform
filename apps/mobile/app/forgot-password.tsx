import { useState } from 'react'
import { Text, View } from 'react-native'
import { router } from 'expo-router'
import { authMessage, useAuth } from '../src/auth/AuthProvider'
import { emailError } from '../src/auth/validation'
import { AuthField, AuthScreen, Banner, gold, GoldButton, SuccessMark } from '../src/ui/gold'

/**
 * Asks the API to email a temporary password to the registered address. The answer is the
 * same whether or not the email has an account, so this screen never reveals who does.
 */
export default function ForgotPassword() {
  const { requestPasswordReset, lastEmail } = useAuth()
  const [email, setEmail] = useState(lastEmail)
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bad = emailError(email)

  const submit = async () => {
    setTried(true)
    if (busy || bad) return
    setBusy(true)
    setError(null)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch (e) {
      setError(authMessage(e, 'Could not send the email. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <AuthScreen back={false} title="Check your email">
        <SuccessMark />
        <Text style={{ color: gold.muted, fontSize: 15, lineHeight: 22 }}>
          If an account uses <Text style={{ color: gold.text, fontWeight: '600' }}>{email.trim().toLowerCase()}</Text>, we have sent it a
          temporary password. It works for 30 minutes.
        </Text>
        <Text style={{ color: gold.muted, fontSize: 15, lineHeight: 22 }}>
          Sign in with it and you will be asked to choose a new password. Your current password keeps working until then.
        </Text>
        <GoldButton label="Back to sign in" onPress={() => router.dismissTo('/sign-in')} />
        <GoldButton variant="ghost" label="I didn't get an email" onPress={() => setSent(false)} />
      </AuthScreen>
    )
  }

  return (
    <AuthScreen title="Reset your password" subtitle="Enter the email you registered with. We'll send you a temporary password.">
      <AuthField
        label="Registered email"
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
        autoFocus={!email}
        returnKeyType="send"
        onSubmitEditing={submit}
        placeholder="you@example.com"
        error={tried ? bad : null}
      />
      <Banner tone="danger" text={error} />
      <GoldButton label="Send temporary password" onPress={submit} loading={busy} />
      <View style={{ flexGrow: 1 }} />
      <Text style={{ color: gold.faint, fontSize: 12, lineHeight: 17, textAlign: 'center' }}>
        No longer have access to that email? Visit the store to update it.
      </Text>
    </AuthScreen>
  )
}
