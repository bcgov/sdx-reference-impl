import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react'
import { beginLogin, beginLogout, getAppUser, getUserManager, type AppUser } from './oidc'

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
    const manager = getUserManager()
    const refresh = () => {
      void getAppUser().then(setUser)
    }
    const clear = () => setUser(null)

    manager.events.addUserLoaded(refresh)
    manager.events.addUserUnloaded(clear)
    manager.events.addAccessTokenExpired(clear)
    void getAppUser()
      .then(setUser)
      .finally(() => setLoading(false))

    return () => {
      manager.events.removeUserLoaded(refresh)
      manager.events.removeUserUnloaded(clear)
      manager.events.removeAccessTokenExpired(clear)
    }
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
