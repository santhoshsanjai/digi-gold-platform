import { useEffect, useRef, useState } from 'react'
import { BackHandler, View, type TextInput } from 'react-native'
import { authMessage, useAuth } from '../src/auth/AuthProvider'
import { confirmError, passwordError } from '../src/auth/validation'
import { Button, Field } from '../src/ui'
import { AuthScreen, StrengthMeter } from '../src/ui/auth'
import { confirmAction } from '../src/ui/confirm'
import { useToast } from '../src/ui/toast'

/**
 * Required after signing in with a temporary password. It is the only screen the navigation
 * allows in that state, and the API refuses every session until it is done, so there is
 * nothing to bypass it to. Leaving signs out.
 */
export default function ChangePassword() {
  const { completePasswordChange, cancelPasswordChange } = useAuth()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const confirmRef = useRef<TextInput>(null)

  const leave = () =>
    confirmAction(
      'Cancel password change?',
      'You will need your temporary password to sign in again.',
      'Sign out',
      cancelPasswordChange,
    )

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      leave()
      return true
    })
    return () => sub.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const errors = { password: passwordError(password), confirm: confirmError(password, confirm) }

  const submit = async () => {
    setTried(true)
    if (busy || errors.password || errors.confirm) return
    setBusy(true)
    try {
      await completePasswordChange(password) // returns to sign-in with a confirmation
    } catch (e) {
      toast.error(authMessage(e, 'Could not change your password. Try again.'))
      setBusy(false)
    }
  }

  return (
    <AuthScreen onBack={leave} title="Set a new password" subtitle="You signed in with a temporary password. Choose a new one to continue.">
      <Field
        label="New password"
        password
        value={password}
        onChangeText={setPassword}
        autoFocus
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        hint="At least 8 characters with a letter and a number"
        error={tried ? errors.password : null}
      />
      <StrengthMeter password={password} />
      <Field
        ref={confirmRef}
        label="Confirm new password"
        password
        value={confirm}
        onChangeText={setConfirm}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
        error={tried ? errors.confirm : null}
      />
      <Button label="Save password" onPress={submit} loading={busy} />
      <View style={{ flexGrow: 1 }} />
      <Button variant="text" label="Sign out" onPress={leave} />
    </AuthScreen>
  )
}
