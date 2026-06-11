import {
  Log,
  UserManager,
  WebStorageStateStore,
  type User,
  type UserManagerSettings,
} from 'oidc-client-ts'
import { getOidcConfig } from './config'

export type AppUser = {
  accessToken: string
  displayName: string
  subjectId: string
}

let userManager: UserManager | null = null

function getNestedClaim(profile: User['profile'], path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') {
      return undefined
    }
    return (value as Record<string, unknown>)[key]
  }, profile)
}

function decodeAccessToken(accessToken: string): Record<string, unknown> {
  try {
    const payload = accessToken.split('.')[1]
    return payload
      ? (JSON.parse(atob(payload.replaceAll('-', '+').replaceAll('_', '/'))) as Record<
          string,
          unknown
        >)
      : {}
  } catch {
    return {}
  }
}

export function toAppUser(user: User | null): AppUser | null {
  if (!user || user.expired || !user.access_token) {
    return null
  }

  const config = getOidcConfig()
  const displayName = getNestedClaim(user.profile, config.displayNameClaim)
  const accessTokenClaims = decodeAccessToken(user.access_token)

  return {
    accessToken: user.access_token,
    displayName:
      (typeof displayName === 'string' && displayName) ||
      user.profile.preferred_username ||
      user.profile.name ||
      user.profile.sub,
    subjectId:
      (typeof accessTokenClaims.sub === 'string' && accessTokenClaims.sub) || user.profile.sub,
  }
}

export function getUserManager(): UserManager {
  if (userManager) {
    return userManager
  }

  const config = getOidcConfig()
  const settings: UserManagerSettings = {
    authority: config.authority,
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    silent_redirect_uri: config.silentRedirectUri,
    post_logout_redirect_uri: config.postLogoutRedirectUri,
    response_type: 'code',
    scope: config.scope,
    automaticSilentRenew: true,
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  }

  Log.setLevel(Log.ERROR)
  userManager = new UserManager(settings)
  return userManager
}

export async function getAppUser(): Promise<AppUser | null> {
  return toAppUser(await getUserManager().getUser())
}

export async function beginLogin(returnTo = '/widgets'): Promise<void> {
  await getUserManager().signinRedirect({ state: { returnTo } })
}

export async function completeLogin(): Promise<{ returnTo: string; user: AppUser }> {
  const oidcUser = await getUserManager().signinRedirectCallback()
  const user = toAppUser(oidcUser)
  if (!user) {
    throw new Error('The OIDC provider did not return a usable access token')
  }

  const state = oidcUser.state as { returnTo?: unknown } | undefined
  const returnTo =
    typeof state?.returnTo === 'string' && state.returnTo.startsWith('/')
      ? state.returnTo
      : '/widgets'
  return { returnTo, user }
}

export async function completeSilentLogin(): Promise<void> {
  await getUserManager().signinSilentCallback()
}

export async function beginLogout(): Promise<void> {
  const manager = getUserManager()
  try {
    await manager.signoutRedirect()
  } catch {
    await manager.removeUser()
    window.location.assign('/login')
  }
}

export async function removeLocalUser(): Promise<void> {
  await getUserManager().removeUser()
}
