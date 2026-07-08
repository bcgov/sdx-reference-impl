import { UnauthorizedException, type ExecutionContext } from '@nestjs/common'
import type { AuthenticatedRequest } from './auth.types'
import { JwtAuthGuard } from './jwt-auth.guard'

const tokenFor = (claims: Record<string, unknown>) => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return `${header}.${payload}.`
}

const contextFor = (request: AuthenticatedRequest): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  }) as ExecutionContext

describe('JwtAuthGuard', () => {
  const guard = new JwtAuthGuard()

  afterEach(() => {
    delete process.env.JWT_VALIDATE_EXPIRY
    delete process.env.OIDC_AUTHORITY
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
})
