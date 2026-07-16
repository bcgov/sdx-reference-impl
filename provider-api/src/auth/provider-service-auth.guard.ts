import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import type { ProviderAuthenticatedRequest } from './auth.types'
import { JwtTokenValidator } from './jwt-token.validator'

const DEFAULT_ALLOWED_CLIENT_IDS = ['local-provider-sdx-api']

@Injectable()
export class ProviderServiceAuthGuard implements CanActivate {
  private readonly tokenValidator = new JwtTokenValidator({
    validateSignature: true,
    validateExpiry: true,
  })

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ProviderAuthenticatedRequest>()
    const claims = await this.getClaims(request)
    const clientId = this.clientIdFromClaims(claims)
    const tokenSubject = this.readStringClaim(claims, 'sub') || clientId
    const clientToken = this.isClientToken(claims)

    if (!tokenSubject) {
      throw new UnauthorizedException('JWT sub or client_id claim is required')
    }

    if (clientToken) {
      this.validateAllowedClient(clientId || tokenSubject)
    }

    const onBehalfOfSubject = this.readHeader(request, 'x-on-behalf-of-sub')
    const onBehalfOfUsername = this.readHeader(request, 'x-on-behalf-of-username')

    let effectiveSubject: string | undefined
    let effectiveUsername: string | undefined
    if (clientToken) {
      if (!onBehalfOfSubject || !onBehalfOfUsername) {
        throw new BadRequestException(
          'x-on-behalf-of-sub and x-on-behalf-of-username headers are required for client tokens',
        )
      }
      effectiveSubject = onBehalfOfSubject
      effectiveUsername = onBehalfOfUsername
    } else {
      if (onBehalfOfSubject || onBehalfOfUsername) {
        throw new BadRequestException(
          'x-on-behalf-of-sub and x-on-behalf-of-username headers are only permitted for client tokens',
        )
      }
      effectiveSubject = this.readStringClaim(claims, 'sub')
      effectiveUsername = this.usernameFromClaims(claims)
    }

    if (!effectiveSubject || !effectiveUsername) {
      throw new BadRequestException('Unable to determine effective user subject and username')
    }

    request.providerCaller = {
      tokenSubject,
      claims,
      clientToken,
      clientId,
      effectiveSubject,
      effectiveUsername,
    }
    return true
  }

  private async getClaims(request: ProviderAuthenticatedRequest): Promise<Record<string, unknown>> {
    const authorization = this.readHeader(request, 'authorization')
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token is required')
    }
    return this.tokenValidator.validate(authorization.slice('Bearer '.length))
  }

  private isClientToken(claims: Record<string, unknown>): boolean {
    const grantType =
      this.readStringClaim(claims, 'grant_type') || this.readStringClaim(claims, 'gty')
    if (grantType === 'client_credentials' || grantType === 'client-credentials') {
      return true
    }
    return Boolean(this.readStringClaim(claims, 'client_id'))
  }

  private validateAllowedClient(clientId: string): void {
    const allowed = (
      process.env.PROVIDER_API_ALLOWED_CLIENT_IDS || DEFAULT_ALLOWED_CLIENT_IDS.join(' ')
    )
      .split(/[,\s]+/)
      .map((value) => value.trim())
      .filter(Boolean)

    if (!allowed.includes(clientId)) {
      throw new UnauthorizedException('Client token is not authorized for provider API access')
    }
  }

  private clientIdFromClaims(claims: Record<string, unknown>): string | undefined {
    return this.readStringClaim(claims, 'client_id') || this.readStringClaim(claims, 'azp')
  }

  private usernameFromClaims(claims: Record<string, unknown>): string | undefined {
    for (const claim of ['name', 'preferred_username', 'email']) {
      const value = this.readStringClaim(claims, claim)
      if (value) {
        return value
      }
    }
    return undefined
  }

  private readStringClaim(claims: Record<string, unknown>, name: string): string | undefined {
    const value = claims[name]
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
  }

  private readHeader(request: ProviderAuthenticatedRequest, name: string): string | undefined {
    const value = request.headers[name] || request.headers[name.toLowerCase()]
    const headerValue = Array.isArray(value) ? value[0] : value
    return typeof headerValue === 'string' && headerValue.trim() ? headerValue.trim() : undefined
  }
}
