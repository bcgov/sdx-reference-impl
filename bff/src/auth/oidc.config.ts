export const DEFAULT_OIDC_SCOPE =
  'openid profile nrs:widgets:read nrs:widgets:create nrs:widgets:update nrs:widgets:delete'

export function bffOidcClientId(): string {
  return process.env.OIDC_CLIENT_ID?.trim() || 'local-widget-bff'
}

export function bffOidcScope(): string {
  return process.env.OIDC_SCOPE?.trim() || DEFAULT_OIDC_SCOPE
}
