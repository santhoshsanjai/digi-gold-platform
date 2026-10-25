import { Pressable, RefreshControl, Text as RNText, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { ApiError } from '../../src/api/client'
import { useLots, useMe, useRate } from '../../src/api/hooks'
import { daysUntil, formatDate, formatDateTime, formatGrams, formatInr } from '../../src/format'
import { useTheme } from '../../src/theme/ThemeProvider'
import { Button, Card, ErrorNote, Pill, Progress, Screen, Spinner, Text } from '../../src/ui'
import { FadeIn, gold } from '../../src/ui/gold'
import { Icon, IconBadge, type IconName } from '../../src/ui/Icon'

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
      <FadeIn style={{ gap: 2 }}>
        <Text tone="muted">{name}</Text>
        <Text size="title">{hello}</Text>
      </FadeIn>

      <FadeIn delay={60}>
        <View style={{ borderRadius: 16, padding: 20, gap: 4, backgroundColor: gold.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <RNText style={{ color: gold.muted, fontSize: 14, fontWeight: '500' }}>Gold balance</RNText>
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(217,180,90,0.14)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="coins" color={gold.accent} size={18} />
            </View>
          </View>
          <RNText
            accessibilityLabel={`${grams.toFixed(4)} grams of gold`}
            style={{ color: gold.text, fontSize: 34, lineHeight: 40, fontWeight: '700', fontVariant: ['tabular-nums'] }}
          >
            {formatGrams(grams)}
          </RNText>
          <RNText style={{ color: gold.accent, fontSize: 15, fontWeight: '500' }}>
            {value !== null ? `Worth ${formatInr(value)} at today's rate` : "Today's rate is not published yet"}
          </RNText>
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: gold.line, marginVertical: 12 }} />
          <View style={{ flexDirection: 'row' }}>
            <MiniStat icon="wallet" label="Total paid" value={formatInr(m.total_paid_inr)} />
            <MiniStat icon="receipt" label="Open lots" value={String(m.open_lots)} />
          </View>
          {Number(m.rupee_balance_inr) > 0 && (
            <RNText style={{ color: gold.muted, fontSize: 13, marginTop: 8 }}>
              {formatInr(m.rupee_balance_inr)} is waiting to be added to your next purchase
            </RNText>
          )}
        </View>
      </FadeIn>

      <FadeIn delay={100} style={{ flexDirection: 'row', gap: 12 }}>
        <QuickAction icon="plus" label="Buy gold" onPress={() => router.push('/buy')} disabled={!r.buying_open} />
        <QuickAction icon="qr" label="Redeem" onPress={() => router.push('/redeem')} disabled={!m.can_redeem || settling} />
        <QuickAction icon="receipt" label="History" onPress={() => router.push('/history')} />
      </FadeIn>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconBadge name="trend" />
          <View style={{ flex: 1 }}>
            <Text tone="muted" style={{ fontSize: 14, fontWeight: '500' }}>
              Today&apos;s {r.purity} rate
            </Text>
            {!!r.updated_at && (
              <Text size="small" tone="muted">
                Updated {formatDateTime(r.updated_at)}
              </Text>
            )}
          </View>
          <Pill label={r.buying_open ? 'Buying open' : 'Buying closed'} tone={r.buying_open ? 'success' : 'warning'} />
        </View>
        <Text size="title">{r.rate_per_gram ? `${formatInr(r.rate_per_gram)} / g` : 'Not published'}</Text>
        {!r.buying_open && r.reason ? <Text tone="warning">{r.reason}</Text> : null}
        <Button label="Buy gold" onPress={() => router.push('/buy')} disabled={!r.buying_open} />
      </Card>

      {expiryDays !== null && expiryDays <= 60 && (
        <Card tone={expiryDays <= 7 ? 'danger' : 'warning'} style={{ flexDirection: 'row', gap: 12 }}>
          <IconBadge name="clock" tint={expiryDays <= 7 ? 'danger' : 'warning'} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text size="heading" tone={expiryDays <= 7 ? 'danger' : 'warning'}>
              {expiryDays <= 0 ? 'Some of your gold has passed its validity' : `Some of your gold is valid for ${expiryDays} more days`}
            </Text>
            <Text>Visit the store to redeem it before {formatDate(m.next_expiry_at!)}.</Text>
          </View>
        </Card>
      )}

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconBadge name="store" />
          <Text size="heading">Redeem in store</Text>
        </View>
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

function MiniStat({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Icon name={icon} color={gold.muted} size={16} />
      <View>
        <RNText style={{ color: gold.muted, fontSize: 12 }}>{label}</RNText>
        <RNText style={{ color: gold.text, fontSize: 15, fontWeight: '600' }}>{value}</RNText>
      </View>
    </View>
  )
}

/** A square shortcut with an icon and a short label. */
function QuickAction({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 16,
        backgroundColor: colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.line,
        opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
      })}
    >
      <IconBadge name={icon} size={40} />
      <Text style={{ fontSize: 14, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  )
}