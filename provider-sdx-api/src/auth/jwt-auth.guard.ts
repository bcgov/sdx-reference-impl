import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { AuthenticatedRequest } from './auth.types'
import { JwtTokenValidator } from './jwt-token.validator'
import { REQUIRED_SCOPES_KEY } from './required-scopes.decorator'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly tokenValidator = new JwtTokenValidator({
    validateSignature: false,
    validateExpiry: false,
  })

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const claims = await this.getClaims(request)
    const subject = this.readStringClaim(claims, 'sub')

    if (!subject) {
      throw new UnauthorizedException('JWT sub claim is required')
    }

    this.validateRequiredAudiences(claims)
    this.validateRequiredScopes(context, claims)
    this.validateClientSubsystem(request)
    this.validateOriginalAzp(request)

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

  private validateRequiredScopes(context: ExecutionContext, claims: Record<string, unknown>): void {
    if (!this.scopeValidationEnabled()) {
      return
    }

    const requiredScopes =
      this.reflector.getAllAndOverride<string[]>(REQUIRED_SCOPES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? []
    if (requiredScopes.length === 0) {
      return
    }

    const grantedScopes = this.readScopes(claims)
    const missingScopes = requiredScopes.filter((scope) => !grantedScopes.has(scope))
    if (missingScopes.length > 0) {
      throw new ForbiddenException(`JWT is missing required scope: ${missingScopes.join(', ')}`)
    }
  }

  private validateRequiredAudiences(claims: Record<string, unknown>): void {
    const requiredAudiences = this.readConfiguredValues('JWT_REQUIRED_AUDIENCES')
    if (requiredAudiences.length === 0) {
      return
    }

    const audienceClaim = claims.aud
    const tokenAudiences = new Set(
      typeof audienceClaim === 'string'
        ? [audienceClaim]
        : Array.isArray(audienceClaim)
          ? audienceClaim.filter((value): value is string => typeof value === 'string')
          : [],
    )
    if (requiredAudiences.some((audience) => !tokenAudiences.has(audience))) {
      throw new UnauthorizedException('JWT audience is invalid')
    }
  }

  private validateClientSubsystem(request: AuthenticatedRequest): void {
    const expectedSubsystem = process.env.SDX_CLIENT_SUBSYSTEM_ID?.trim()
    if (!expectedSubsystem) {
      return
    }

    const actualSubsystem = this.readHeader(request, 'x-sdx-client-subsystem-id')?.trim()
    if (actualSubsystem !== expectedSubsystem) {
      throw new UnauthorizedException('SDX client subsystem is invalid')
    }
  }

  private validateOriginalAzp(request: AuthenticatedRequest): void {
    const expectedOriginalAzp = process.env.SDX_ORIGINAL_AZP?.trim()
    if (!expectedOriginalAzp) {
      return
    }

    const actualOriginalAzp = this.readHeader(request, 'x-sdx-original-azp')?.trim()
    if (actualOriginalAzp !== expectedOriginalAzp) {
      throw new UnauthorizedException('SDX original AZP is invalid')
    }
  }

  private readScopes(claims: Record<string, unknown>): Set<string> {
    const scopes = new Set<string>()
    for (const claimName of ['scope', 'scp']) {
      const value = claims[claimName]
      if (typeof value === 'string') {
        for (const scope of value.split(/\s+/)) {
          if (scope) {
            scopes.add(scope)
          }
        }
      } else if (Array.isArray(value)) {
        for (const scope of value) {
          if (typeof scope === 'string' && scope.trim()) {
            scopes.add(scope.trim())
          }
        }
      }
    }
    return scopes
  }

  private scopeValidationEnabled(): boolean {
    const value = process.env.JWT_VALIDATE_SCOPES?.trim().toLowerCase()
    if (value === undefined || value === '') {
      return true
    }
    return !['false', '0', 'no', 'n', 'off'].includes(value)
  }

  private readConfiguredValues(name: string): string[] {
    return (process.env[name] ?? '')
      .split(/[\s,]+/)
      .map((value) => value.trim())
      .filter(Boolean)
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
