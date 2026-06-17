const oidcConfig = {
  authority: 'https://identity.example.com/realms/sdx',
}

function runtimeResponse(body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      json: async () => body,
      ok: true,
    }),
  )
}

describe('runtime configuration', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  test('requires the API base URL', async () => {
    runtimeResponse({ oidc: oidcConfig })
    const { loadRuntimeConfig } = await import('./config')

    await expect(loadRuntimeConfig()).rejects.toThrow('Missing required API configuration')
  })

  test('accepts an absolute API base URL', async () => {
    runtimeResponse({
      api: {
        baseUrl: 'https://widgets-api-gov-bc-ca.dev.api.gov.bc.ca/api/v1',
      },
      oidc: oidcConfig,
    })
    const { getApiConfig, loadRuntimeConfig } = await import('./config')

    await loadRuntimeConfig()

    expect(getApiConfig()).toEqual({
      baseUrl: 'https://widgets-api-gov-bc-ca.dev.api.gov.bc.ca/api/v1',
    })
  })

  test('rejects an invalid API base URL', async () => {
    runtimeResponse({
      api: {
        baseUrl: 'widgets-api-gov-bc-ca.dev.api.gov.bc.ca/api/v1',
      },
      oidc: oidcConfig,
    })
    const { loadRuntimeConfig } = await import('./config')

    await expect(loadRuntimeConfig()).rejects.toThrow('Invalid API configuration')
  })

  test('rejects a root-relative API base URL', async () => {
    runtimeResponse({
      api: {
        baseUrl: '/api/v1',
      },
      oidc: oidcConfig,
    })
    const { loadRuntimeConfig } = await import('./config')

    await expect(loadRuntimeConfig()).rejects.toThrow('Invalid API configuration')
  })
})
