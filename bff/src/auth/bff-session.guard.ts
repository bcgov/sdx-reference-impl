import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import type { BffAuthenticatedRequest } from './auth.types'
import { BffSessionService } from './bff-session.service'

@Injectable()
export class BffSessionGuard implements CanActivate {
  constructor(private readonly sessions: BffSessionService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<BffAuthenticatedRequest>()
    request.bffSession = this.sessions.requireSession(request)
    return true
  }
}
