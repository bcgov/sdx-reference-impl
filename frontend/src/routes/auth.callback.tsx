import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Alert, Spinner } from 'react-bootstrap'
import { completeLogin } from '@/auth/oidc'

export const Route = createFileRoute('/auth/callback')({
  component: OidcCallbackPage,
})

function OidcCallbackPage() {
  const [error, setError] = useState('')

  useEffect(() => {
    void completeLogin()
      .then(async ({ returnTo }) => {
        window.location.replace(returnTo)
      })
      .catch((callbackError: unknown) => {
        setError(callbackError instanceof Error ? callbackError.message : 'OIDC login failed')
      })
  }, [])

  return (
    <div className="loading-state">
      {error ? (
        <Alert variant="danger">{error}</Alert>
      ) : (
        <>
          <Spinner animation="border" role="status" />
          <span>Completing sign in...</span>
        </>
      )}
    </div>
  )
}
