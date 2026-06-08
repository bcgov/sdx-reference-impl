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

  it('sets the authenticated subject from the bearer token sub claim', () => {
    const request: AuthenticatedRequest = {
      headers: {
        authorization: `Bearer ${tokenFor({ sub: 'user-123' })}`,
      },
    }

    expect(guard.canActivate(contextFor(request))).toBe(true)
    expect(request.user).toEqual({
      subject: 'user-123',
      claims: { sub: 'user-123' },
    })
  })

  it('rejects a mock subject header when no bearer token is present', () => {
    const request: AuthenticatedRequest = {
      headers: {
        'x-sdx-sub': 'user-123',
      },
    }

    expect(() => guard.canActivate(contextFor(request))).toThrow(
      new UnauthorizedException('Bearer token is required'),
    )
  })

  it('rejects a bearer token without a sub claim', () => {
    const request: AuthenticatedRequest = {
      headers: {
        authorization: `Bearer ${tokenFor({ scope: 'SDX-RI.widgets.read' })}`,
      },
    }

    expect(() => guard.canActivate(contextFor(request))).toThrow(
      new UnauthorizedException('JWT sub claim is required'),
    )
  })
})
