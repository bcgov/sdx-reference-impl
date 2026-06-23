export type OidcConfig = {
  authority: string
  clientId: string
  displayNameClaim: string
  redirectUri: string
  scope: string
  silentRedirectUri: string
  postLogoutRedirectUri: string
}

export type ApiConfig = {
  baseUrl: string
}

type RuntimeConfig = {
  api?: Partial<ApiConfig>
  oidc?: Partial<OidcConfig>
}

let apiConfig: ApiConfig | null = null
let oidcConfig: OidcConfig | null = null

function required(value: string | undefined, name: string): string {
  if (!value?.trim()) {
    throw new Error(`Missing required OIDC configuration: ${name}`)
  }
  return value.trim()
}

function configured(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value?.trim())?.trim()
}

function apiBaseUrl(value: string | undefined): string {
  const candidate = value?.trim()
  if (!candidate) {
    throw new Error('Missing required API configuration: baseUrl')
  }

  try {
    const url = new URL(candidate)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error()
    }
    return candidate.replace(/\/+$/, '')
  } catch {
    throw new Error(
      'Invalid API configuration: baseUrl must be an absolute HTTP(S) URL',
    )
  }
}

export async function loadRuntimeConfig(): Promise<void> {
  if (apiConfig && oidcConfig) {
    return
  }

  let runtimeConfig: RuntimeConfig = {}
  try {
    const response = await fetch('/config.json', { cache: 'no-store' })
    if (response.ok) {
      runtimeConfig = (await response.json()) as RuntimeConfig
    }
  } catch {
    // Vite environment values remain available as a local-development fallback.
  }

  const oidc = runtimeConfig.oidc ?? {}
  const origin = window.location.origin

  apiConfig = {
    baseUrl: apiBaseUrl(configured(runtimeConfig.api?.baseUrl, import.meta.env.VITE_API_BASE_URL)),
  }
  oidcConfig = {
    authority: required(oidc.authority ?? import.meta.env.VITE_OIDC_AUTHORITY, 'authority'),
    clientId:
      configured(oidc.clientId, import.meta.env.VITE_OIDC_CLIENT_ID) ??
      'widget-ui-sdx-reference-implementation-21920',
    scope:
      configured(oidc.scope, import.meta.env.VITE_OIDC_SCOPE) ??
      'openid profile nrs:widgets:read nrs:widgets:create nrs:widgets:update nrs:widgets:delete nrs:widgets:admin',
    displayNameClaim:
      configured(oidc.displayNameClaim, import.meta.env.VITE_OIDC_DISPLAY_NAME_CLAIM) ?? 'name',
    redirectUri:
      configured(oidc.redirectUri, import.meta.env.VITE_OIDC_REDIRECT_URI) ??
      `${origin}/auth/callback`,
    silentRedirectUri:
      configured(oidc.silentRedirectUri, import.meta.env.VITE_OIDC_SILENT_REDIRECT_URI) ??
      `${origin}/auth/silent-callback`,
    postLogoutRedirectUri:
      configured(oidc.postLogoutRedirectUri, import.meta.env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI) ??
      `${origin}/login`,
  }
}

export async function loadOidcConfig(): Promise<OidcConfig> {
  await loadRuntimeConfig()
  return getOidcConfig()
}

export function getApiConfig(): ApiConfig {
  if (!apiConfig) {
    throw new Error('Runtime configuration has not been loaded')
  }
  return apiConfig
}

export function getOidcConfig(): OidcConfig {
  if (!oidcConfig) {
    throw new Error('OIDC configuration has not been loaded')
  }
  return oidcConfig
}
