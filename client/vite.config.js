import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  plugins: [react()],
  define: {
    '__APP_VERSION__': JSON.stringify(packageJson.version),
    '__BUILD_DATE__': JSON.stringify(new Date().toLocaleString('en-US', { 
      day: 'numeric', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    }))
  },
  server: {
    port: 3000,
    host: true,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'axios', 'lucide-react']
  },
  build: {
    minify: 'esbuild',
    sourcemap: false
  }
})
