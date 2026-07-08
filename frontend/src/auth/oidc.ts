export type AppUser = {
  displayName: string
  subjectId: string
}

type SessionResponse = {
  authenticated: boolean
  user: AppUser | null
}

export async function getAppUser(): Promise<AppUser | null> {
  const response = await fetch('/api/auth/session', {
    cache: 'no-store',
    credentials: 'include',
  })
  if (!response.ok) {
    return null
  }

  const session = (await response.json()) as SessionResponse
  return session.authenticated ? session.user : null
}

export async function beginLogin(returnTo = '/widgets'): Promise<void> {
  const normalizedReturnTo = returnTo.startsWith('/') ? returnTo : '/widgets'
  window.location.assign(`/api/auth/login?returnTo=${encodeURIComponent(normalizedReturnTo)}`)
}

export async function completeLogin(): Promise<{ returnTo: string; user: AppUser }> {
  const user = await getAppUser()
  if (!user) {
    throw new Error('Login did not create a BFF session')
  }
  return { returnTo: '/widgets', user }
}

export async function completeSilentLogin(): Promise<void> {
  window.close()
}

export async function beginLogout(): Promise<void> {
  await fetch('/api/auth/logout', {
    credentials: 'include',
    method: 'POST',
  })
  window.location.assign('/login')
}

export async function removeLocalUser(): Promise<void> {
  // The BFF owns session state in an HttpOnly cookie, so there is no browser token to remove.
}
