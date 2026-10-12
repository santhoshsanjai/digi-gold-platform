/**
 * The client (tenant) this CRM is serving.
 *
 * One build serves every client: in production the slug is the first label of the host
 * name (sri-gold.crm.example.com -> "sri-gold"); locally it comes from VITE_TENANT_SLUG.
 */
function resolveTenantSlug(): string {
  const fromEnv = import.meta.env.VITE_TENANT_SLUG?.trim()
  if (fromEnv) return fromEnv
  const [first] = window.location.hostname.split('.')
  return first === 'localhost' ? 'demo' : first
}

export const TENANT_SLUG = resolveTenantSlug()

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'
