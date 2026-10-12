import { useState } from 'react'
import { Linking } from 'react-native'
import { router } from 'expo-router'
import { ApiError } from '../../src/api/client'
import { useMe, useUpdateProfile } from '../../src/api/hooks'
import { useAuth } from '../../src/auth/AuthProvider'
import type { Me } from '../../src/api/types'
import { useTheme } from '../../src/theme/ThemeProvider'
import { Button, Card, ErrorNote, Field, Pill, Row, Screen, Spinner, Text } from '../../src/ui'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Profile() {
  const me = useMe()
  if (!me.data) {
    return (
      <Screen>
        <Spinner />
      </Screen>
    )
  }
  return <ProfileForm m={me.data} />
}

export function ProfileForm({ m }: { m: Me }) {
  const { brand, name } = useTheme()
  const { signOut } = useAuth()
  const save = useUpdateProfile()
  const [fullName, setFullName] = useState(m.name)
  const [email, setEmail] = useState(m.email)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const emailBad = email !== '' && !EMAIL.test(email)
  const changed = fullName.trim() !== m.name || email.trim().toLowerCase() !== m.email

  const submit = async () => {
    setError(null)
    setSaved(false)
    try {
      await save.mutateAsync({ name: fullName.trim() || undefined, email: email.trim() || undefined })
      setSaved(true)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save. Try again.')
    }
  }

  return (
    <Screen>
      <Text size="title">Profile</Text>
      <Card>
        <Row label="Mobile" value={`+91 ${m.phone.replace(/^\+?91/, '')}`} />
        <Row label="PAN" value={m.pan_provided ? 'Added' : 'Not added'} />
        {!m.pan_provided && (
          <Button variant="secondary" label="Add PAN" onPress={() => router.push('/pan')} />
        )}
      </Card>
      <Card>
        <Field label="Full name" value={fullName} onChangeText={setFullName} autoComplete="name" textContentType="name" />
        <Field
          label="Email"
          hint="We email you when your gold is close to the end of its validity."
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          error={emailBad ? 'Enter a valid email address' : null}
        />
        <ErrorNote message={error} />
        {saved && <Pill label="Saved" tone="success" />}
        <Button label="Save" onPress={submit} loading={save.isPending} disabled={!changed || emailBad} />
      </Card>
      {!!(brand.support_phone || brand.support_email) && (
        <Card>
          <Text size="heading">Need help with {name}?</Text>
          {brand.support_phone ? (
            <Button variant="secondary" label={`Call ${brand.support_phone}`} onPress={() => Linking.openURL(`tel:${brand.support_phone}`)} />
          ) : null}
          {brand.support_email ? (
            <Button variant="secondary" label={`Email ${brand.support_email}`} onPress={() => Linking.openURL(`mailto:${brand.support_email}`)} />
          ) : null}
        </Card>
      )}
      <Button variant="danger" label="Sign out" onPress={signOut} />
    </Screen>
  )
}
