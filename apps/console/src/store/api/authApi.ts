import type { Me, PasswordChangeRequired, TokensOut } from '../../api/types.ts'
import { apiSlice } from './apiSlice.ts'

/** Platform admins sign in without a client (no tenant). */
export const authApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<TokensOut | PasswordChangeRequired, { email: string; password: string }>(
      { query: (body) => ({ url: '/auth/login', method: 'POST', body }) },
    ),
    firstLogin: build.mutation<TokensOut, { password_change_token: string; new_password: string }>({
      query: (body) => ({ url: '/auth/first-login', method: 'POST', body }),
    }),
    logout: build.mutation<void, { refresh_token: string }>({
      query: (body) => ({ url: '/auth/logout', method: 'POST', body }),
    }),
    forgotPassword: build.mutation<void, { email: string }>({
      query: (body) => ({ url: '/auth/forgot-password', method: 'POST', body }),
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
  useLoginMutation,
  useFirstLoginMutation,
  useLogoutMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useChangePasswordMutation,
  useMeQuery,
} = authApi
