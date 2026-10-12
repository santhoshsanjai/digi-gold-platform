import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_API_PROXY_TARGET || 'http://localhost:8000'
  return {
    plugins: [react()],
    server: {
      port: 5175,
      // In development the API runs separately; proxying keeps requests same-origin.
      proxy: { '/api': target, '/media': target },
    },
    preview: { port: 4175, proxy: { '/api': target, '/media': target } },
  }
})
