import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import type { AuthenticatedRequest } from './auth.types'
import { JwtTokenValidator } from './jwt-token.validator'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly tokenValidator = new JwtTokenValidator({
    validateSignature: true,
    validateExpiry: true,
  })

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const claims = await this.getClaims(request)
    const subject = this.readStringClaim(claims, 'sub')

    if (!subject) {
      throw new UnauthorizedException('JWT sub claim is required')
    }

    request.user = {
      subject,
      claims,
    }
    return true
  }

  private async getClaims(request: AuthenticatedRequest): Promise<Record<string, unknown>> {
    const authorization = this.readHeader(request, 'authorization')
    if (authorization?.startsWith('Bearer ')) {
      return this.tokenValidator.validate(authorization.slice('Bearer '.length))
    }

    throw new UnauthorizedException('Bearer token is required')
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
