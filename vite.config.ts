import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
})