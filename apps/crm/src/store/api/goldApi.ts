import type {
  CurrentRates,
  Customer,
  CustomerDetail,
  Dashboard,
  ExpiringLot,
  GoldRate,
  Page,
  PageParams,
  Payment,
  PaymentStatus,
  Purity,
  RateIn,
  RedeemIn,
  Redemption,
  RedemptionSlip,
} from '../../api/types.ts'
import { apiSlice } from './apiSlice.ts'

/** Gold rates, customers, payments, redemptions, expiry and the dashboard. */
export const goldApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    dashboard: build.query<Dashboard, void>({
      query: () => '/crm/dashboard',
      providesTags: ['Dashboard'],
    }),

    currentRates: build.query<CurrentRates, void>({
      query: () => '/crm/rates/current',
      providesTags: ['Rate'],
    }),
    rateHistory: build.query<Page<GoldRate>, PageParams & { purity?: Purity }>({
      query: (params) => ({ url: '/crm/rates', params }),
      providesTags: ['Rate'],
    }),
    publishRate: build.mutation<GoldRate, RateIn>({
      query: (body) => ({ url: '/crm/rates', method: 'POST', body }),
      invalidatesTags: ['Rate', 'Dashboard'],
    }),
    setBuyingPaused: build.mutation<CurrentRates, { paused: boolean; reason?: string }>({
      query: (body) => ({ url: '/crm/rates/pause', method: 'POST', body }),
      invalidatesTags: ['Rate', 'Dashboard'],
    }),

    customers: build.query<Page<Customer>, PageParams & { q?: string }>({
      query: (params) => ({ url: '/crm/customers', params }),
      providesTags: ['Customer'],
    }),
    customer: build.query<CustomerDetail, string>({
      query: (id) => `/crm/customers/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Customer', id }],
    }),
    payments: build.query<
      Page<Payment>,
      PageParams & { status?: PaymentStatus; customer_id?: string }
    >({
      query: (params) => ({ url: '/crm/payments', params }),
      providesTags: ['Payment'],
    }),

    redeem: build.mutation<Redemption, RedeemIn>({
      query: (body) => ({ url: '/crm/redemptions', method: 'POST', body }),
      invalidatesTags: ['Redemption', 'Customer', 'Expiry', 'Dashboard'],
    }),
    redemptions: build.query<Page<Redemption>, PageParams & { customer_id?: string }>({
      query: (params) => ({ url: '/crm/redemptions', params }),
      providesTags: ['Redemption'],
    }),
    redemptionSlip: build.query<RedemptionSlip, string>({
      query: (id) => `/crm/redemptions/${id}/slip`,
    }),

    expiringLots: build.query<
      Page<ExpiringLot>,
      PageParams & { state: 'expired' | 'expiring'; within_days?: number }
    >({
      query: (params) => ({ url: '/crm/expiry', params }),
      providesTags: ['Expiry'],
    }),
    refundLot: build.mutation<void, { lotId: string; note: string }>({
      query: ({ lotId, note }) => ({
        url: `/crm/lots/${lotId}/refund`,
        method: 'POST',
        body: { note },
      }),
      invalidatesTags: ['Expiry', 'Customer', 'Dashboard'],
    }),
  }),
})

export const {
  useDashboardQuery,
  useCurrentRatesQuery,
  useRateHistoryQuery,
  usePublishRateMutation,
  useSetBuyingPausedMutation,
  useCustomersQuery,
  useCustomerQuery,
  usePaymentsQuery,
  useRedeemMutation,
  useRedemptionsQuery,
  useRedemptionSlipQuery,
  useExpiringLotsQuery,
  useRefundLotMutation,
} = goldApi
