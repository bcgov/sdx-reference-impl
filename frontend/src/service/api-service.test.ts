const absoluteApiUrl = 'https://widgets-api-gov-bc-ca.dev.api.gov.bc.ca/api/v1'

describe('API service', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  test('requires runtime configuration before initialization', async () => {
    const { APIService } = await import('./api-service')

    expect(() => new APIService().initialize()).toThrow('Runtime configuration has not been loaded')
  })

  test('uses the configured BFF base URL with credentials', async () => {
    vi.doMock('@/auth/oidc', () => ({
      removeLocalUser: vi.fn(),
    }))
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          api: { baseUrl: absoluteApiUrl },
          oidc: { authority: 'https://identity.example.com/realms/sdx' },
        }),
        ok: true,
      }),
    )

    const { loadRuntimeConfig } = await import('@/auth/config')
    await loadRuntimeConfig()
    const { APIService } = await import('./api-service')
    const service = new APIService()
    service.initialize()

    const client = service.getAxiosInstance()
    let authorization: unknown
    let baseUrl: unknown
    let withCredentials: unknown
    client.defaults.adapter = async (request) => {
      authorization = request.headers.get('Authorization')
      baseUrl = request.baseURL
      withCredentials = request.withCredentials
      return {
        config: request,
        data: {},
        headers: {},
        status: 200,
        statusText: 'OK',
      }
    }

    await client.get('/widgets')

    expect(baseUrl).toBe(absoluteApiUrl)
    expect(withCredentials).toBe(true)
    expect(authorization).toBeUndefined()
  })
})
