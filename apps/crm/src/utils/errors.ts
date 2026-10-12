import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import type { SerializedError } from '@reduxjs/toolkit'

type ApiErrorBody = {
  detail?: string | { msg: string; loc?: (string | number)[] }[]
  code?: string
  [key: string]: unknown
}

export function errorBody(error: unknown): ApiErrorBody | undefined {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as FetchBaseQueryError).data
    if (data && typeof data === 'object') return data as ApiErrorBody
  }
  return undefined
}

export function errorStatus(error: unknown): number | string | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as FetchBaseQueryError).status
  }
  return undefined
}

/** A sentence a staff member can act on, from any RTK Query error. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  const body = errorBody(error)
  const detail = body?.detail
  if (typeof detail === 'string') return capitalise(detail)
  if (Array.isArray(detail) && detail.length) {
    return detail.map((d) => capitalise(d.msg.replace(/^Value error, /, ''))).join('. ')
  }
  const status = errorStatus(error)
  if (status === 'FETCH_ERROR') return 'Cannot reach the server. Check your connection.'
  if (status === 403) return 'You do not have permission to do this.'
  return (error as SerializedError | undefined)?.message || fallback
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
