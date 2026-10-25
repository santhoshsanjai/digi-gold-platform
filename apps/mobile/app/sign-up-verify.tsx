import { useEffect, useRef, useState } from 'react'
import { View, type TextInput } from 'react-native'
import { Redirect, router } from 'expo-router'
import { authMessage, useAuth } from '../src/auth/AuthProvider'
import { AuthField, AuthScreen, Banner, GoldButton, SuccessMark, TextLink } from '../src/ui/gold'

const RESEND_SECONDS = 30

/** Confirms the mobile number with the texted code, which creates the account. */
export default function SignUpVerify() {
  const { pendingRegistration, completeRegistration, resendRegistrationCode } = useAuth()
  const pending = pendingRegistration()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [wait, setWait] = useState(RESEND_SECONDS)
  const input = useRef<TextInput>(null)

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  if (!pending && !done) return <Redirect href="/sign-up" />

  const verify = async (value: string) => {
    if (busy) return
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      await completeRegistration(value)
      setDone(true)
    } catch (e) {
      setError(authMessage(e, 'Could not verify the code. Try again.'))
      setCode('')
      input.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    setError(null)
    try {
      await resendRegistrationCode()
      setWait(RESEND_SECONDS)
      setInfo('A new code is on its way.')
    } catch (e) {
      setError(authMessage(e, 'Could not send the code. Try again.'))
    }
  }

  if (done) {
    return (
      <AuthScreen back={false} title="You're all set" subtitle="Your account is ready. Sign in with your email and password to continue.">
        <SuccessMark />
        <GoldButton label="Continue to sign in" onPress={() => router.replace('/sign-in')} />
      </AuthScreen>
    )
  }

  return (
    <AuthScreen title="Confirm your number" subtitle={`Enter the 6-digit code we sent to +91 ${pending?.phone}.`}>
      <AuthField
        ref={input}
        label="Verification code"
        value={code}
        onChangeText={(t) => {
          const digits = t.replace(/\D/g, '').slice(0, 6)
          setCode(digits)
          if (digits.length === 6) void verify(digits)
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoFocus
        maxLength={6}
        placeholder="••••••"
        style={{ letterSpacing: 8, fontSize: 22 }}
      />
      <Banner tone="danger" text={error} />
      <Banner tone="success" text={info} />
      <GoldButton label="Verify and create account" onPress={() => verify(code)} loading={busy} disabled={code.length !== 6} />
      <View style={{ alignItems: 'center' }}>
        {wait > 0 ? (
          <TextLink label={`Send a new code in ${wait}s`} onPress={() => {}} style={{ opacity: 0.5 }} />
        ) : (
          <TextLink label="Send a new code" onPress={resend} />
        )}
        <TextLink label="Change my details" onPress={() => router.back()} style={{ fontWeight: '500' }} />
      </View>
    </AuthScreen>
  )
}
