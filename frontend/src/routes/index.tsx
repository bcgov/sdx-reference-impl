import { createFileRoute, redirect } from '@tanstack/react-router'
import { getAppUser } from '@/auth/oidc'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    throw redirect({ to: (await getAppUser()) ? '/widgets' : '/login' })
  },
})
