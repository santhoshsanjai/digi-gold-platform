import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { LedgerEntry, Lot, Me, Order, Page, Rate, RedemptionCode } from './types'

export const useMe = () => useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/app/me') })

export const useRate = () =>
  useQuery({ queryKey: ['rate'], queryFn: () => api<Rate>('/app/rate'), refetchInterval: 60_000 })

export const useLots = (status: 'open' | 'redeemed' | 'refunded') =>
  useQuery({ queryKey: ['lots', status], queryFn: () => api<Lot[]>(`/app/lots?status=${status}`) })

export const LEDGER_PAGE = 20
export const fetchLedger = (offset: number) =>
  api<Page<LedgerEntry>>(`/app/ledger?limit=${LEDGER_PAGE}&offset=${offset}`)

export const useOrder = (id: string) =>
  useQuery({ queryKey: ['order', id], queryFn: () => api<Order>(`/app/orders/${id}`) })

/** Anything that changes the balance refreshes the screens that show it. */
export function useRefreshBalances() {
  const qc = useQueryClient()
  return () =>
    Promise.all(
      ['me', 'lots', 'ledger', 'rate'].map((key) => qc.invalidateQueries({ queryKey: [key] })),
    )
}

export const useCreateOrder = () =>
  useMutation({
    mutationFn: (amount_inr: number) =>
      api<Order>('/app/orders', { method: 'POST', body: { amount_inr: amount_inr.toFixed(2) } }),
  })

export const useTestOutcome = (orderId: string) => {
  const qc = useQueryClient()
  const refresh = useRefreshBalances()
  return useMutation({
    mutationFn: (outcome: 'success' | 'failure' | 'pending') =>
      api<Order>(`/app/orders/${orderId}/test-outcome`, { method: 'POST', body: { outcome } }),
    onSuccess: async (order) => {
      qc.setQueryData(['order', orderId], order)
      await refresh()
    },
  })
}

export const useRedemptionCode = () =>
  useMutation({ mutationFn: () => api<RedemptionCode>('/app/redemption-code', { method: 'POST' }) })

export const useUpdateProfile = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name?: string; email?: string; current_password?: string }) =>
      api<void>('/app/me', { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  })
}

export const useSavePan = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (pan: string) => api<void>('/app/me/pan', { method: 'POST', body: { pan } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  })
}
