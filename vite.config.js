import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'dashboard',
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  build: {
    outDir: '../public',
    emptyOutDir: true,
  },
})
