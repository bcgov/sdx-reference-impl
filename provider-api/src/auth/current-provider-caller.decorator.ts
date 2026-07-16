import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { ProviderAuthenticatedRequest, ProviderCaller } from './auth.types'

export const CurrentProviderCaller = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ProviderCaller => {
    const request = ctx.switchToHttp().getRequest<ProviderAuthenticatedRequest>()
    return request.providerCaller
  },
)
