import type { Request, Response } from 'express'
import { BffSessionService } from './bff-session.service'
import { DEFAULT_OIDC_SCOPE } from './oidc.config'

const tokenFor = (claims: Record<string, unknown>) => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return `${header}.${payload}.`
}

describe('BffSessionService login scopes', () => {
  const discovery = {
    authorization_endpoint: 'https://identity.test/authorize',
    token_endpoint: 'https://identity.test/token',
  }

  afterEach(() => {
    delete process.env.OIDC_AUTHORITY
    delete process.env.OIDC_CLIENT_ID
    delete process.env.OIDC_CLIENT_SECRET
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

  it('recovers from an invalid callback state by clearing the login cookie', async () => {
    const response = {
      redirect: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as Response
    const request = {
      headers: { cookie: 'bff_login=expected-state' },
      query: {
        code: 'authorization-code',
        state: 'expected-state',
      },
    } as unknown as Request

    await new BffSessionService().completeLogin(request, response)

    expect(response.setHeader).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.stringContaining('bff_login=; Max-Age=0'),
    )
    expect(response.redirect).toHaveBeenCalledWith('/login?reason=oidc-session-expired')
  })

  it('preserves a newer login when an older callback arrives first', async () => {
    process.env.OIDC_AUTHORITY = 'https://identity.test'
    process.env.OIDC_CLIENT_SECRET = 'client-secret'
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(discovery), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: tokenFor({ sub: 'user-123' }), expires_in: 300 }),
          {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const service = new BffSessionService()
    const loginRequest = {
      headers: { host: 'localhost:3000' },
      protocol: 'http',
    } as unknown as Request
    const firstLoginResponse = {
      redirect: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as Response
    const secondLoginResponse = {
      redirect: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as Response

    await service.beginLogin(loginRequest, firstLoginResponse)
    await service.beginLogin(loginRequest, secondLoginResponse)
    const firstState = new URL(
      vi.mocked(firstLoginResponse.redirect).mock.calls[0][0] as string,
    ).searchParams.get('state')!
    const secondState = new URL(
      vi.mocked(secondLoginResponse.redirect).mock.calls[0][0] as string,
    ).searchParams.get('state')!

    const staleCallbackResponse = {
      redirect: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as Response
    await service.completeLogin(
      {
        headers: { cookie: `bff_login=${secondState}` },
        query: { code: 'first-code', state: firstState },
      } as unknown as Request,
      staleCallbackResponse,
    )

    expect(staleCallbackResponse.setHeader).not.toHaveBeenCalled()
    expect(staleCallbackResponse.redirect).toHaveBeenCalledWith(
      '/login?reason=oidc-session-expired',
    )

    const currentCallbackResponse = {
      redirect: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as Response
    await service.completeLogin(
      {
        headers: { cookie: `bff_login=${secondState}` },
        query: { code: 'second-code', state: secondState },
      } as unknown as Request,
      currentCallbackResponse,
    )

    expect(currentCallbackResponse.setHeader).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.arrayContaining([expect.stringContaining('bff_session=')]),
    )
    expect(currentCallbackResponse.redirect).toHaveBeenCalledWith('/widgets')
  })
})
