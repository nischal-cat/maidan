import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vite already allows localhost on its own, so no host is listed by default and
// plain local development needs no configuration. Set ALLOWED_HOSTS in .env
// (comma separated) only when the dev server is reached under some other name,
// for example a Cloudflare quick tunnel, which hands out a random
// *.trycloudflare.com hostname that changes on every restart.
//
// Do NOT set allowedHosts: true here. The dev server may be published to the
// internet, and that would disable Vite's DNS-rebinding protection entirely,
// letting any site resolve its own scripts against your local machine.
const extraHosts = (process.env.ALLOWED_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean)

const API_TARGET = process.env.VITE_DEV_API_TARGET || 'http://127.0.0.1:5001'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    allowedHosts: extraHosts,
    // VITE_API_URL is a relative path (/api), so every API call and uploaded
    // image resolves against the origin the app was served from. Proxying both
    // here keeps that working through a tunnel, and makes the requests
    // same-origin in dev so CORS is not involved at all.
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/uploads': { target: API_TARGET, changeOrigin: true },
    },
  },
})
