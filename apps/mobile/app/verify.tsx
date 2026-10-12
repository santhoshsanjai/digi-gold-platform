import { useEffect, useRef, useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import type { TextInput } from 'react-native'
import { api, ApiError } from '../src/api/client'
import type { Tokens } from '../src/api/types'
import { useAuth } from '../src/auth/AuthProvider'
import { TENANT_SLUG } from '../src/config'
import { Button, ErrorNote, Field, Screen, Text } from '../src/ui'

const RESEND_SECONDS = 30

export default function Verify() {
  const { phone = '' } = useLocalSearchParams<{ phone: string }>()
  const { signIn } = useAuth()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wait, setWait] = useState(RESEND_SECONDS)
  const input = useRef<TextInput>(null)

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  const verify = async (value: string) => {
    setError(null)
    setBusy(true)
    try {
      const tokens = await api<Tokens>('/app/auth/verify', {
        method: 'POST',
        auth: false,
        body: { tenant: TENANT_SLUG, phone, code: value },
      })
      await signIn(tokens)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not sign you in. Try again.')
      setCode('')
      input.current?.focus()
      setBusy(false)
    }
  }

  const resend = async () => {
    setError(null)
    try {
      await api('/app/auth/otp', { method: 'POST', auth: false, body: { tenant: TENANT_SLUG, phone } })
      setWait(RESEND_SECONDS)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send the code. Try again.')
    }
  }

  return (
    <Screen
      padTop={false}
      footer={<Button label="Verify" onPress={() => verify(code)} loading={busy} disabled={code.length !== 6} />}
    >
      <Text size="title" style={{ marginTop: 72 }}>
        Enter the code
      </Text>
      <Text tone="muted">Sent to +91 {phone}</Text>
      <Field
        ref={input}
        label="6-digit code"
        value={code}
        onChangeText={(t) => {
          const digits = t.replace(/\D/g, '').slice(0, 6)
          setCode(digits)
          if (digits.length === 6 && !busy) void verify(digits)
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoFocus
        maxLength={6}
        placeholder="••••••"
        style={{ letterSpacing: 6 }}
      />
      <ErrorNote message={error} />
      <Button
        variant="secondary"
        label={wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
        onPress={resend}
        disabled={wait > 0}
      />
    </Screen>
  )
}
