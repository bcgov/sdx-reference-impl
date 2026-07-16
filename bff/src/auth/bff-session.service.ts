import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common'
import { createHash, randomBytes } from 'crypto'
import type { Request, Response } from 'express'
import type { BffSession, BffSessionUser } from './auth.types'

const SESSION_COOKIE = 'bff_session'
const LOGIN_COOKIE = 'bff_login'
const DEFAULT_SCOPE =
  'openid profile nrs:widgets:read nrs:widgets:create nrs:widgets:update nrs:widgets:delete'
const LOGIN_TTL_MS = 10 * 60 * 1000
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60

type OpenIdConfiguration = {
  authorization_endpoint: string
  token_endpoint: string
}

type LoginTransaction = {
  codeVerifier: string
  expiresAt: number
  redirectUri: string
  returnTo: string
}

type TokenResponse = {
  access_token?: string
  expires_in?: number
  id_token?: string
}

@Injectable()
export class BffSessionService {
  private readonly logins = new Map<string, LoginTransaction>()
  private readonly sessions = new Map<string, BffSession>()
  private discovery: Promise<OpenIdConfiguration> | null = null

  async beginLogin(request: Request, response: Response, returnTo = '/widgets'): Promise<void> {
    const discovery = await this.getDiscovery()
    const state = this.randomToken()
    const codeVerifier = this.randomToken()
    const redirectUri = this.redirectUri(request)
    const normalizedReturnTo = returnTo.startsWith('/') ? returnTo : '/widgets'
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')

    this.logins.set(state, {
      codeVerifier,
      expiresAt: Date.now() + LOGIN_TTL_MS,
      redirectUri,
      returnTo: normalizedReturnTo,
    })

    response.setHeader(
      'Set-Cookie',
      this.serializeCookie(LOGIN_COOKIE, state, {
        maxAge: Math.floor(LOGIN_TTL_MS / 1000),
      }),
    )

    const authorizationUrl = new URL(discovery.authorization_endpoint)
    authorizationUrl.searchParams.set('client_id', this.clientId())
    authorizationUrl.searchParams.set('code_challenge', codeChallenge)
    authorizationUrl.searchParams.set('code_challenge_method', 'S256')
    authorizationUrl.searchParams.set('redirect_uri', redirectUri)
    authorizationUrl.searchParams.set('response_type', 'code')
    authorizationUrl.searchParams.set('scope', process.env.OIDC_SCOPE || DEFAULT_SCOPE)
    authorizationUrl.searchParams.set('state', state)

    response.redirect(authorizationUrl.toString())
  }

  async completeLogin(request: Request, response: Response): Promise<void> {
    const code = this.readQueryString(request.query.code)
    const state = this.readQueryString(request.query.state)
    const loginCookieState = this.readCookie(request, LOGIN_COOKIE)
    if (!code || !state || state !== loginCookieState) {
      throw new BadRequestException('Invalid OIDC callback state')
    }

    const login = this.logins.get(state)
    this.logins.delete(state)
    if (!login || login.expiresAt <= Date.now()) {
      throw new BadRequestException('OIDC login request expired')
    }

    const tokenResponse = await this.exchangeCode(code, login)
    if (!tokenResponse.access_token) {
      throw new BadGatewayException('OIDC token response did not include an access token')
    }

    const session = this.createSession(tokenResponse)
    response.setHeader('Set-Cookie', [
      this.serializeCookie(SESSION_COOKIE, session.id, {
        maxAge: Math.max(1, Math.floor((session.expiresAt - Date.now()) / 1000)),
      }),
      this.clearCookie(LOGIN_COOKIE),
    ])
    response.redirect(login.returnTo)
  }

  getSession(request: BffSessionRequest): BffSession | null {
    const sessionId = this.readCookie(request, SESSION_COOKIE)
    const session = sessionId ? this.sessions.get(sessionId) : undefined
    if (!session) {
      return null
    }
    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(session.id)
      return null
    }
    return session
  }

  requireSession(request: BffSessionRequest): BffSession {
    const session = this.getSession(request)
    if (!session) {
      throw new UnauthorizedException('Login is required')
    }
    return session
  }

  endSession(request: BffSessionRequest, response: Response): void {
    const sessionId = this.readCookie(request, SESSION_COOKIE)
    if (sessionId) {
      this.sessions.delete(sessionId)
    }
    response.setHeader('Set-Cookie', [
      this.clearCookie(SESSION_COOKIE),
      this.clearCookie(LOGIN_COOKIE),
    ])
  }

  private async exchangeCode(code: string, login: LoginTransaction): Promise<TokenResponse> {
    const discovery = await this.getDiscovery()
    const params = new URLSearchParams({
      client_id: this.clientId(),
      client_secret: this.clientSecret(),
      code,
      code_verifier: login.codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: login.redirectUri,
    })

    const response = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    })

    if (!response.ok) {
      throw new BadGatewayException('OIDC token exchange failed')
    }
    return (await response.json()) as TokenResponse
  }

  private createSession(tokenResponse: TokenResponse): BffSession {
    const claims = this.decodeJwtPayload(tokenResponse.access_token)
    const idTokenClaims = this.decodeJwtPayload(tokenResponse.id_token)
    const now = Date.now()
    const expiresIn = tokenResponse.expires_in ?? DEFAULT_SESSION_TTL_SECONDS
    const session: BffSession = {
      accessToken: tokenResponse.access_token!,
      expiresAt: now + expiresIn * 1000,
      id: this.randomToken(),
      user: this.toSessionUser(claims, idTokenClaims),
    }
    this.sessions.set(session.id, session)
    return session
  }

  private toSessionUser(
    accessTokenClaims: Record<string, unknown>,
    idTokenClaims: Record<string, unknown>,
  ): BffSessionUser {
    const subject =
      this.readStringClaim(accessTokenClaims, 'sub') || this.readStringClaim(idTokenClaims, 'sub')
    if (!subject) {
      throw new BadGatewayException('OIDC token response did not include a subject')
    }

    const displayNameClaim = process.env.OIDC_DISPLAY_NAME_CLAIM || 'name'
    const displayName =
      this.readNestedStringClaim(idTokenClaims, displayNameClaim) ||
      this.readStringClaim(idTokenClaims, 'preferred_username') ||
      this.readStringClaim(idTokenClaims, 'name') ||
      this.readStringClaim(accessTokenClaims, 'preferred_username') ||
      this.readStringClaim(accessTokenClaims, 'name') ||
      subject

    return {
      displayName,
      subjectId: subject,
    }
  }

  private async getDiscovery(): Promise<OpenIdConfiguration> {
    if (!this.discovery) {
      this.discovery = this.fetchDiscovery()
    }
    return this.discovery
  }

  private async fetchDiscovery(): Promise<OpenIdConfiguration> {
    const authority = process.env.OIDC_AUTHORITY?.replace(/\/+$/, '')
    const discoveryUrl =
      process.env.OIDC_OPENID_CONNECT_URL ||
      (authority ? `${authority}/.well-known/openid-configuration` : undefined)
    if (!discoveryUrl) {
      throw new InternalServerErrorException('OIDC_AUTHORITY is required')
    }

    const response = await fetch(discoveryUrl)
    if (!response.ok) {
      throw new BadGatewayException('OIDC discovery failed')
    }
    const discovery = (await response.json()) as Partial<OpenIdConfiguration>
    if (!discovery.authorization_endpoint || !discovery.token_endpoint) {
      throw new BadGatewayException('OIDC discovery document is missing required endpoints')
    }
    return {
      authorization_endpoint: discovery.authorization_endpoint,
      token_endpoint: discovery.token_endpoint,
    }
  }

  private redirectUri(request: Request): string {
    if (process.env.OIDC_REDIRECT_URI?.trim()) {
      return process.env.OIDC_REDIRECT_URI.trim()
    }
    return `${this.origin(request)}/api/auth/callback`
  }

  private origin(request: Request): string {
    const forwardedProto = this.readHeader(request, 'x-forwarded-proto')
    const forwardedHost = this.readHeader(request, 'x-forwarded-host')
    const proto = forwardedProto || request.protocol || 'http'
    const host = forwardedHost || this.readHeader(request, 'host')
    if (!host) {
      throw new BadRequestException('Host header is required')
    }
    return `${proto}://${host}`
  }

  private clientId(): string {
    return process.env.OIDC_CLIENT_ID?.trim() || 'local-widget-bff'
  }

  private clientSecret(): string {
    const secret = process.env.OIDC_CLIENT_SECRET?.trim()
    if (!secret) {
      throw new InternalServerErrorException('OIDC_CLIENT_SECRET is required')
    }
    return secret
  }

  private decodeJwtPayload(token: string | undefined): Record<string, unknown> {
    if (!token) {
      return {}
    }
    const parts = token.split('.')
    if (parts.length < 2) {
      return {}
    }
    try {
      return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<
        string,
        unknown
      >
    } catch {
      return {}
    }
  }

  private readNestedStringClaim(claims: Record<string, unknown>, path: string): string | undefined {
    const value = path.split('.').reduce<unknown>((current, key) => {
      if (!current || typeof current !== 'object') {
        return undefined
      }
      return (current as Record<string, unknown>)[key]
    }, claims)
    return typeof value === 'string' && value.trim() ? value : undefined
  }

  private readStringClaim(claims: Record<string, unknown>, name: string): string | undefined {
    const value = claims[name]
    return typeof value === 'string' && value.trim() ? value : undefined
  }

  private readQueryString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value : undefined
  }

  private readCookie(request: BffSessionRequest, name: string): string | undefined {
    const cookieHeader = this.readHeader(request, 'cookie')
    if (!cookieHeader) {
      return undefined
    }
    for (const cookie of cookieHeader.split(';')) {
      const [rawName, ...rawValue] = cookie.trim().split('=')
      if (rawName === name) {
        return decodeURIComponent(rawValue.join('='))
      }
    }
    return undefined
  }

  private readHeader(request: BffSessionRequest, name: string): string | undefined {
    const value = request.headers[name] || request.headers[name.toLowerCase()]
    return Array.isArray(value) ? value[0] : value
  }

  private serializeCookie(name: string, value: string, options: { maxAge: number }): string {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
    return `${name}=${encodeURIComponent(
      value,
    )}; Max-Age=${options.maxAge}; Path=/; HttpOnly; SameSite=Lax${secure}`
  }

  private clearCookie(name: string): string {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
    return `${name}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure}`
  }

  private randomToken(): string {
    return randomBytes(32).toString('base64url')
  }
}

type BffSessionRequest = Pick<Request, 'headers'> & Partial<Pick<Request, 'protocol'>>
