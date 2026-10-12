import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { router } from 'expo-router'
import { ApiError } from '../src/api/client'
import { useCreateOrder, useMe, useRate } from '../src/api/hooks'
import { formatGrams, formatInr, formatInrWhole } from '../src/format'
import { useTheme } from '../src/theme/ThemeProvider'
import { Button, Card, ErrorNote, Field, Screen, Spinner, Text } from '../src/ui'

const QUICK = [500, 1000, 2000, 5000]

export default function Buy() {
  const { colors } = useTheme()
  const rate = useRate()
  const me = useMe()
  const create = useCreateOrder()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (rate.isPending) {
    return (
      <Screen padTop={false}>
        <Spinner />
      </Screen>
    )
  }
  const r = rate.data
  if (!r) {
    return (
      <Screen padTop={false}>
        <ErrorNote message="Could not load today's rate." />
        <Button label="Try again" onPress={() => rate.refetch()} />
      </Screen>
    )
  }

  const amount = Number(text)
  const min = Number(r.min_payment_inr)
  const max = Number(r.max_payment_inr)
  const perGram = Number(r.rate_per_gram)
  const outOfRange = text !== '' && (amount < min || amount > max)
  // Part of an earlier payment too small for a whole milligram stays as a balance and is added here.
  const carried = Number(me.data?.rupee_balance_inr ?? 0)
  const estimate = amount > 0 && perGram > 0 ? Math.floor(((amount + carried) / perGram) * 10_000) / 10_000 : null
  const canBuy = r.buying_open && amount >= min && amount <= max

  const submit = async () => {
    setError(null)
    try {
      const order = await create.mutateAsync(amount)
      router.replace({ pathname: '/checkout', params: { orderId: order.id } })
    } catch (e) {
      if (e instanceof ApiError && e.code === 'pan_required') {
        router.push('/pan')
        setError('Add your PAN to continue buying, then come back and try again.')
      } else {
        setError(e instanceof ApiError ? e.message : 'Could not start the payment. Try again.')
      }
    }
  }

  return (
    <Screen
      padTop={false}
      footer={
        <>
          <Button label={canBuy ? `Continue to pay ${formatInr(amount)}` : 'Continue'} onPress={submit} loading={create.isPending} disabled={!canBuy} />
          <Text size="small" tone="muted" style={{ textAlign: 'center' }}>
            The rate is held for {r.price_lock_minutes} minutes once you continue.
          </Text>
        </>
      }
    >
      <Card>
        <Text tone="muted" size="small">
          Today&apos;s {r.purity} rate
        </Text>
        <Text size="title">{r.rate_per_gram ? `${formatInr(r.rate_per_gram)} / g` : 'Not published'}</Text>
        {!r.buying_open && <Text tone="warning">{r.reason}</Text>}
      </Card>

      <Field
        label="Amount"
        prefix="₹"
        value={text}
        onChangeText={(t) => setText(t.replace(/[^\d]/g, '').slice(0, 7))}
        keyboardType="number-pad"
        autoFocus
        placeholder="2000"
        hint={`Between ${formatInrWhole(min)} and ${formatInrWhole(max)}`}
        error={outOfRange ? `Enter an amount between ${formatInrWhole(min)} and ${formatInrWhole(max)}` : null}
      />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {QUICK.filter((q) => q >= min && q <= max).map((q) => (
          <Pressable
            key={q}
            accessibilityRole="button"
            onPress={() => setText(String(q))}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: amount === q ? colors.primary : colors.line,
              backgroundColor: amount === q ? colors.primarySoft : colors.surface,
            }}
          >
            <Text style={{ fontWeight: '600' }}>{formatInrWhole(q)}</Text>
          </Pressable>
        ))}
      </View>

      {estimate !== null && !outOfRange && (
        <Card tone="success">
          <Text tone="muted" size="small">
            You will get about
          </Text>
          <Text size="title">{formatGrams(estimate)}</Text>
          <Text size="small" tone="muted">
            The exact grams are confirmed when you pay, at the rate held for you.
          </Text>
        </Card>
      )}
      <ErrorNote message={error} />
    </Screen>
  )
}
