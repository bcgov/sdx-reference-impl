import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { AuthenticatedRequest, AuthenticatedUser } from './auth.types'

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>()
    return request.user
  },
)
