import type { Request, Response } from 'express'
import { BffSessionService } from './bff-session.service'
import { DEFAULT_OIDC_SCOPE } from './oidc.config'

describe('BffSessionService login scopes', () => {
  const discovery = {
    authorization_endpoint: 'https://identity.test/authorize',
    token_endpoint: 'https://identity.test/token',
  }

  afterEach(() => {
    delete process.env.OIDC_AUTHORITY
    delete process.env.OIDC_CLIENT_ID
    delete process.env.OIDC_SCOPE
    vi.unstubAllGlobals()
  })

  async function beginLogin(): Promise<URL> {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(discovery), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = {
      redirect: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as Response
    const request = {
      headers: { host: 'localhost:3000' },
      protocol: 'http',
    } as unknown as Request

    await new BffSessionService().beginLogin(request, response)

    return new URL(vi.mocked(response.redirect).mock.calls[0][0] as string)
  }

  it('requests an arbitrary configured set of scopes', async () => {
    process.env.OIDC_AUTHORITY = 'https://identity.test'
    process.env.OIDC_CLIENT_ID = 'widget-bff'
    process.env.OIDC_SCOPE = 'openid nrs:widgets:read provider-audience offline_access'

    const authorizationUrl = await beginLogin()

    expect(authorizationUrl.searchParams.get('client_id')).toBe('widget-bff')
    expect(authorizationUrl.searchParams.get('scope')).toBe(process.env.OIDC_SCOPE)
  })

  it('uses the default scopes when no override is configured', async () => {
    process.env.OIDC_AUTHORITY = 'https://identity.test'

    const authorizationUrl = await beginLogin()

    expect(authorizationUrl.searchParams.get('scope')).toBe(DEFAULT_OIDC_SCOPE)
  })
})
