import { defineConfig, loadEnv, type Plugin } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

function runtimeConfig(mode: string): Plugin {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    name: 'runtime-config',
    configureServer(server) {
      server.middlewares.use('/config.json', (_request, response) => {
        response.setHeader('Content-Type', 'application/json')
        response.end(
          JSON.stringify({
            api: {
              baseUrl: env.VITE_API_BASE_URL || '/api/v1',
            },
          }),
        )
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    runtimeConfig(mode),
    TanStackRouterVite({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
  ],
  server: {
    port: parseInt(process.env.PORT),
    proxy: {
      '/api': {
        target: process.env.BFF_BASE_URL || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
    fs: {
      // Allow serving files from one level up to the project root
      allow: ['..'],
    },
  },
  resolve: {
    // https://vitejs.dev/config/shared-options.html#resolve-alias
    tsconfigPaths: true,
    alias: {
      '~bootstrap': fileURLToPath(new URL('./node_modules/bootstrap', import.meta.url)),
    },
    extensions: ['.js', '.json', '.jsx', '.mjs', '.ts', '.tsx', '.vue'],
  },
  build: {
    // Build Target
    // https://vitejs.dev/config/build-options.html#build-target
    target: 'esnext',
    // Rollup Options
    // https://vitejs.dev/config/build-options.html#build-rollupoptions
    rollupOptions: {},
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Silence deprecation warnings caused by Bootstrap SCSS
        // which is out of our control.
        silenceDeprecations: ['color-functions', 'global-builtin', 'import'],
      },
    },
  },
}))
