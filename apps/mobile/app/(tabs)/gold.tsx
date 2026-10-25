import { useState } from 'react'
import { Pressable, RefreshControl, View } from 'react-native'
import { router } from 'expo-router'
import type { Lot } from '../../src/api/types'
import { useLots, useMe } from '../../src/api/hooks'
import { daysUntil, formatDate, formatGrams, formatInr } from '../../src/format'
import { useTheme } from '../../src/theme/ThemeProvider'
import { Button, Card, EmptyState, Pill, Row, Screen, Spinner, Text } from '../../src/ui'
import { IconBadge } from '../../src/ui/Icon'

type Filter = 'open' | 'redeemed'

export default function Gold() {
  const { colors } = useTheme()
  const [filter, setFilter] = useState<Filter>('open')
  const lots = useLots(filter)
  const me = useMe()

  return (
    <Screen refresh={<RefreshControl refreshing={lots.isRefetching} onRefresh={() => Promise.all([lots.refetch(), me.refetch()])} />}>
      <Text size="title">My gold</Text>

      {me.data && (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <IconBadge name="coins" size={44} />
          <View style={{ flex: 1 }}>
            <Text size="small" tone="muted">
              Total holding
            </Text>
            <Text size="title">{formatGrams(me.data.gold_grams)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text size="small" tone="muted">
              Open lots
            </Text>
            <Text size="heading">{me.data.open_lots}</Text>
          </View>
        </Card>
      )}

      {/* Segmented control, as in the phone's own apps. */}
      <View style={{ flexDirection: 'row', padding: 4, borderRadius: 12, backgroundColor: colors.line }}>
        {(['open', 'redeemed'] as const).map((f) => (
          <Pressable
            key={f}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === f }}
            onPress={() => setFilter(f)}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: 9,
              borderRadius: 9,
              backgroundColor: filter === f ? colors.surface : 'transparent',
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: filter === f ? '600' : '500', color: filter === f ? colors.text : colors.muted }}>
              {f === 'open' ? 'Holding' : 'Redeemed'}
            </Text>
          </Pressable>
        ))}
      </View>

      {lots.isPending ? (
        <Spinner />
      ) : lots.data?.length ? (
        lots.data.map((l) => <LotCard key={l.id} lot={l} />)
      ) : filter === 'open' ? (
        <EmptyState
          icon="coins"
          title="No gold yet"
          text="Gold you buy appears here, with its rate and how long it stays valid."
          action={
            <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
              <Button label="Buy gold" onPress={() => router.push('/buy')} />
            </View>
          }
        />
      ) : (
        <EmptyState icon="store" title="Nothing redeemed yet" text="Gold you redeem for jewellery in the store is listed here." />
      )}
    </Screen>
  )
}

function LotCard({ lot }: { lot: Lot }) {
  const days = daysUntil(lot.expires_at)
  const open = lot.status === 'open'
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <IconBadge name={open ? 'coins' : 'store'} tint={open ? 'primary' : 'success'} />
        <View style={{ flex: 1 }}>
          <Text size="heading">{formatGrams(lot.grams)}</Text>
          <Text size="small" tone="muted">
            {lot.purity} gold · bought {formatDate(lot.paid_at)}
          </Text>
        </View>
        {open ? (
          <Pill
            label={days <= 0 ? 'Past validity' : `${days} days left`}
            tone={days <= 0 ? 'danger' : days <= 30 ? 'warning' : 'muted'}
          />
        ) : (
          <Pill label={lot.status === 'redeemed' ? 'Redeemed' : 'Refunded'} tone="success" />
        )}
      </View>
      <Row icon="wallet" label="Paid" value={formatInr(lot.amount_inr)} />
      <Row icon="trend" label="Rate" value={`${formatInr(lot.rate_per_gram)} / g`} />
      {open && <Row icon="clock" label="Valid until" value={formatDate(lot.expires_at)} tone={days <= 30 ? 'warning' : undefined} />}
    </Card>
  )
}
