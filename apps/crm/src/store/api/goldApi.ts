import type {
  CollectionsReport,
  CurrentRates,
  Customer,
  CustomerDetail,
  Dashboard,
  ExpiringLot,
  GoldRate,
  HoldingsReport,
  Page,
  PageParams,
  Payment,
  PaymentStatus,
  Purity,
  RateIn,
  RedeemIn,
  Redemption,
  RedemptionsReport,
  RedemptionSlip,
  ReportRange,
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
    /** Emails the customer a temporary app password; staff never see it. */
    sendCustomerTempPassword: build.mutation<{ sent_to: string }, string>({
      query: (id) => ({ url: `/crm/customers/${id}/send-temp-password`, method: 'POST' }),
      invalidatesTags: (_r, _e, id) => [{ type: 'Customer', id }],
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

    collectionsReport: build.query<CollectionsReport, ReportRange>({
      query: (params) => ({ url: '/crm/reports/collections', params }),
    }),
    redemptionsReport: build.query<
      RedemptionsReport,
      ReportRange & { group_by: 'day' | 'store' }
    >({
      query: (params) => ({ url: '/crm/reports/redemptions', params }),
    }),
    holdingsReport: build.query<HoldingsReport, void>({
      query: () => '/crm/reports/holdings',
    }),
    /** A report as CSV text, fetched with the same sign-in as the screens. */
    reportCsv: build.query<string, { report: string; params: Record<string, string> }>({
      query: ({ report, params }) => ({
        url: `/crm/reports/${report}`,
        params: { ...params, format: 'csv' },
        responseHandler: (r) => r.text(),
      }),
      keepUnusedDataFor: 0,
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
  useSendCustomerTempPasswordMutation,
  usePaymentsQuery,
  useRedeemMutation,
  useRedemptionsQuery,
  useRedemptionSlipQuery,
  useCollectionsReportQuery,
  useRedemptionsReportQuery,
  useHoldingsReportQuery,
  useLazyReportCsvQuery,
  useExpiringLotsQuery,
  useRefundLotMutation,
} = goldApi
