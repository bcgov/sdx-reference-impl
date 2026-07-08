import { HttpException } from '@nestjs/common'
import { WidgetsService } from './widgets.service'

describe('WidgetsService proxy adapter', () => {
  const fetchMock = vi.fn()
  let service: WidgetsService

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    process.env.PROVIDER_API_BASE_URL = 'http://provider-api.test/api/v1'
    process.env.PROVIDER_API_TOKEN_URL =
      'https://issuer.test/realms/sdx/protocol/openid-connect/token'
    process.env.PROVIDER_API_CLIENT_ID = 'local-provider-sdx-api'
    process.env.PROVIDER_API_CLIENT_SECRET = 'service-secret'
    service = new WidgetsService()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.PROVIDER_API_BASE_URL
    delete process.env.PROVIDER_API_CLIENT_ID
    delete process.env.PROVIDER_API_CLIENT_SECRET
    delete process.env.PROVIDER_API_TOKEN_SCOPE
    delete process.env.PROVIDER_API_TOKEN_URL
    delete process.env.OIDC_AUTHORITY
    delete process.env.OIDC_OPENID_CONNECT_URL
    fetchMock.mockReset()
  })

  it('creates widgets for the JWT subject through the provider API subject path', async () => {
    mockTokenResponse()
    mockWidgetResponse(201)

    await service.createForSubject('alice', 'Alice Smith', { name: 'Intake form' }, 'req-12345678')

    expect(fetchMock).toHaveBeenCalledWith(
      'http://provider-api.test/api/v1/subjects/alice/widgets',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Intake form' }),
      }),
    )
    const headers = fetchMock.mock.calls[1][1].headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer client-token')
    expect(headers.get('x-on-behalf-of-sub')).toBe('alice')
    expect(headers.get('x-on-behalf-of-username')).toBe('Alice Smith')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('Idempotency-Key')).toBe('req-12345678')
  })

  it('adds the JWT subject to provider API write bodies', async () => {
    mockTokenResponse()
    mockWidgetResponse(200, { name: 'Updated', updatedAt: '2026-05-13T18:30:00.000Z' })

    await service.patchForSubject('4f3066e8-5a59-4fc5-8e7b-fcd7f4d01c4f', 'alice', 'Alice Smith', {
      name: 'Updated',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://provider-api.test/api/v1/widgets/4f3066e8-5a59-4fc5-8e7b-fcd7f4d01c4f',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated', subject: 'alice' }),
      }),
    )
  })

  it('relays provider API error responses', async () => {
    mockTokenResponse()
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ error: 'not_found', message: 'Widget not found' }),
    })

    await expect(
      service.getForSubject('4f3066e8-5a59-4fc5-8e7b-fcd7f4d01c4f', 'alice', 'Alice Smith'),
    ).rejects.toBeInstanceOf(HttpException)
  })

  it('obtains a provider API service token with client credentials', async () => {
    process.env.PROVIDER_API_TOKEN_SCOPE = 'provider-api'
    process.env.OIDC_AUTHORITY = 'https://issuer.test/realms/sdx'
    delete process.env.PROVIDER_API_TOKEN_URL
    service = new WidgetsService()
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            token_endpoint: 'https://issuer.test/realms/sdx/protocol/openid-connect/token',
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ access_token: 'client-token', expires_in: 300 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            id: '4f3066e8-5a59-4fc5-8e7b-fcd7f4d01c4f',
            subject: 'alice',
            name: 'Intake form',
            status: 'active',
            additionalData: {},
            createdAt: '2026-05-13T18:00:00.000Z',
            updatedAt: '2026-05-13T18:00:00.000Z',
          }),
      })

    await service.getForSubject('4f3066e8-5a59-4fc5-8e7b-fcd7f4d01c4f', 'alice', 'Alice Smith')

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://issuer.test/realms/sdx/.well-known/openid-configuration',
    )
    const tokenRequest = fetchMock.mock.calls[1]
    expect(tokenRequest[0]).toBe('https://issuer.test/realms/sdx/protocol/openid-connect/token')
    expect(tokenRequest[1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    )
    expect((tokenRequest[1].body as URLSearchParams).toString()).toBe(
      'grant_type=client_credentials&client_id=local-provider-sdx-api&client_secret=service-secret&scope=provider-api',
    )
    const headers = fetchMock.mock.calls[2][1].headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer client-token')
    expect(headers.get('x-on-behalf-of-sub')).toBe('alice')
    expect(headers.get('x-on-behalf-of-username')).toBe('Alice Smith')
  })

  it('fails loudly when client-credentials auth is not configured', async () => {
    delete process.env.PROVIDER_API_CLIENT_SECRET
    process.env.OIDC_AUTHORITY = 'https://issuer.test/realms/sdx'
    service = new WidgetsService()

    await expect(
      service.getForSubject('4f3066e8-5a59-4fc5-8e7b-fcd7f4d01c4f', 'alice', 'Alice Smith'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        message:
          'PROVIDER_API_CLIENT_SECRET is required for provider API client-credentials authentication',
      }),
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  function mockTokenResponse() {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ access_token: 'client-token', expires_in: 300 }),
    })
  }

  function mockWidgetResponse(status: number, overrides: Record<string, unknown> = {}) {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status,
      text: async () =>
        JSON.stringify({
          id: '4f3066e8-5a59-4fc5-8e7b-fcd7f4d01c4f',
          subject: 'alice',
          name: 'Intake form',
          status: 'active',
          additionalData: {},
          createdAt: '2026-05-13T18:00:00.000Z',
          updatedAt: '2026-05-13T18:00:00.000Z',
          ...overrides,
        }),
    })
  }
})
