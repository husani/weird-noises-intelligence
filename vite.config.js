import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared/frontend'),
      '@producers': path.resolve(__dirname, 'producers/frontend'),
      '@skeleton': path.resolve(__dirname, 'skeleton_a/frontend'),
      '@slate': path.resolve(__dirname, 'slate/frontend'),
    },
  },
  server: {
    port: 8006,
    proxy: {
      '/api': {
        target: 'http://localhost:8005',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
})
