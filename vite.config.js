import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: true,
    // Quick tunnels (wrangler tunnel quick-start) use *.trycloudflare.com as Host
    allowedHosts: ['.trycloudflare.com'],
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: ['.trycloudflare.com'],
  }
})
