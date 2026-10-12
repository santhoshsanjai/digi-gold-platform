import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    // The shared React, router and antd chunk and the rich text editor (loaded only in the
    // page editor) are each just over the default 500 kB.
    build: { chunkSizeWarningLimit: 800 },
    server: {
      port: 5174,
      // In development the API runs separately; proxying keeps requests same-origin.
      proxy: {
        '/api': env.VITE_API_PROXY_TARGET || 'http://localhost:8000',
        '/media': env.VITE_API_PROXY_TARGET || 'http://localhost:8000',
      },
    },
  }
})
