import { BadRequestException, UnauthorizedException, type ExecutionContext } from '@nestjs/common'
import type { ProviderAuthenticatedRequest } from './auth.types'
import { ProviderServiceAuthGuard } from './provider-service-auth.guard'
import type { UserDirectoryService } from '../users/user-directory.service'

const tokenFor = (claims: Record<string, unknown>) => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return `${header}.${payload}.`
}

const contextFor = (request: ProviderAuthenticatedRequest): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  }) as ExecutionContext

describe('ProviderServiceAuthGuard', () => {
  const recordAuthenticatedUser = vi.fn(async () => undefined)
  const userDirectory = {
    recordAuthenticatedUser,
  } as unknown as UserDirectoryService
  const guard = new ProviderServiceAuthGuard(userDirectory)

  beforeEach(() => {
    process.env.JWT_VALIDATE_SIGNATURE = 'false'
    process.env.JWT_VALIDATE_EXPIRY = 'false'
    recordAuthenticatedUser.mockClear()
  })

  afterEach(() => {
    delete process.env.PROVIDER_API_ALLOWED_CLIENT_IDS
    delete process.env.JWT_VALIDATE_SIGNATURE
    delete process.env.JWT_VALIDATE_EXPIRY
    delete process.env.JWT_ISSUER
  })

  it('requires on-behalf-of headers for client tokens', async () => {
    const request: ProviderAuthenticatedRequest = {
      headers: {
        authorization: `Bearer ${tokenFor({
          sub: 'local-provider-sdx-api',
          client_id: 'local-provider-sdx-api',
          grant_type: 'client_credentials',
        })}`,
      },
    }

    await expect(guard.canActivate(contextFor(request))).rejects.toEqual(
      new BadRequestException(
        'x-on-behalf-of-sub and x-on-behalf-of-username headers are required for client tokens',
      ),
    )
  })

  it('accepts allowed client tokens with on-behalf-of headers', async () => {
    const request: ProviderAuthenticatedRequest = {
      headers: {
        authorization: `Bearer ${tokenFor({
          sub: 'local-provider-sdx-api',
          client_id: 'local-provider-sdx-api',
          grant_type: 'client_credentials',
        })}`,
        'x-on-behalf-of-sub': 'user-123',
        'x-on-behalf-of-username': 'Alex Smith',
      },
    }

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true)
    expect(request.providerCaller).toEqual({
      tokenSubject: 'local-provider-sdx-api',
      claims: {
        sub: 'local-provider-sdx-api',
        client_id: 'local-provider-sdx-api',
        grant_type: 'client_credentials',
      },
      clientToken: true,
      clientId: 'local-provider-sdx-api',
      onBehalfOfSubject: 'user-123',
      onBehalfOfUsername: 'Alex Smith',
    })
  })

  it('rejects unauthorized client tokens', async () => {
    process.env.PROVIDER_API_ALLOWED_CLIENT_IDS = 'local-provider-sdx-api'
    const request: ProviderAuthenticatedRequest = {
      headers: {
        authorization: `Bearer ${tokenFor({
          sub: 'other-client',
          client_id: 'other-client',
          grant_type: 'client_credentials',
        })}`,
        'x-on-behalf-of-sub': 'user-123',
        'x-on-behalf-of-username': 'Alex Smith',
      },
    }

    await expect(guard.canActivate(contextFor(request))).rejects.toEqual(
      new UnauthorizedException('Client token is not authorized for provider API access'),
    )
  })

  it('defaults to requiring signature validation', async () => {
    delete process.env.JWT_VALIDATE_SIGNATURE
    delete process.env.JWT_VALIDATE_EXPIRY
    process.env.JWT_ISSUER = 'https://issuer.test'
    const strictGuard = new ProviderServiceAuthGuard(userDirectory)
    const request: ProviderAuthenticatedRequest = {
      headers: {
        authorization: `Bearer ${tokenFor({
          sub: 'local-provider-sdx-api',
          client_id: 'local-provider-sdx-api',
          grant_type: 'client_credentials',
          iss: 'https://issuer.test',
          exp: Math.floor(Date.now() / 1000) + 300,
        })}`,
        'x-on-behalf-of-sub': 'user-123',
        'x-on-behalf-of-username': 'Alex Smith',
      },
    }

    await expect(strictGuard.canActivate(contextFor(request))).rejects.toEqual(
      new UnauthorizedException('JWT signature validation failed'),
    )
  })

  it('validates issuer when JWT_ISSUER is configured', async () => {
    process.env.JWT_ISSUER = 'https://issuer.test'
    const request: ProviderAuthenticatedRequest = {
      headers: {
        authorization: `Bearer ${tokenFor({
          sub: 'local-provider-sdx-api',
          client_id: 'local-provider-sdx-api',
          grant_type: 'client_credentials',
          iss: 'https://other-issuer.test',
        })}`,
        'x-on-behalf-of-sub': 'user-123',
        'x-on-behalf-of-username': 'Alex Smith',
      },
    }

    await expect(guard.canActivate(contextFor(request))).rejects.toEqual(
      new UnauthorizedException('JWT issuer is invalid'),
    )
  })

  it('records represented users from on-behalf-of headers for client tokens', async () => {
    const request: ProviderAuthenticatedRequest = {
      headers: {
        authorization: `Bearer ${tokenFor({
          sub: 'local-provider-sdx-api',
          client_id: 'local-provider-sdx-api',
          grant_type: 'client_credentials',
        })}`,
        'x-on-behalf-of-sub': 'user-123',
        'x-on-behalf-of-username': 'Alex Smith',
      },
    }

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true)

    expect(recordAuthenticatedUser).toHaveBeenCalledWith('user-123', { name: 'Alex Smith' })
  })

  it('records represented users from JWT claims for user tokens', async () => {
    const claims = {
      sub: 'user-123',
      name: 'Alex Smith',
      preferred_username: 'asmith',
    }
    const request: ProviderAuthenticatedRequest = {
      headers: {
        authorization: `Bearer ${tokenFor(claims)}`,
      },
    }

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true)

    expect(request.providerCaller).toEqual({
      tokenSubject: 'user-123',
      claims,
      clientToken: false,
      clientId: undefined,
      onBehalfOfSubject: 'user-123',
      onBehalfOfUsername: 'Alex Smith',
    })
    expect(recordAuthenticatedUser).toHaveBeenCalledWith('user-123', claims)
  })
})
