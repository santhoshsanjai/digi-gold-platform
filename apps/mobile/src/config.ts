export const TENANT_SLUG = process.env.EXPO_PUBLIC_TENANT_SLUG ?? 'demo'
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1').replace(/\/$/, '')
