import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import type { AuthenticatedRequest } from './auth.types'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const claims = this.getClaims(request)
    const subject = this.readStringClaim(claims, 'sub')

    // The gateway validates the token and enforces OAS scopes before forwarding
    // the request. This API only requires the subject claim used for ownership.
    if (!subject) {
      throw new UnauthorizedException('JWT sub claim is required')
    }

    request.user = {
      subject,
      claims,
    }
    return true
  }

  private getClaims(request: AuthenticatedRequest): Record<string, unknown> {
    const authorization = this.readHeader(request, 'authorization')
    if (authorization?.startsWith('Bearer ')) {
      return this.decodeJwtPayload(authorization.slice('Bearer '.length))
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

  private readStringClaim(claims: Record<string, unknown>, name: string): string | undefined {
    const value = claims[name]
    return typeof value === 'string' && value.trim() ? value : undefined
  }

  private readHeader(request: AuthenticatedRequest, name: string): string | undefined {
    const value = request.headers[name] || request.headers[name.toLowerCase()]
    return Array.isArray(value) ? value[0] : value
  }
}
