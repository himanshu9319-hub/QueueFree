import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const dashboardPreview = command === 'serve' && mode !== 'production' && env.VITE_ENABLE_DASHBOARD_PREVIEW === 'true'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: true, // Listen on all addresses, including 127.0.0.1 and localhost
      port: 5173,
      strictPort: true,
      cors: true,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
    },
    define: {
      __DASHBOARD_PREVIEW__: JSON.stringify(dashboardPreview),
    },
  }
})
