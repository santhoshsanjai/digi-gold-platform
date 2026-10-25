import { useEffect, useRef, useState } from 'react'
import { View, type TextInput } from 'react-native'
import { Redirect, router } from 'expo-router'
import { authMessage, useAuth } from '../src/auth/AuthProvider'
import { Button, Field, Text } from '../src/ui'
import { AuthScreen, SuccessMark, TextLink } from '../src/ui/auth'
import { useToast } from '../src/ui/toast'

const RESEND_SECONDS = 30

/** Confirms the mobile number with the code (sent by SMS and email), which creates the account. */
export default function SignUpVerify() {
  const { pendingRegistration, completeRegistration, resendRegistrationCode } = useAuth()
  const toast = useToast()
  const pending = pendingRegistration()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
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
    setBusy(true)
    try {
      await completeRegistration(value)
      setDone(true)
    } catch (e) {
      toast.error(authMessage(e, 'Could not verify the code. Try again.'))
      setCode('')
      input.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    try {
      await resendRegistrationCode()
      setWait(RESEND_SECONDS)
      toast.success('A new code has been sent.')
    } catch (e) {
      toast.error(authMessage(e, 'Could not send the code. Try again.'))
    }
  }

  if (done) {
    return (
      <AuthScreen back={false} title="Account created" subtitle="Your account is ready. Sign in with your email and password.">
        <SuccessMark />
        <Button
          label="Sign in"
          onPress={() => {
            // Leave the sign-up form (and the password typed into it) behind.
            if (router.canDismiss()) router.dismissAll()
            router.replace('/sign-in')
          }}
        />
      </AuthScreen>
    )
  }

  return (
    <AuthScreen
      title="Verify your number"
      subtitle={
        <Text tone="muted">
          Enter the 6-digit code sent to <Text style={{ fontWeight: '600' }}>+91 {pending?.phone}</Text> and{' '}
          <Text style={{ fontWeight: '600' }}>{pending?.email}</Text>.
        </Text>
      }
    >
      <Field
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
        style={{ letterSpacing: 6, fontSize: 20, fontWeight: '600' }}
      />
      <Button label="Verify" onPress={() => verify(code)} loading={busy} disabled={code.length !== 6} />
      <View style={{ alignItems: 'center' }}>
        <TextLink label={wait > 0 ? `Resend code in ${wait}s` : 'Resend code'} onPress={resend} disabled={wait > 0} />
        <TextLink label="Change details" onPress={() => router.back()} style={{ fontWeight: '500' }} />
      </View>
    </AuthScreen>
  )
}
