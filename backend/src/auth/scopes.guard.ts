import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { REQUIRED_SCOPES_KEY } from './scopes.decorator'
import type { AuthenticatedRequest } from './auth.types'

@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScopes = this.reflector.getAllAndOverride<string[]>(REQUIRED_SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!requiredScopes?.length) {
      return true
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const scopes = new Set(request.user?.scopes || [])
    const hasRequiredScope = requiredScopes.every((scope) => scopes.has(scope))

    if (!hasRequiredScope) {
      throw new ForbiddenException(`Required scope missing: ${requiredScopes.join(' ')}`)
    }

    return true
  }
}
