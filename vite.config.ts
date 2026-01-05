import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Only use base path in production for GitHub Pages
  base: mode === 'production' ? '/layout-builder/' : '/',
  server: {
    port: 3000,
    open: true
  },
  resolve: {
    alias: {
      'react-native': 'react-native-web',
    },
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['react-native-web'],
  }
}))