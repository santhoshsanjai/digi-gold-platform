import { useEffect, useRef, useState } from 'react'
import { BackHandler, View, type TextInput } from 'react-native'
import { authMessage, useAuth } from '../src/auth/AuthProvider'
import { confirmError, passwordError } from '../src/auth/validation'
import { confirmAction } from '../src/ui/confirm'
import { AuthField, AuthScreen, Banner, GoldButton, StrengthMeter } from '../src/ui/gold'

/**
 * Required after signing in with a temporary password. It is the only screen the navigation
 * allows in that state, and the API refuses every session until it is done, so there is
 * nothing to bypass it to. Leaving signs out.
 */
export default function ChangePassword() {
  const { completePasswordChange, cancelPasswordChange } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirmRef = useRef<TextInput>(null)

  const leave = () =>
    confirmAction(
      'Stop changing your password?',
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
    setError(null)
    try {
      await completePasswordChange(password) // returns to sign-in with a confirmation
    } catch (e) {
      setError(authMessage(e, 'Could not change your password. Try again.'))
      setBusy(false)
    }
  }

  return (
    <AuthScreen
      onBack={leave}
      title="Choose a new password"
      subtitle="You signed in with a temporary password. Set a new one to keep your account secure."
    >
      <AuthField
        label="New password"
        password
        value={password}
        onChangeText={(t) => {
          setPassword(t)
          setError(null)
        }}
        autoFocus
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        hint="At least 8 characters, with a letter and a number."
        error={tried ? errors.password : null}
      />
      <StrengthMeter password={password} />
      <AuthField
        ref={confirmRef}
        label="Confirm new password"
        password
        value={confirm}
        onChangeText={(t) => {
          setConfirm(t)
          setError(null)
        }}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
        error={tried ? errors.confirm : null}
      />
      <Banner tone="danger" text={error} />
      <GoldButton label="Save new password" onPress={submit} loading={busy} />
      <View style={{ flexGrow: 1 }} />
      <GoldButton variant="ghost" label="Sign out instead" onPress={leave} />
    </AuthScreen>
  )
}
