import { router, useLocalSearchParams } from 'expo-router'
import { ApiError } from '../src/api/client'
import { useOrder, useRate, useTestOutcome } from '../src/api/hooks'
import { formatGrams, formatInr } from '../src/format'
import { clock, useCountdown } from '../src/useCountdown'
import { Button, Card, ErrorNote, Row, Screen, Spinner, Text } from '../src/ui'
import { useToast } from '../src/ui/toast'

/**
 * Practice checkout. While the client has no payment gateway, three buttons stand in for it:
 * pay, fail and leave pending. The same screen will hand over to Razorpay later.
 */
export default function Checkout() {
  const { orderId = '' } = useLocalSearchParams<{ orderId: string }>()
  const order = useOrder(orderId)
  const rate = useRate()
  const outcome = useTestOutcome(orderId)
  const toast = useToast()
  const left = useCountdown(order.data?.status === 'created' ? order.data.lock_expires_at : undefined)

  if (order.isPending) {
    return (
      <Screen padTop={false}>
        <Spinner />
      </Screen>
    )
  }
  const o = order.data
  if (!o) {
    return (
      <Screen padTop={false}>
        <ErrorNote message="Could not load this payment." />
        <Button label="Back to home" onPress={() => router.dismissTo('/(tabs)')} />
      </Screen>
    )
  }

  const choose = async (value: 'success' | 'failure' | 'pending') => {
    try {
      await outcome.mutateAsync(value)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Something went wrong. Try again.')
    }
  }

  if (o.status === 'paid') {
    return (
      <Screen
        padTop={false}
        footer={<Button label="Done" onPress={() => router.dismissTo('/(tabs)')} />}
      >
        <Card tone="success">
          <Text size="heading" tone="success">
            Payment successful
          </Text>
          <Text size="title">{formatGrams(o.credited_grams ?? o.quoted_grams)} added</Text>
          <Text tone="muted">{formatInr(o.amount_inr)} paid</Text>
        </Card>
        {o.repriced && (
          <Card tone="warning">
            <Text>
              The held rate ended before payment finished, so your gold was calculated at the latest rate.
            </Text>
          </Card>
        )}
      </Screen>
    )
  }

  if (o.status === 'failed') {
    return (
      <Screen
        padTop={false}
        footer={
          <>
            <Button label="Try again" onPress={() => router.replace('/buy')} />
            <Button variant="secondary" label="Back to home" onPress={() => router.dismissTo('/(tabs)')} />
          </>
        }
      >
        <Card tone="danger">
          <Text size="heading" tone="danger">
            Payment failed
          </Text>
          <Text>{o.failure_reason || 'The payment did not go through. No money was taken.'}</Text>
        </Card>
      </Screen>
    )
  }

  if (o.status === 'pending') {
    return (
      <Screen padTop={false} footer={<Button label="Back to home" onPress={() => router.dismissTo('/(tabs)')} />}>
        <Card tone="warning">
          <Text size="heading" tone="warning">
            Payment pending
          </Text>
          <Text>We are waiting for the bank to confirm. Your gold is added as soon as it does.</Text>
        </Card>
      </Screen>
    )
  }

  const testMode = rate.data?.test_payments ?? true
  return (
    <Screen
      padTop={false}
      footer={
        testMode ? (
          <>
            <Button label={`Pay ${formatInr(o.amount_inr)}`} onPress={() => choose('success')} loading={outcome.isPending} />
            <Button variant="danger" label="Make the payment fail" onPress={() => choose('failure')} disabled={outcome.isPending} />
            <Button variant="secondary" label="Leave it pending" onPress={() => choose('pending')} disabled={outcome.isPending} />
          </>
        ) : null
      }
    >
      <Card>
        <Row label="Amount" value={formatInr(o.amount_inr)} />
        <Row label={`Rate (${o.purity})`} value={`${formatInr(o.rate_per_gram)} / g`} />
        <Row label="You get" value={formatGrams(o.quoted_grams)} />
        <Text size="small" tone={left > 0 ? 'muted' : 'warning'}>
          {left > 0
            ? `Rate held for ${clock(left)}`
            : 'The held rate has ended. If you pay now, your gold is calculated at the latest rate.'}
        </Text>
      </Card>
      {testMode && (
        <Card tone="warning">
          <Text size="heading" tone="warning">
            Practice payment
          </Text>
          <Text>No money moves. Choose how this payment should end to see each result.</Text>
        </Card>
      )}
    </Screen>
  )
}
