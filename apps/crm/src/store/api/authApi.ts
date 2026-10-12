import type { Me, PasswordChangeRequired, PublicConfig, TokensOut } from '../../api/types.ts'
import { TENANT_SLUG } from '../../config/tenant.ts'
import { apiSlice } from './apiSlice.ts'

export const authApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    publicConfig: build.query<PublicConfig, void>({
      query: () => `/public/tenants/${TENANT_SLUG}/config`,
    }),
    login: build.mutation<TokensOut | PasswordChangeRequired, { email: string; password: string }>(
      { query: (body) => ({ url: '/auth/login', method: 'POST', body: { ...body, tenant: TENANT_SLUG } }) },
    ),
    firstLogin: build.mutation<TokensOut, { password_change_token: string; new_password: string }>({
      query: (body) => ({ url: '/auth/first-login', method: 'POST', body }),
    }),
    logout: build.mutation<void, { refresh_token: string }>({
      query: (body) => ({ url: '/auth/logout', method: 'POST', body }),
    }),
    forgotPassword: build.mutation<void, { email: string }>({
      query: (body) => ({
        url: '/auth/forgot-password',
        method: 'POST',
        body: { ...body, tenant: TENANT_SLUG },
      }),
    }),
    resetPassword: build.mutation<void, { token: string; new_password: string }>({
      query: (body) => ({ url: '/auth/reset-password', method: 'POST', body }),
    }),
    changePassword: build.mutation<void, { current_password: string; new_password: string }>({
      query: (body) => ({ url: '/auth/change-password', method: 'POST', body }),
    }),
    me: build.query<Me, void>({
      query: () => '/auth/me',
      providesTags: ['Me'],
    }),
  }),
})

export const {
  usePublicConfigQuery,
  useLoginMutation,
  useFirstLoginMutation,
  useLogoutMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useChangePasswordMutation,
  useMeQuery,
} = authApi
