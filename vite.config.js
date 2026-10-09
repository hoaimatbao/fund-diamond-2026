import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Đảm bảo không bao giờ leak API key vào client-side production bundle
    'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(''),
    'import.meta.env.GEMINI_API_KEY': JSON.stringify('')
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  }
})
