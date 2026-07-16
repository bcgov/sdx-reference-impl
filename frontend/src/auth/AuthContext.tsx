import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react'
import { beginLogin, beginLogout, getAppUser, type AppUser } from './oidc'

type AuthContextValue = {
  loading: boolean
  login: (returnTo?: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<AppUser | null>
  user: AppUser | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void getAppUser()
      .then(setUser)
      .finally(() => setLoading(false))
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login: beginLogin,
      logout: beginLogout,
      refreshUser: async () => {
        const currentUser = await getAppUser()
        setUser(currentUser)
        return currentUser
      },
    }),
    [loading, user],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
