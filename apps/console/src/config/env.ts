export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

/** Address of a client's CRM, for "Open CRM" links. */
export const crmUrl = (slug: string) =>
  (import.meta.env.VITE_CRM_URL_TEMPLATE || 'https://{slug}.crm.example.com').replace('{slug}', slug)
