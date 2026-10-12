/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_CRM_URL_TEMPLATE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
