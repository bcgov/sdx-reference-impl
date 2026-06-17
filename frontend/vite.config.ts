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
              baseUrl: env.API_BASE_URL || env.VITE_API_BASE_URL,
            },
            oidc: {
              authority: env.OIDC_AUTHORITY || env.VITE_OIDC_AUTHORITY,
              clientId: env.OIDC_CLIENT_ID || env.VITE_OIDC_CLIENT_ID,
              scope: env.OIDC_SCOPE || env.VITE_OIDC_SCOPE,
              displayNameClaim: env.OIDC_DISPLAY_NAME_CLAIM || env.VITE_OIDC_DISPLAY_NAME_CLAIM,
              redirectUri: env.OIDC_REDIRECT_URI || env.VITE_OIDC_REDIRECT_URI,
              silentRedirectUri: env.OIDC_SILENT_REDIRECT_URI || env.VITE_OIDC_SILENT_REDIRECT_URI,
              postLogoutRedirectUri:
                env.OIDC_POST_LOGOUT_REDIRECT_URI || env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI,
            },
          }),
        )
      })
      server.middlewares.use('/api', (_request, response) => {
        response.statusCode = 404
        response.end()
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
