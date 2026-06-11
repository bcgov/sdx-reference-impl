import '@bcgov/bc-sans/css/BC_Sans.css'
import { StrictMode } from 'react'
import * as ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import '@/scss/styles.scss'
import { loadRuntimeConfig } from '@/auth/config'
import apiService from '@/service/api-service'
import { routeTree } from './routeTree.gen'

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)
const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

loadRuntimeConfig()
  .then(() => {
    apiService.initialize()
    root.render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    )
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unable to load runtime configuration'
    root.render(
      <main className="configuration-error">
        <h1>Application configuration error</h1>
        <p>{message}</p>
      </main>,
    )
  })
