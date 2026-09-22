import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'src/web',
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  build: { outDir: '../../dist/web', emptyOutDir: true, sourcemap: true },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8080', '/auth': 'http://localhost:8080' },
  },
})
