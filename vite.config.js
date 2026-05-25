import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const pkg = require('./package.json')

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    'window.__FAROL_VERSION__': JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5175,
    strictPort: true,
  },
})
