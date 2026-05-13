import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import type { AuthenticatedRequest } from './auth.types'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const claims = this.getClaims(request)
    const subject = this.readStringClaim(claims, 'sub')

    if (!subject) {
      throw new UnauthorizedException('JWT sub claim is required')
    }

    request.user = {
      subject,
      scopes: this.readScopes(claims),
      claims,
    }
    return true
  }

  private getClaims(request: AuthenticatedRequest): Record<string, unknown> {
    const authorization = this.readHeader(request, 'authorization')
    if (authorization?.startsWith('Bearer ')) {
      return this.decodeJwtPayload(authorization.slice('Bearer '.length))
    }

    if (this.allowMockClaims()) {
      const subject = this.readHeader(request, 'x-sdx-sub')
      if (subject) {
        return {
          sub: subject,
          scope: this.readHeader(request, 'x-sdx-scopes') || '',
        }
      }
    }

    throw new UnauthorizedException('Bearer token is required')
  }

  private decodeJwtPayload(token: string): Record<string, unknown> {
    const parts = token.split('.')
    if (parts.length < 2) {
      throw new UnauthorizedException('Bearer token must be a JWT')
    }

    try {
      return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    } catch {
      throw new UnauthorizedException('JWT payload could not be decoded')
    }
  }

  private readScopes(claims: Record<string, unknown>): string[] {
    const scope = claims.scope
    const scp = claims.scp
    const roles = claims.roles
    const values: string[] = []

    if (typeof scope === 'string') {
      values.push(...scope.split(' '))
    }
    if (typeof scp === 'string') {
      values.push(...scp.split(' '))
    }
    if (Array.isArray(scp)) {
      values.push(...scp.filter((value): value is string => typeof value === 'string'))
    }
    if (Array.isArray(roles)) {
      values.push(...roles.filter((value): value is string => typeof value === 'string'))
    }

    return [...new Set(values.filter(Boolean))]
  }

  private readStringClaim(claims: Record<string, unknown>, name: string): string | undefined {
    const value = claims[name]
    return typeof value === 'string' && value.trim() ? value : undefined
  }

  private readHeader(request: AuthenticatedRequest, name: string): string | undefined {
    const value = request.headers[name] || request.headers[name.toLowerCase()]
    return Array.isArray(value) ? value[0] : value
  }

  private allowMockClaims(): boolean {
    return (
      process.env.AUTH_ALLOW_MOCK_CLAIMS === 'true' ||
      process.env.NODE_ENV === 'test' ||
      process.env.NODE_ENV === 'development'
    )
  }
}
