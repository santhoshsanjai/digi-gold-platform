import { RefreshControl, StyleSheet, View } from 'react-native'
import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchLedger, LEDGER_PAGE } from '../../src/api/hooks'
import type { LedgerEntry } from '../../src/api/types'
import { formatDateTime, formatGrams, formatInr } from '../../src/format'
import { useTheme } from '../../src/theme/ThemeProvider'
import { Button, EmptyState, List, Screen, Spinner, Text } from '../../src/ui'
import { IconBadge, type IconName } from '../../src/ui/Icon'

const KIND: Record<string, { label: string; icon: IconName; tint: 'success' | 'primary' | 'warning' }> = {
  credit: { label: 'Bought gold', icon: 'plus', tint: 'success' },
  redeem: { label: 'Redeemed in store', icon: 'store', tint: 'primary' },
  refund: { label: 'Refunded', icon: 'refund', tint: 'warning' },
}

export default function History() {
  const q = useInfiniteQuery({
    queryKey: ['ledger'],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchLedger(pageParam),
    getNextPageParam: (last) => (last.offset + LEDGER_PAGE < last.total ? last.offset + LEDGER_PAGE : undefined),
  })
  const entries = q.data?.pages.flatMap((p) => p.items) ?? []

  return (
    <Screen refresh={<RefreshControl refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={() => q.refetch()} />}>
      <Text size="title">History</Text>
      {q.isPending ? (
        <Spinner />
      ) : entries.length === 0 ? (
        <EmptyState icon="receipt" title="No transactions yet" text="Your purchases, redemptions and refunds will be listed here." />
      ) : (
        <>
          <List>
            {entries.map((e, i) => (
              <Entry key={e.id} entry={e} last={i === entries.length - 1} />
            ))}
          </List>
          {q.hasNextPage && <Button variant="secondary" label="Show more" onPress={() => q.fetchNextPage()} loading={q.isFetchingNextPage} />}
        </>
      )}
    </Screen>
  )
}

function Entry({ entry, last }: { entry: LedgerEntry; last: boolean }) {
  const { colors } = useTheme()
  const grams = Number(entry.grams)
  const gain = grams >= 0
  const kind = KIND[entry.kind] ?? { label: entry.kind, icon: 'receipt' as IconName, tint: 'primary' as const }
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: colors.line,
      }}
    >
      <IconBadge name={kind.icon} tint={kind.tint} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '500' }}>{kind.label}</Text>
        <Text size="small" tone="muted">
          {formatDateTime(entry.created_at)}
        </Text>
        {entry.note ? (
          <Text size="small" tone="muted" numberOfLines={2}>
            {entry.note}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontWeight: '600', fontVariant: ['tabular-nums'], color: gain ? colors.success : colors.text }}>
          {gain ? '+' : '−'}
          {formatGrams(Math.abs(grams))}
        </Text>
        {Number(entry.amount_inr) !== 0 && (
          <Text size="small" tone="muted">
            {formatInr(Math.abs(Number(entry.amount_inr)))}
          </Text>
        )}
      </View>
    </View>
  )
}
