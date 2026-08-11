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
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
    // Poll the filesystem instead of relying on the OS inotify watcher. The
    // watcher can silently stop detecting changes (serving stale code to
    // always-on dev servers), which is exactly what caused repeated "still
    // seeing old content" reports. Polling can never miss a file change.
    watch: {
      usePolling: true,
      interval: 300
    }
  },
  build: {
    rollupOptions: {
      output: {
        // Vite 8 (rolldown) only supports manualChunks as a function, not an
        // object map. Split heavy vendor groups so they download/cache in
        // parallel and so the lazy PostFX chunk never drags the whole post-
        // processing + r3 ecosystem into the initial bundle.
        manualChunks: (id: string) => {
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) {
            return 'react'
          }
          // `three` + the R3 ecosystem, BUT NOT postprocessing: `@react-three/
          // postprocessing` + `postprocessing` are imported only by the lazy
          // PostFX component, so leave them ungrouped — rollup keeps them in a
          // separate chunk that high-power devices fetch on demand (low-power
          // devices never download it).
          if (id.includes('node_modules/three')) {
            return 'three'
          }
          if (
            id.includes('node_modules/@react-three') &&
            !id.includes('node_modules/@react-three/postprocessing')
          ) {
            return 'three'
          }
          if (
            id.includes('node_modules/@react-three/rapier') ||
            id.includes('node_modules/@dimforge')
          ) {
            return 'physics'
          }
          if (id.includes('node_modules/howler')) {
            return 'audio'
          }
        }
      }
    }
  }
})