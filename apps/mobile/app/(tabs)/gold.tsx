import { useState } from 'react'
import { Pressable, RefreshControl, View } from 'react-native'
import type { Lot } from '../../src/api/types'
import { useLots } from '../../src/api/hooks'
import { daysUntil, formatDate, formatGrams, formatInr } from '../../src/format'
import { useTheme } from '../../src/theme/ThemeProvider'
import { Card, Pill, Row, Screen, Spinner, Text } from '../../src/ui'

type Filter = 'open' | 'redeemed'

export default function Gold() {
  const { colors } = useTheme()
  const [filter, setFilter] = useState<Filter>('open')
  const lots = useLots(filter)

  return (
    <Screen refresh={<RefreshControl refreshing={lots.isRefetching} onRefresh={() => lots.refetch()} />}>
      <Text size="title">My gold</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['open', 'redeemed'] as const).map((f) => (
          <Pressable
            key={f}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === f }}
            onPress={() => setFilter(f)}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: filter === f ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: filter === f ? colors.primary : colors.line,
            }}
          >
            <Text style={{ color: filter === f ? colors.onPrimary : colors.text, fontWeight: '600' }}>
              {f === 'open' ? 'Holding' : 'Redeemed'}
            </Text>
          </Pressable>
        ))}
      </View>
      {lots.isPending ? (
        <Spinner />
      ) : lots.data?.length ? (
        lots.data.map((l) => <LotCard key={l.id} lot={l} />)
      ) : (
        <Card>
          <Text tone="muted">
            {filter === 'open' ? 'No gold yet. Buy from the Home tab and it will appear here.' : 'Nothing redeemed yet.'}
          </Text>
        </Card>
      )}
    </Screen>
  )
}

function LotCard({ lot }: { lot: Lot }) {
  const days = daysUntil(lot.expires_at)
  const open = lot.status === 'open'
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text size="heading">{formatGrams(lot.grams)}</Text>
        {open ? (
          <Pill
            label={days <= 0 ? 'Past validity' : `${days} days left`}
            tone={days <= 0 ? 'danger' : days <= 30 ? 'warning' : 'muted'}
          />
        ) : (
          <Pill label={lot.status === 'redeemed' ? 'Redeemed' : 'Refunded'} tone="success" />
        )}
      </View>
      <Row label="Paid" value={formatInr(lot.amount_inr)} />
      <Row label="Rate" value={`${formatInr(lot.rate_per_gram)} / g (${lot.purity})`} />
      <Row label="Bought on" value={formatDate(lot.paid_at)} />
      {open && <Row label="Valid until" value={formatDate(lot.expires_at)} tone={days <= 30 ? 'warning' : undefined} />}
    </Card>
  )
}
