import { applyDecorators, SetMetadata } from '@nestjs/common'
import { ApiSecurity } from '@nestjs/swagger'

export const REQUIRED_SCOPES_KEY = 'requiredScopes'

export const RequiredScopes = (...scopes: string[]) =>
  applyDecorators(SetMetadata(REQUIRED_SCOPES_KEY, scopes), ApiSecurity('openId', scopes))
