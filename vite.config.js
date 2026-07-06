import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { shouldBlockSearchIndexingAtBuild, STAGING_SEARCH_ENGINE_BLOCK } from './shared/stagingSite.mjs'

function stagingSeoBlockPlugin() {
  return {
    name: 'staging-seo-block',
    transformIndexHtml(html) {
      const block = shouldBlockSearchIndexingAtBuild({
        siteUrl: process.env.SITE_URL || process.env.VERCEL_URL || '',
        gitRef: process.env.VERCEL_GIT_COMMIT_REF || '',
        flag: process.env.VITE_BLOCK_SEARCH_INDEXING || '',
      })
      if (!block) return html
      const tags = [
        `<meta name="robots" content="${STAGING_SEARCH_ENGINE_BLOCK}" />`,
        `<meta name="googlebot" content="${STAGING_SEARCH_ENGINE_BLOCK}" />`,
      ].join('\n    ')
      return html.replace('<meta name="theme-color"', `${tags}\n    <meta name="theme-color"`)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget =
    process.env.VITE_PROXY_API_TARGET?.trim() ||
    env.VITE_PROXY_API_TARGET?.trim() ||
    process.env.API_PROXY_TARGET?.trim() ||
    env.API_PROXY_TARGET?.trim() ||
    'http://127.0.0.1:3000'

  return {
    plugins: [react(), tailwindcss(), stagingSeoBlockPlugin()],
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
