import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { BffAuthenticatedRequest, BffSession } from './auth.types'

export const CurrentBffSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): BffSession => {
    const request = context.switchToHttp().getRequest<BffAuthenticatedRequest>()
    if (!request.bffSession) {
      throw new Error('BFF session was not attached to the request')
    }
    return request.bffSession
  },
)
