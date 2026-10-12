import { useState } from 'react'
import { router } from 'expo-router'
import { api, ApiError } from '../src/api/client'
import { TENANT_SLUG } from '../src/config'
import { useTheme } from '../src/theme/ThemeProvider'
import { Brand } from '../src/ui/Brand'
import { Button, ErrorNote, Field, Screen, Text } from '../src/ui'

export default function Login() {
  const { name } = useTheme()
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const valid = /^[6-9]\d{9}$/.test(phone)

  const send = async () => {
    setError(null)
    setBusy(true)
    try {
      await api('/app/auth/otp', { method: 'POST', auth: false, body: { tenant: TENANT_SLUG, phone } })
      router.push({ pathname: '/verify', params: { phone } })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send the code. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen
      footer={
        <>
          <Button label="Send code" onPress={send} loading={busy} disabled={!valid} />
          <Text size="small" tone="muted" style={{ textAlign: 'center' }}>
            We will text a 6-digit code to this number.
          </Text>
        </>
      }
    >
      <Brand />
      <Text size="heading" style={{ marginTop: 16 }}>
        Sign in to {name}
      </Text>
      <Field
        label="Mobile number"
        prefix="+91"
        value={phone}
        onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
        keyboardType="number-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        autoFocus
        maxLength={10}
        placeholder="98765 43210"
        error={phone.length === 10 && !valid ? 'Enter a valid 10-digit mobile number' : null}
        onSubmitEditing={valid ? send : undefined}
      />
      <ErrorNote message={error} />
    </Screen>
  )
}
