import { useState } from 'react'
import { router } from 'expo-router'
import { api } from '../src/api/client'
import { authMessage } from '../src/auth/AuthProvider'
import { mobileError } from '../src/auth/validation'
import { TENANT_SLUG } from '../src/config'
import { Button, Field } from '../src/ui'
import { AuthScreen } from '../src/ui/auth'
import { useToast } from '../src/ui/toast'

/** Sign-in by mobile number and a one-time code, for customers without a password. */
export default function Login() {
  const toast = useToast()
  const [phone, setPhone] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const bad = mobileError(phone)

  const send = async () => {
    setTried(true)
    if (busy || bad) return
    setBusy(true)
    try {
      await api('/app/auth/otp', { method: 'POST', auth: false, body: { tenant: TENANT_SLUG, phone } })
      router.push({ pathname: '/verify', params: { phone } })
    } catch (e) {
      toast.error(authMessage(e, 'Could not send the code. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthScreen title="Sign in with mobile" subtitle="We'll send a one-time code by SMS, and by email if your account has one.">
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
        error={tried || phone.length === 10 ? bad : null}
        onSubmitEditing={send}
      />
      <Button label="Send code" onPress={send} loading={busy} />
    </AuthScreen>
  )
}
