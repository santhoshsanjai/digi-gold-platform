import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react'
import { API_BASE_URL } from '../../config/env.ts'
import { refreshSession } from '../session.ts'

interface StateWithAuth {
  auth: { accessToken: string | null }
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as StateWithAuth).auth.accessToken
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return headers
  },
})

// Endpoints that work without signing in; a 401 from them is a real answer.
const PUBLIC_AUTH = /^\/auth\/(login|first-login|refresh|logout|forgot-password|reset-password)$/

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  let result = await rawBaseQuery(args, api, extraOptions)
  const url = typeof args === 'string' ? args : args.url
  if (result.error?.status === 401 && !PUBLIC_AUTH.test(url)) {
    if (await refreshSession(api.dispatch)) {
      result = await rawBaseQuery(args, api, extraOptions)
    }
  }
  return result
}

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Me', 'Tenant', 'Website', 'SitePage', 'Media'],
  endpoints: () => ({}),
})
