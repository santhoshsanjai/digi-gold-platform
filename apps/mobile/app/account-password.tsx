import { useState } from 'react'
import { router } from 'expo-router'
import { useMe } from '../src/api/hooks'
import type { Me } from '../src/api/types'
import { authMessage, useAuth } from '../src/auth/AuthProvider'
import { confirmError, passwordError } from '../src/auth/validation'
import { Button, Card, ErrorNote, Field, Screen, Spinner, Text } from '../src/ui'
import { SuccessMark } from '../src/ui/gold'

/** Change the password, or add one for a customer who has only used SMS codes. */
export default function AccountPassword() {
  const me = useMe()
  if (!me.data) {
    return <Screen padTop={false}>{me.isError ? <ErrorNote message="Could not load your profile." /> : <Spinner />}</Screen>
  }
  return <PasswordForm m={me.data} />
}

function PasswordForm({ m }: { m: Me }) {
  const { changePassword } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!m.has_password && !m.email) {
    return (
      <Screen padTop={false}>
        <Card>
          <Text size="heading">Add your email first</Text>
          <Text tone="muted">You will sign in with your email and password, so add an email to your profile.</Text>
          <Button label="Edit profile" onPress={() => router.replace('/edit-profile')} />
        </Card>
      </Screen>
    )
  }

  if (done) {
    return (
      <Screen padTop={false}>
        <SuccessMark size={64} />
        <Text size="title">{m.has_password ? 'Password changed' : 'Password set'}</Text>
        <Text tone="muted">
          {m.has_password
            ? 'Use your new password next time you sign in. Any other phones signed in to your account have been signed out.'
            : `You can now sign in with ${m.email} and this password.`}
        </Text>
        <Button label="Done" onPress={() => router.back()} />
      </Screen>
    )
  }

  const errors = {
    current: m.has_password && !current ? 'Enter your current password' : null,
    next: passwordError(next),
    confirm: confirmError(next, confirm),
  }

  const submit = async () => {
    setTried(true)
    if (busy || Object.values(errors).some(Boolean)) return
    setBusy(true)
    setError(null)
    try {
      await changePassword(m.has_password ? current : null, next)
      setDone(true)
    } catch (e) {
      setError(authMessage(e, 'Could not change your password. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen padTop={false} footer={<Button label={m.has_password ? 'Change password' : 'Set password'} onPress={submit} loading={busy} />}>
      {!m.has_password && <Text tone="muted">Set a password to sign in with {m.email}.</Text>}
      {m.has_password && (
        <Field
          label="Current password"
          password
          value={current}
          onChangeText={setCurrent}
          autoComplete="current-password"
          textContentType="password"
          error={tried ? errors.current : null}
        />
      )}
      <Field
        label="New password"
        password
        value={next}
        onChangeText={setNext}
        autoComplete="new-password"
        textContentType="newPassword"
        hint="At least 8 characters, with a letter and a number."
        error={tried ? errors.next : null}
      />
      <Field
        label="Confirm new password"
        password
        value={confirm}
        onChangeText={setConfirm}
        autoComplete="new-password"
        textContentType="newPassword"
        error={tried ? errors.confirm : null}
      />
      <ErrorNote message={error} />
    </Screen>
  )
}
