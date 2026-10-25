import { useState } from 'react'
import { router } from 'expo-router'
import { api } from '../src/api/client'
import { authMessage } from '../src/auth/AuthProvider'
import { mobileError } from '../src/auth/validation'
import { TENANT_SLUG } from '../src/config'
import { AuthField, AuthScreen, Banner, GoldButton } from '../src/ui/gold'

/** Sign-in by mobile number and a texted code, for customers without a password. */
export default function Login() {
  const [phone, setPhone] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bad = mobileError(phone)

  const send = async () => {
    setTried(true)
    if (busy || bad) return
    setError(null)
    setBusy(true)
    try {
      await api('/app/auth/otp', { method: 'POST', auth: false, body: { tenant: TENANT_SLUG, phone } })
      router.push({ pathname: '/verify', params: { phone } })
    } catch (e) {
      setError(authMessage(e, 'Could not send the code. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthScreen title="Sign in with your mobile" subtitle="We will text a 6-digit code to this number.">
      <AuthField
        label="Mobile number"
        prefix="+91"
        value={phone}
        onChangeText={(t) => {
          setPhone(t.replace(/\D/g, '').slice(0, 10))
          setError(null)
        }}
        keyboardType="number-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        autoFocus
        maxLength={10}
        placeholder="98765 43210"
        error={tried || phone.length === 10 ? bad : null}
        onSubmitEditing={send}
      />
      <Banner tone="danger" text={error} />
      <GoldButton label="Send code" onPress={send} loading={busy} />
    </AuthScreen>
  )
}
