export interface BffSessionUser {
  displayName: string
  subjectId: string
}

export interface BffSession {
  accessToken: string
  expiresAt: number
  id: string
  user: BffSessionUser
}

export interface BffAuthenticatedRequest {
  bffSession?: BffSession
  headers: Record<string, string | string[] | undefined>
}
