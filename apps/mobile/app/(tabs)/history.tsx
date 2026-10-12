import { RefreshControl, View } from 'react-native'
import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchLedger, LEDGER_PAGE } from '../../src/api/hooks'
import type { LedgerEntry } from '../../src/api/types'
import { formatDateTime, formatGrams, formatInr } from '../../src/format'
import { Button, Card, Screen, Spinner, Text } from '../../src/ui'

const KIND: Record<string, string> = {
  credit: 'Bought gold',
  redeem: 'Redeemed in store',
  refund: 'Refunded',
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
        <Card>
          <Text tone="muted">Your purchases and redemptions will be listed here.</Text>
        </Card>
      ) : (
        <>
          {entries.map((e) => (
            <Entry key={e.id} entry={e} />
          ))}
          {q.hasNextPage && <Button variant="secondary" label="Show more" onPress={() => q.fetchNextPage()} loading={q.isFetchingNextPage} />}
        </>
      )}
    </Screen>
  )
}

function Entry({ entry }: { entry: LedgerEntry }) {
  const grams = Number(entry.grams)
  const gain = grams >= 0
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flexShrink: 1 }}>
          <Text size="heading">{KIND[entry.kind] ?? entry.kind}</Text>
          <Text size="small" tone="muted">
            {formatDateTime(entry.created_at)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text size="heading" tone={gain ? 'success' : 'normal'}>
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
      {entry.note ? <Text size="small" tone="muted">{entry.note}</Text> : null}
    </Card>
  )
}
