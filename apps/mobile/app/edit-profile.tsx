import { useState } from 'react'
import { router } from 'expo-router'
import { useMe, useUpdateProfile } from '../src/api/hooks'
import type { Me } from '../src/api/types'
import { authMessage } from '../src/auth/AuthProvider'
import { emailError, nameError, normaliseEmail } from '../src/auth/validation'
import { Button, ErrorNote, Field, Screen, Spinner, Text } from '../src/ui'
import { FadeIn } from '../src/ui/gold'

export default function EditProfile() {
  const me = useMe()
  if (!me.data) {
    return <Screen padTop={false}>{me.isError ? <ErrorNote message="Could not load your profile." /> : <Spinner />}</Screen>
  }
  return <EditForm m={me.data} />
}

function EditForm({ m }: { m: Me }) {
  const save = useUpdateProfile()
  const [name, setName] = useState(m.name)
  const [email, setEmail] = useState(m.email)
  const [password, setPassword] = useState('')
  const [tried, setTried] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const emailChanged = normaliseEmail(email) !== m.email
  // The email is where password resets go, so changing it on a password account needs the password.
  const needsPassword = m.has_password && emailChanged
  const errors = {
    name: nameError(name),
    email: email || m.has_password ? emailError(email) : null,
    password: needsPassword && !password ? 'Enter your current password' : null,
  }
  const changed = name.trim() !== m.name || emailChanged

  const submit = async () => {
    setTried(true)
    if (save.isPending || Object.values(errors).some(Boolean)) return
    setError(null)
    try {
      await save.mutateAsync({
        name: name.trim(),
        email: email ? normaliseEmail(email) : undefined,
        current_password: needsPassword ? password : undefined,
      })
      router.back()
    } catch (e) {
      setError(authMessage(e, 'Could not save your profile. Try again.'))
    }
  }

  return (
    <Screen
      padTop={false}
      footer={<Button label="Save changes" onPress={submit} loading={save.isPending} disabled={!changed} />}
    >
      <Field label="Full name" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" textContentType="name" error={tried ? errors.name : null} />
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        hint={m.has_password ? 'You sign in with this email, and password resets are sent to it.' : 'We email you when your gold is close to the end of its validity.'}
        error={tried ? errors.email : null}
      />
      {needsPassword && (
        <FadeIn>
          <Field
            label="Current password"
            password
            value={password}
            onChangeText={setPassword}
            autoComplete="current-password"
            textContentType="password"
            hint="Needed to change the email you sign in with."
            error={tried ? errors.password : null}
          />
        </FadeIn>
      )}
      <Text size="small" tone="muted">
        Your mobile number is how the store finds your account. To change it, visit the store.
      </Text>
      <ErrorNote message={error} />
    </Screen>
  )
}
