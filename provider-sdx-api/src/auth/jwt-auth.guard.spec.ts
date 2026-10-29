import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { AuthenticatedRequest } from './auth.types'
import { JwtAuthGuard } from './jwt-auth.guard'
import { REQUIRED_SCOPES_KEY } from './required-scopes.decorator'

const tokenFor = (claims: Record<string, unknown>) => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return `${header}.${payload}.`
}

const contextFor = (
  request: AuthenticatedRequest,
  requiredScopes: string[] = [],
): ExecutionContext => {
  const handler = () => undefined
  Reflect.defineMetadata(REQUIRED_SCOPES_KEY, requiredScopes, handler)
  return {
    getClass: () => class TestController {},
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext
}

describe('JwtAuthGuard', () => {
  const guard = new JwtAuthGuard(new Reflector())

  afterEach(() => {
    delete process.env.JWT_VALIDATE_EXPIRY
    delete process.env.JWT_VALIDATE_SCOPES
    delete process.env.JWT_REQUIRED_AUDIENCES
    delete process.env.OIDC_AUTHORITY
    delete process.env.SDX_CLIENT_SUBSYSTEM_ID
    delete process.env.SDX_ORIGINAL_AZP
  })

  it('sets the authenticated subject from the bearer token', async () => {
    const request: AuthenticatedRequest = {
      headers: {
        authorization: `Bearer ${tokenFor({ sub: 'user-123', name: 'Alex Smith' })}`,
      },
    }

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true)
    expect(request.user).toEqual({
      subject: 'user-123',
      claims: { sub: 'user-123', name: 'Alex Smith' },
    })
  })

  it('rejects a mock subject header when no bearer token is present', async () => {
    const request: AuthenticatedRequest = {
      headers: {
        'x-sdx-sub': 'user-123',
      },
    }

    await expect(guard.canActivate(contextFor(request))).rejects.toEqual(
      new UnauthorizedException('Bearer token is required'),
    )
  })

  it('rejects a bearer token without a sub claim', async () => {
    const request: AuthenticatedRequest = {
      headers: {
        authorization: `Bearer ${tokenFor({ scope: 'nrs:widgets:read' })}`,
      },
    }

    await expect(guard.canActivate(contextFor(request))).rejects.toEqual(
      new UnauthorizedException('JWT sub claim is required'),
    )
  })

  it('defaults to not validating token expiry', async () => {
    const request: AuthenticatedRequest = {
      headers: {
        authorization: `Bearer ${tokenFor({ sub: 'user-123', exp: 1 })}`,
      },
    }

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true)
  })

  it('does not validate issuer by default when OIDC_AUTHORITY is configured', async () => {
    process.env.OIDC_AUTHORITY = 'https://issuer.test'
    const request: AuthenticatedRequest = {
      headers: {
        authorization: `Bearer ${tokenFor({ sub: 'user-123', iss: 'https://other.test' })}`,
      },
    }

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true)
  })

  it('validates token expiry when enabled', async () => {
    process.env.JWT_VALIDATE_EXPIRY = 'true'
    const request: AuthenticatedRequest = {
      headers: {
        authorization: `Bearer ${tokenFor({ sub: 'user-123', exp: 1 })}`,
      },
    }

    await expect(guard.canActivate(contextFor(request))).rejects.toEqual(
      new UnauthorizedException('JWT is expired'),
    )
  })

  it('accepts the scope required by the operation', async () => {
    const request: AuthenticatedRequest = {
      headers: {
        authorization: `Bearer ${tokenFor({
          sub: 'user-123',
          scope: 'openid nrs:widgets:read profile',
        })}`,
      },
    }

    await expect(guard.canActivate(contextFor(request, ['nrs:widgets:read']))).resolves.toBe(true)
  })

  it('accepts required scopes from a string array scp claim', async () => {
    const request: AuthenticatedRequest = {
      headers: {
        authorization: `Bearer ${tokenFor({
          sub: 'user-123',
          scp: ['nrs:widgets:read', 'nrs:widgets:update'],
        })}`,
      },
    }

    await expect(
      guard.canActivate(contextFor(request, ['nrs:widgets:read', 'nrs:widgets:update'])),
    ).resolves.toBe(true)
  })

  it('rejects a token missing a scope required by the operation', async () => {
    const request: AuthenticatedRequest = {
      headers: {
        authorization: `Bearer ${tokenFor({
          sub: 'user-123',
          scope: 'nrs:widgets:read',
        })}`,
      },
    }

    await expect(guard.canActivate(contextFor(request, ['nrs:widgets:update']))).rejects.toEqual(
      new ForbiddenException('JWT is missing required scope: nrs:widgets:update'),
    )
  })

  it('rejects a token without a scope claim when the operation requires one', async () => {
    const request: AuthenticatedRequest = {
      headers: {
        authorization: `Bearer ${tokenFor({ sub: 'user-123' })}`,
      },
    }

    await expect(guard.canActivate(contextFor(request, ['nrs:widgets:read']))).rejects.toEqual(
      new ForbiddenException('JWT is missing required scope: nrs:widgets:read'),
    )
  })

  it('skips required-scope validation when disabled', async () => {
    process.env.JWT_VALIDATE_SCOPES = 'false'
    const request: AuthenticatedRequest = {
      headers: {
        authorization: `Bearer ${tokenFor({ sub: 'user-123' })}`,
      },
    }

    await expect(guard.canActivate(contextFor(request, ['nrs:widgets:read']))).resolves.toBe(true)
  })

  it('fails closed when scope-validation configuration is not recognized', async () => {
    process.env.JWT_VALIDATE_SCOPES = 'treu'
    const request: AuthenticatedRequest = {
      headers: {
        authorization: `Bearer ${tokenFor({ sub: 'user-123' })}`,
      },
    }

    await expect(guard.canActivate(contextFor(request, ['nrs:widgets:read']))).rejects.toEqual(
      new ForbiddenException('JWT is missing required scope: nrs:widgets:read'),
    )
  })

  it('accepts all configured required audiences from an array aud claim', async () => {
    process.env.JWT_REQUIRED_AUDIENCES = 'sdx-pz-client, provider-sdx-api'
    const request: AuthenticatedRequest = {
      headers: {
        authorization: `Bearer ${tokenFor({
          sub: 'user-123',
          aud: ['sdx-pz-client', 'provider-sdx-api', 'other-audience'],
        })}`,
      },
    }

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true)
  })

  it('accepts a configured required audience from a string aud claim', async () => {
    process.env.JWT_REQUIRED_AUDIENCES = 'sdx-pz-client'
    const request: AuthenticatedRequest = {
      headers: {
        authorization: `Bearer ${tokenFor({ sub: 'user-123', aud: 'sdx-pz-client' })}`,
      },
    }

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true)
  })

  it('rejects a token missing any configured required audience', async () => {
    process.env.JWT_REQUIRED_AUDIENCES = 'sdx-pz-client provider-sdx-api'
    const request: AuthenticatedRequest = {
      headers: {
        authorization: `Bearer ${tokenFor({ sub: 'user-123', aud: ['sdx-pz-client'] })}`,
      },
    }

    await expect(guard.canActivate(contextFor(request))).rejects.toEqual(
      new UnauthorizedException('JWT audience is invalid'),
    )
  })

  it('accepts the configured SDX client subsystem header', async () => {
    process.env.SDX_CLIENT_SUBSYSTEM_ID = 'APSDEV.MIN.WIDG.WIDGETS-RI-UI'
    const request: AuthenticatedRequest = {
      headers: {
        authorization: `Bearer ${tokenFor({ sub: 'user-123' })}`,
        'x-sdx-client-subsystem-id': 'APSDEV.MIN.WIDG.WIDGETS-RI-UI',
      },
    }

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true)
  })

  it('rejects a missing SDX client subsystem header when configured', async () => {
    process.env.SDX_CLIENT_SUBSYSTEM_ID = 'APSDEV.MIN.WIDG.WIDGETS-RI-UI'
    const request: AuthenticatedRequest = {
      headers: {
        authorization: `Bearer ${tokenFor({ sub: 'user-123' })}`,
      },
    }

    await expect(guard.canActivate(contextFor(request))).rejects.toEqual(
      new UnauthorizedException('SDX client subsystem is invalid'),
    )
  })

  it('rejects a mismatched SDX client subsystem header when configured', async () => {
    process.env.SDX_CLIENT_SUBSYSTEM_ID = 'APSDEV.MIN.WIDG.WIDGETS-RI-UI'
    const request: AuthenticatedRequest = {
      headers: {
        authorization: `Bearer ${tokenFor({ sub: 'user-123' })}`,
        'x-sdx-client-subsystem-id': 'APSDEV.MIN.OTHER.CLIENT',
      },
    }

    await expect(guard.canActivate(contextFor(request))).rejects.toEqual(
      new UnauthorizedException('SDX client subsystem is invalid'),
    )
  })
  it('accepts the configured SDX original AZP header', async () => {
    process.env.SDX_ORIGINAL_AZP = 'dev-widget-bff'
    const request: AuthenticatedRequest = {
      headers: {
        authorization: `Bearer ${tokenFor({ sub: 'user-123' })}`,
        'x-sdx-original-azp': 'dev-widget-bff',
      },
    }

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true)
  })

  it('rejects a missing SDX original AZP header when configured', async () => {
    process.env.SDX_ORIGINAL_AZP = 'dev-widget-bff'
    const request: AuthenticatedRequest = {
      headers: {
        authorization: `Bearer ${tokenFor({ sub: 'user-123' })}`,
      },
    }

    await expect(guard.canActivate(contextFor(request))).rejects.toEqual(
      new UnauthorizedException('SDX original AZP is invalid'),
    )
  })

  it('rejects a mismatched SDX original AZP header when configured', async () => {
    process.env.SDX_ORIGINAL_AZP = 'dev-widget-bff'
    const request: AuthenticatedRequest = {
      headers: {
        authorization: `Bearer ${tokenFor({ sub: 'user-123' })}`,
        'x-sdx-original-azp': 'other-client',
      },
    }

    await expect(guard.canActivate(contextFor(request))).rejects.toEqual(
      new UnauthorizedException('SDX original AZP is invalid'),
    )
  })
})
