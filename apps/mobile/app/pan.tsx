import { useState } from 'react'
import { router } from 'expo-router'
import { ApiError } from '../src/api/client'
import { useSavePan } from '../src/api/hooks'
import { Button, ErrorNote, Field, Screen, Text } from '../src/ui'

const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/

export default function Pan() {
  const save = useSavePan()
  const [pan, setPan] = useState('')
  const [error, setError] = useState<string | null>(null)
  const valid = PAN.test(pan)

  const submit = async () => {
    setError(null)
    try {
      await save.mutateAsync(pan)
      router.back()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save your PAN. Try again.')
    }
  }

  return (
    <Screen padTop={false} footer={<Button label="Save PAN" onPress={submit} loading={save.isPending} disabled={!valid} />}>
      <Text tone="muted">
        Your PAN is needed once your purchases pass the limit set by the store. It is kept private.
      </Text>
      <Field
        label="PAN"
        value={pan}
        onChangeText={(t) => setPan(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
        autoCapitalize="characters"
        autoFocus
        maxLength={10}
        placeholder="ABCDE1234F"
        error={pan.length === 10 && !valid ? 'Enter a valid 10-character PAN' : null}
      />
      <ErrorNote message={error} />
    </Screen>
  )
}
