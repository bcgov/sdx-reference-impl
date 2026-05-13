export interface AuthenticatedUser {
  subject: string
  scopes: string[]
  claims: Record<string, unknown>
}

export interface AuthenticatedRequest {
  user?: AuthenticatedUser
  headers: Record<string, string | string[] | undefined>
}
