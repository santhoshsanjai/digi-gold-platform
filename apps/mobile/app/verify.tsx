import { useEffect, useRef, useState } from 'react'
import { View, type TextInput } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { api } from '../src/api/client'
import type { Tokens } from '../src/api/types'
import { authMessage, useAuth } from '../src/auth/AuthProvider'
import { TENANT_SLUG } from '../src/config'
import { AuthField, AuthScreen, Banner, GoldButton, TextLink } from '../src/ui/gold'

const RESEND_SECONDS = 30

export default function Verify() {
  const { phone = '' } = useLocalSearchParams<{ phone: string }>()
  const { signInWithTokens } = useAuth()
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
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      const tokens = await api<Tokens>('/app/auth/verify', {
        method: 'POST',
        auth: false,
        body: { tenant: TENANT_SLUG, phone, code: value },
      })
      await signInWithTokens(tokens)
    } catch (e) {
      setError(authMessage(e, 'Could not sign you in. Try again.'))
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
      setError(authMessage(e, 'Could not send the code. Try again.'))
    }
  }

  return (
    <AuthScreen title="Enter the code" subtitle={`Sent to +91 ${phone}`}>
      <AuthField
        ref={input}
        label="6-digit code"
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
      <GoldButton label="Verify" onPress={() => verify(code)} loading={busy} disabled={code.length !== 6} />
      <View style={{ alignItems: 'center' }}>
        {wait > 0 ? (
          <TextLink label={`Send a new code in ${wait}s`} onPress={() => {}} style={{ opacity: 0.5 }} />
        ) : (
          <TextLink label="Send a new code" onPress={resend} />
        )}
      </View>
    </AuthScreen>
  )
}
