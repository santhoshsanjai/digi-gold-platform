import { useEffect, useRef, useState } from 'react'
import { View, type TextInput } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { api } from '../src/api/client'
import type { Tokens } from '../src/api/types'
import { authMessage, useAuth } from '../src/auth/AuthProvider'
import { TENANT_SLUG } from '../src/config'
import { Button, Field, Text } from '../src/ui'
import { AuthScreen, TextLink } from '../src/ui/auth'
import { useToast } from '../src/ui/toast'

const RESEND_SECONDS = 30

export default function Verify() {
  const { phone = '' } = useLocalSearchParams<{ phone: string }>()
  const { signInWithTokens } = useAuth()
  const toast = useToast()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(RESEND_SECONDS)
  const input = useRef<TextInput>(null)

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  const verify = async (value: string) => {
    if (busy) return
    setBusy(true)
    try {
      const tokens = await api<Tokens>('/app/auth/verify', {
        method: 'POST',
        auth: false,
        body: { tenant: TENANT_SLUG, phone, code: value },
      })
      await signInWithTokens(tokens)
    } catch (e) {
      toast.error(authMessage(e, 'Could not sign you in. Try again.'))
      setCode('')
      input.current?.focus()
      setBusy(false)
    }
  }

  const resend = async () => {
    try {
      await api('/app/auth/otp', { method: 'POST', auth: false, body: { tenant: TENANT_SLUG, phone } })
      setWait(RESEND_SECONDS)
      toast.success('A new code has been sent.')
    } catch (e) {
      toast.error(authMessage(e, 'Could not send the code. Try again.'))
    }
  }

  return (
    <AuthScreen
      title="Enter code"
      subtitle={
        <Text tone="muted">
          We sent a 6-digit code to <Text style={{ fontWeight: '600' }}>+91 {phone}</Text>.
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
      </View>
    </AuthScreen>
  )
}
