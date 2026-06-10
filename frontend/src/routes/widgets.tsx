import { createFileRoute, redirect } from '@tanstack/react-router'
import { Spinner } from 'react-bootstrap'
import WidgetManager from '@/components/WidgetManager'
import { useAuth } from '@/auth/AuthContext'
import { getAppUser } from '@/auth/oidc'

export const Route = createFileRoute('/widgets')({
  beforeLoad: async () => {
    if (!(await getAppUser())) {
      throw redirect({ to: '/login' })
    }
  },
  component: WidgetsPage,
})

function WidgetsPage() {
  const { loading, user } = useAuth()

  if (loading || !user) {
    return (
      <div className="loading-state">
        <Spinner animation="border" role="status" />
        <span>Loading your session...</span>
      </div>
    )
  }

  return <WidgetManager subject={user.subjectId} title="My widgets" />
}
