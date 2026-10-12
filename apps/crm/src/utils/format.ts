import dayjs from 'dayjs'

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

type Numeric = string | number | null | undefined

/** Amounts arrive as decimal strings; they are only formatted here, never added up. */
export const formatInr = (value: Numeric): string =>
  value === null || value === undefined || value === '' ? '—' : inr.format(Number(value))

export const formatGrams = (value: Numeric): string =>
  value === null || value === undefined || value === ''
    ? '—'
    : `${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 4 })} g`

export const formatPct = (value: Numeric): string =>
  value === null || value === undefined || value === '' ? '—' : `${Number(value).toFixed(2)}%`

export const formatDate = (value: string | null | undefined): string =>
  value ? dayjs(value).format('DD MMM YYYY') : '—'

export const formatDateTime = (value: string | null | undefined): string =>
  value ? dayjs(value).format('DD MMM YYYY, hh:mm A') : '—'
