import { createRootRoute, ErrorComponent, Outlet } from '@tanstack/react-router'
import Layout from '@/components/Layout'
import NotFound from '@/components/NotFound'
import { AuthProvider } from '@/auth/AuthContext'

export const Route = createRootRoute({
  component: () => (
    <AuthProvider>
      <Layout>
        <Outlet />
      </Layout>
    </AuthProvider>
  ),
  notFoundComponent: () => <NotFound />,
  errorComponent: ({ error }) => <ErrorComponent error={error} />,
})
