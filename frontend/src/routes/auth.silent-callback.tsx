import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { completeSilentLogin } from '@/auth/oidc'

export const Route = createFileRoute('/auth/silent-callback')({
  component: SilentCallbackPage,
})

function SilentCallbackPage() {
  useEffect(() => {
    void completeSilentLogin()
  }, [])

  return null
}
