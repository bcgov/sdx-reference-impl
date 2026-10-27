import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { Alert, Button, Card } from 'react-bootstrap'
import { useAuth } from '@/auth/AuthContext'
import { getAppUser } from '@/auth/oidc'

type LoginSearch = {
  reason?: 'oidc-session-expired'
}

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    reason: search.reason === 'oidc-session-expired' ? search.reason : undefined,
  }),
  beforeLoad: async () => {
    if (await getAppUser()) {
      throw redirect({ to: '/widgets' })
    }
  },
  component: LoginPage,
})

export function LoginPage() {
  const auth = useAuth()
  const { reason } = Route.useSearch()
  const [error, setError] = useState('')
  const [redirecting, setRedirecting] = useState(false)

  const handleLogin = async () => {
    setError('')
    setRedirecting(true)
    try {
      await auth.login('/widgets')
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to start OIDC login')
      setRedirecting(false)
    }
  }

  return (
    <div className="login-wrap">
      <Card className="login-card">
        <Card.Body>
          <p className="eyebrow">Secure sign in</p>
          <h1>Widget Application</h1>
          <p className="login-subtitle">SDX Reference Implementation</p>
          <p className="text-secondary">
            Sign in with the configured OpenID Connect identity provider.
          </p>
          {reason === 'oidc-session-expired' && (
            <Alert variant="warning">Your sign-in session expired. Please sign in again.</Alert>
          )}
          {error && <Alert variant="danger">{error}</Alert>}
          <Button
            type="button"
            variant="primary"
            className="w-100"
            disabled={redirecting}
            onClick={() => void handleLogin()}
          >
            {redirecting ? 'Redirecting...' : 'Log in'}
          </Button>
        </Card.Body>
      </Card>
    </div>
  )
}
