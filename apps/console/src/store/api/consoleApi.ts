import type {
  Branding,
  Features,
  MediaAsset,
  Page,
  PageParams,
  SitePage,
  SitePageCreate,
  SitePageSummary,
  SitePageUpdate,
  Tenant,
  TenantCreate,
  TenantUpdate,
  WebsiteSettings,
} from '../../api/types.ts'
import { apiSlice } from './apiSlice.ts'

type Id = { tenantId: string }
const PAGE_LIST = { type: 'SitePage' as const, id: 'LIST' }

/** Clients, their branding and features, website content and images. */
export const consoleApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    tenants: build.query<Page<Tenant>, PageParams>({
      query: (params) => ({ url: '/console/tenants', params }),
      providesTags: ['Tenant'],
    }),
    tenant: build.query<Tenant, string>({
      query: (id) => `/console/tenants/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Tenant', id }],
    }),
    createTenant: build.mutation<Tenant, TenantCreate>({
      query: (body) => ({ url: '/console/tenants', method: 'POST', body }),
      invalidatesTags: ['Tenant'],
    }),
    updateTenant: build.mutation<Tenant, Id & { body: TenantUpdate }>({
      query: ({ tenantId, body }) => ({ url: `/console/tenants/${tenantId}`, method: 'PATCH', body }),
      invalidatesTags: ['Tenant'],
    }),
    saveBranding: build.mutation<Tenant, Id & { body: Branding }>({
      query: ({ tenantId, body }) => ({
        url: `/console/tenants/${tenantId}/branding`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Tenant'],
    }),
    saveFeatures: build.mutation<Tenant, Id & { body: Features }>({
      query: ({ tenantId, body }) => ({
        url: `/console/tenants/${tenantId}/features`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Tenant'],
    }),

    website: build.query<WebsiteSettings, string>({
      query: (tenantId) => `/console/tenants/${tenantId}/website`,
      providesTags: (_r, _e, id) => [{ type: 'Website', id }],
    }),
    saveWebsite: build.mutation<WebsiteSettings, Id & { body: WebsiteSettings }>({
      query: ({ tenantId, body }) => ({
        url: `/console/tenants/${tenantId}/website`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_r, _e, { tenantId }) => [{ type: 'Website', id: tenantId }],
    }),

    sitePages: build.query<SitePageSummary[], string>({
      query: (tenantId) => `/console/tenants/${tenantId}/pages`,
      providesTags: [PAGE_LIST],
    }),
    sitePage: build.query<SitePage, Id & { pageId: string }>({
      query: ({ tenantId, pageId }) => `/console/tenants/${tenantId}/pages/${pageId}`,
      providesTags: (_r, _e, { pageId }) => [{ type: 'SitePage', id: pageId }],
    }),
    createSitePage: build.mutation<SitePage, Id & { body: SitePageCreate }>({
      query: ({ tenantId, body }) => ({
        url: `/console/tenants/${tenantId}/pages`,
        method: 'POST',
        body,
      }),
      invalidatesTags: [PAGE_LIST],
    }),
    updateSitePage: build.mutation<SitePage, Id & { pageId: string; body: SitePageUpdate }>({
      query: ({ tenantId, pageId, body }) => ({
        url: `/console/tenants/${tenantId}/pages/${pageId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_r, _e, { pageId }) => [PAGE_LIST, { type: 'SitePage', id: pageId }],
    }),
    publishSitePage: build.mutation<SitePage, Id & { pageId: string; publish: boolean }>({
      query: ({ tenantId, pageId, publish }) => ({
        url: `/console/tenants/${tenantId}/pages/${pageId}/${publish ? 'publish' : 'unpublish'}`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, { pageId }) => [PAGE_LIST, { type: 'SitePage', id: pageId }],
    }),
    deleteSitePage: build.mutation<void, Id & { pageId: string }>({
      query: ({ tenantId, pageId }) => ({
        url: `/console/tenants/${tenantId}/pages/${pageId}`,
        method: 'DELETE',
      }),
      // Only the list: refetching the deleted page itself would 404.
      invalidatesTags: [PAGE_LIST],
    }),

    media: build.query<Page<MediaAsset>, Id & PageParams>({
      query: ({ tenantId, ...params }) => ({ url: `/console/tenants/${tenantId}/media`, params }),
      providesTags: ['Media'],
    }),
    uploadMedia: build.mutation<MediaAsset, Id & { file: File }>({
      query: ({ tenantId, file }) => {
        const body = new FormData()
        body.append('file', file)
        return { url: `/console/tenants/${tenantId}/media`, method: 'POST', body }
      },
      invalidatesTags: ['Media'],
    }),
    deleteMedia: build.mutation<void, Id & { mediaId: string }>({
      query: ({ tenantId, mediaId }) => ({
        url: `/console/tenants/${tenantId}/media/${mediaId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Media'],
    }),
  }),
})

export const {
  useTenantsQuery,
  useTenantQuery,
  useCreateTenantMutation,
  useUpdateTenantMutation,
  useSaveBrandingMutation,
  useSaveFeaturesMutation,
  useWebsiteQuery,
  useSaveWebsiteMutation,
  useSitePagesQuery,
  useSitePageQuery,
  useCreateSitePageMutation,
  useUpdateSitePageMutation,
  usePublishSitePageMutation,
  useDeleteSitePageMutation,
  useMediaQuery,
  useUploadMediaMutation,
  useDeleteMediaMutation,
} = consoleApi
