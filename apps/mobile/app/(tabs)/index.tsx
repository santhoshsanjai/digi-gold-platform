import { RefreshControl, Text as RNText, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { ApiError } from '../../src/api/client'
import { useLots, useMe, useRate } from '../../src/api/hooks'
import { daysUntil, formatDate, formatDateTime, formatGrams, formatInr } from '../../src/format'
import { useTheme } from '../../src/theme/ThemeProvider'
import { Button, Card, ErrorNote, Eyebrow, Pill, Progress, Screen, serif, Spinner, Text } from '../../src/ui'
import { FadeIn, gold, GoldBackdrop, GoldCoinFace } from '../../src/ui/gold'

export default function Home() {
  const { name } = useTheme()
  const me = useMe()
  const rate = useRate()
  const lots = useLots('open')
  const refetch = () => Promise.all([me.refetch(), rate.refetch(), lots.refetch()])

  if (me.isPending || rate.isPending) {
    return (
      <Screen>
        <Spinner />
      </Screen>
    )
  }
  if (!me.data || !rate.data) {
    const e = me.error ?? rate.error
    return (
      <Screen>
        <ErrorNote message={e instanceof ApiError ? e.message : 'Could not load your account.'} />
        <Button label="Try again" onPress={refetch} />
      </Screen>
    )
  }

  const m = me.data
  const r = rate.data
  const grams = Number(m.gold_grams)
  const value = r.rate_per_gram ? grams * Number(r.rate_per_gram) : null
  const threshold = Number(m.redemption_threshold_grams)
  const expiryDays = m.next_expiry_at ? daysUntil(m.next_expiry_at) : null
  // Stores redeem everything at once, so one recent payment holds back the whole balance.
  const settlesOn = (lots.data ?? []).map((l) => l.redeemable_at).sort().at(-1)
  const settling = !!settlesOn && daysUntil(settlesOn) > 0
  const hello = m.name ? `Hello, ${m.name.split(' ')[0]}` : `Welcome to ${name}`

  return (
    <Screen
      refresh={<RefreshControl refreshing={me.isRefetching || rate.isRefetching} onRefresh={refetch} />}
    >
      <FadeIn style={{ gap: 4 }}>
        <Eyebrow>{name.toUpperCase()}</Eyebrow>
        <Text size="title">{hello}</Text>
      </FadeIn>

      <FadeIn delay={60}>
        <View style={{ borderRadius: 22, overflow: 'hidden', padding: 22, gap: 6, backgroundColor: gold.bg }}>
          <GoldBackdrop glowY={0.1} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <RNText style={{ color: gold.accent, fontSize: 11, fontWeight: '600', letterSpacing: 1.8 }}>YOUR GOLD</RNText>
            <GoldCoinFace size={40} initial={name.slice(0, 1).toUpperCase()} />
          </View>
          <RNText
            accessibilityLabel={`${grams.toFixed(4)} grams of gold`}
            style={{ color: gold.text, fontFamily: serif, fontSize: 40, lineHeight: 46, fontWeight: '600', fontVariant: ['tabular-nums'] }}
          >
            {formatGrams(grams)}
          </RNText>
          <RNText style={{ color: gold.light, fontSize: 15 }}>
            {value !== null ? `Worth ${formatInr(value)} at today's rate` : "Today's rate is not published yet"}
          </RNText>
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: gold.line, marginVertical: 8 }} />
          <RNText style={{ color: gold.muted, fontSize: 13 }}>You have paid {formatInr(m.total_paid_inr)} in total</RNText>
          {Number(m.rupee_balance_inr) > 0 && (
            <RNText style={{ color: gold.muted, fontSize: 13 }}>
              {formatInr(m.rupee_balance_inr)} is waiting to be added to your next purchase
            </RNText>
          )}
        </View>
      </FadeIn>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Eyebrow>TODAY&apos;S {r.purity} RATE</Eyebrow>
          <Pill label={r.buying_open ? 'Buying open' : 'Buying closed'} tone={r.buying_open ? 'success' : 'warning'} />
        </View>
        <Text size="title">{r.rate_per_gram ? `${formatInr(r.rate_per_gram)} / g` : 'Not published'}</Text>
        {!!r.updated_at && (
          <Text size="small" tone="muted">
            Updated {formatDateTime(r.updated_at)}
          </Text>
        )}
        {!r.buying_open && r.reason ? <Text tone="warning">{r.reason}</Text> : null}
        <Button label="Buy gold" onPress={() => router.push('/buy')} disabled={!r.buying_open} />
      </Card>

      {expiryDays !== null && expiryDays <= 60 && (
        <Card tone={expiryDays <= 7 ? 'danger' : 'warning'}>
          <Text size="heading" tone={expiryDays <= 7 ? 'danger' : 'warning'}>
            {expiryDays <= 0 ? 'Some of your gold has passed its validity' : `Some of your gold is valid for ${expiryDays} more days`}
          </Text>
          <Text>Visit the store to redeem it before {formatDate(m.next_expiry_at!)}.</Text>
        </Card>
      )}

      <Card>
        <Text size="heading">Redeem in store</Text>
        {m.can_redeem && settling ? (
          <Text tone="muted">
            Your recent payments are still settling. You can redeem all your gold from {formatDate(settlesOn)}.
          </Text>
        ) : m.can_redeem ? (
          <>
            <Text tone="muted">You can redeem all your gold at the store. Show the code to the staff.</Text>
            <Button label="Get redemption code" onPress={() => router.push('/redeem')} />
          </>
        ) : (
          <>
            <Text tone="muted">
              Redeem once you reach {formatGrams(threshold)}. You have {formatGrams(grams)}.
            </Text>
            <Progress value={threshold > 0 ? grams / threshold : 0} />
          </>
        )}
      </Card>
    </Screen>
  )
}
