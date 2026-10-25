import { useRef, useState } from 'react'
import { Text, View, type TextInput } from 'react-native'
import { router } from 'expo-router'
import { authMessage, useAuth } from '../src/auth/AuthProvider'
import { confirmError, emailError, mobileError, nameError, passwordError } from '../src/auth/validation'
import { useTheme } from '../src/theme/ThemeProvider'
import { AuthField, AuthScreen, Banner, gold, GoldButton, StrengthMeter, SwitchLine } from '../src/ui/gold'

export default function SignUp() {
  const { name: shop } = useTheme()
  const { startRegistration } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' })
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const emailRef = useRef<TextInput>(null)
  const phoneRef = useRef<TextInput>(null)
  const passwordRef = useRef<TextInput>(null)
  const confirmRef = useRef<TextInput>(null)

  const errors = {
    name: nameError(form.name),
    email: emailError(form.email),
    phone: mobileError(form.phone),
    password: passwordError(form.password),
    confirm: confirmError(form.password, form.confirm),
  }
  const show = (k: keyof typeof errors) => (tried || touched[k] ? errors[k] : null)
  const set = (k: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: k === 'phone' ? v.replace(/\D/g, '').slice(0, 10) : v }))
    setError(null)
  }
  const blur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }))

  const submit = async () => {
    setTried(true)
    if (busy || Object.values(errors).some(Boolean)) return
    setBusy(true)
    setError(null)
    try {
      await startRegistration({ name: form.name, email: form.email, phone: form.phone, password: form.password })
      router.push('/sign-up-verify')
    } catch (e) {
      setError(authMessage(e, 'Could not create your account. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthScreen title="Create your account" subtitle={`Start saving in gold with ${shop}.`}>
      <AuthField
        label="Full name"
        value={form.name}
        onChangeText={set('name')}
        onBlur={blur('name')}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        error={show('name')}
      />
      <AuthField
        ref={emailRef}
        label="Email"
        value={form.email}
        onChangeText={set('email')}
        onBlur={blur('email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => phoneRef.current?.focus()}
        placeholder="you@example.com"
        hint="You sign in with this, and password resets are sent here."
        error={show('email')}
      />
      <AuthField
        ref={phoneRef}
        label="Mobile number"
        prefix="+91"
        value={form.phone}
        onChangeText={set('phone')}
        onBlur={blur('phone')}
        keyboardType="number-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        maxLength={10}
        placeholder="98765 43210"
        hint="We send a code by SMS and email to confirm it. The store uses it to find your account."
        error={show('phone')}
      />
      <AuthField
        ref={passwordRef}
        label="Password"
        password
        value={form.password}
        onChangeText={set('password')}
        onBlur={blur('password')}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        hint="At least 8 characters, with a letter and a number."
        error={show('password')}
      />
      <StrengthMeter password={form.password} />
      <AuthField
        ref={confirmRef}
        label="Confirm password"
        password
        value={form.confirm}
        onChangeText={set('confirm')}
        onBlur={blur('confirm')}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
        error={show('confirm')}
      />
      <Banner tone="danger" text={error} />
      <GoldButton label="Continue" onPress={submit} loading={busy} />
      <View style={{ flexGrow: 1 }} />
      <Text style={{ color: gold.faint, fontSize: 12, lineHeight: 17, textAlign: 'center' }}>
        Already a customer at the store? Use the same mobile number and your gold history comes with you.
      </Text>
      <SwitchLine prompt="Already have an account?" action="Sign in" onPress={() => router.replace('/sign-in')} />
    </AuthScreen>
  )
}
