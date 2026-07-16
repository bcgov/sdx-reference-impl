export interface AuthenticatedUser {
  subject: string
  claims: Record<string, unknown>
}

export interface AuthenticatedRequest {
  user?: AuthenticatedUser
  headers: Record<string, string | string[] | undefined>
}

export interface ProviderCaller {
  tokenSubject: string
  claims: Record<string, unknown>
  clientToken: boolean
  clientId?: string
  effectiveSubject: string
  effectiveUsername: string
}

export interface ProviderAuthenticatedRequest {
  providerCaller?: ProviderCaller
  headers: Record<string, string | string[] | undefined>
}
