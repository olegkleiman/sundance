import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Cast to PluginOption[] to avoid TS type conflicts when multiple Vite versions exist in a monorepo
  plugins: [react()] as any,
  resolve: {
    // Ensure only one copy of react/react-dom is used when multiple versions exist in a workspace
    dedupe: ['react', 'react-dom']
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8099", // FastAPI URL
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  }
})