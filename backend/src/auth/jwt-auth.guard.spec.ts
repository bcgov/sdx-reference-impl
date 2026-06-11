import { UnauthorizedException, type ExecutionContext } from '@nestjs/common'
import type { AuthenticatedRequest } from './auth.types'
import { JwtAuthGuard } from './jwt-auth.guard'
import type { UserDirectoryService } from '../users/user-directory.service'

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
  const recordAuthenticatedUser = vi.fn(async () => undefined)
  const guard = new JwtAuthGuard({
    recordAuthenticatedUser,
  } as unknown as UserDirectoryService)

  it('sets the authenticated subject and records the user from the bearer token', async () => {
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
    expect(recordAuthenticatedUser).toHaveBeenCalledWith('user-123', {
      sub: 'user-123',
      name: 'Alex Smith',
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
})
