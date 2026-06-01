import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget =
    process.env.VITE_PROXY_API_TARGET?.trim() ||
    env.VITE_PROXY_API_TARGET?.trim() ||
    process.env.API_PROXY_TARGET?.trim() ||
    env.API_PROXY_TARGET?.trim() ||
    'http://127.0.0.1:3000'

  return {
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
              return 'react-vendor'
            }
            if (id.includes('node_modules/react-router')) {
              return 'router-vendor'
            }
          },
        },
      },
    },
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
