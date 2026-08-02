import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Defaults to '/' (local dev, root hosting). Set VITE_BASE (e.g. GitHub
  // Pages `/Nepal-3d-portfolio/`) to mount the app under a subpath.
  base: process.env.VITE_BASE || '/',
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: true
  }
})