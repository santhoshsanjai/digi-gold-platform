import type {
  AuditEntry,
  Page,
  PageParams,
  PermissionCatalogue,
  Role,
  RoleIn,
  RoleUpdate,
  SchemeSettings,
  SchemeSettingsIn,
  StaffUser,
  StaffUserCreate,
  StaffUserUpdate,
  Store,
  StoreIn,
  StoreUpdate,
} from '../../api/types.ts'
import { apiSlice } from './apiSlice.ts'

/** Scheme settings, staff users, roles, stores and the activity log. */
export const adminApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    schemeSettings: build.query<SchemeSettings, void>({
      query: () => '/crm/settings',
      providesTags: ['Settings'],
    }),
    saveSchemeSettings: build.mutation<SchemeSettings, SchemeSettingsIn>({
      query: (body) => ({ url: '/crm/settings', method: 'PUT', body }),
      invalidatesTags: ['Settings', 'Rate', 'Dashboard', 'Audit'],
    }),

    users: build.query<Page<StaffUser>, PageParams & { q?: string }>({
      query: (params) => ({ url: '/crm/users', params }),
      providesTags: ['User'],
    }),
    createUser: build.mutation<StaffUser, StaffUserCreate>({
      query: (body) => ({ url: '/crm/users', method: 'POST', body }),
      invalidatesTags: ['User', 'Role'],
    }),
    updateUser: build.mutation<StaffUser, { id: string; body: StaffUserUpdate }>({
      query: ({ id, body }) => ({ url: `/crm/users/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['User', 'Role', 'Me'],
    }),
    resendPassword: build.mutation<void, string>({
      query: (id) => ({ url: `/crm/users/${id}/resend-password`, method: 'POST' }),
      invalidatesTags: ['User'],
    }),

    permissionCatalogue: build.query<PermissionCatalogue, void>({
      query: () => '/crm/permissions',
    }),
    roles: build.query<Role[], void>({
      query: () => '/crm/roles',
      providesTags: ['Role'],
    }),
    createRole: build.mutation<Role, RoleIn>({
      query: (body) => ({ url: '/crm/roles', method: 'POST', body }),
      invalidatesTags: ['Role'],
    }),
    updateRole: build.mutation<Role, { id: string; body: RoleUpdate }>({
      query: ({ id, body }) => ({ url: `/crm/roles/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Role', 'Me'],
    }),
    deleteRole: build.mutation<void, string>({
      query: (id) => ({ url: `/crm/roles/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Role'],
    }),

    stores: build.query<Store[], void>({
      query: () => '/crm/stores',
      providesTags: ['Store'],
    }),
    createStore: build.mutation<Store, StoreIn>({
      query: (body) => ({ url: '/crm/stores', method: 'POST', body }),
      invalidatesTags: ['Store'],
    }),
    updateStore: build.mutation<Store, { id: string; body: StoreUpdate }>({
      query: ({ id, body }) => ({ url: `/crm/stores/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Store'],
    }),

    auditLog: build.query<Page<AuditEntry>, PageParams & { entity_type?: string }>({
      query: (params) => ({ url: '/crm/audit-logs', params }),
      providesTags: ['Audit'],
    }),
  }),
})

export const {
  useSchemeSettingsQuery,
  useSaveSchemeSettingsMutation,
  useUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useResendPasswordMutation,
  usePermissionCatalogueQuery,
  useRolesQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useStoresQuery,
  useCreateStoreMutation,
  useUpdateStoreMutation,
  useAuditLogQuery,
} = adminApi
