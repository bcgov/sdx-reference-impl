import type { NestExpressApplication } from '@nestjs/platform-express'
import request from 'supertest'
import { bootstrap } from './app'

vi.mock('prom-client', () => ({
  Registry: vi.fn().mockImplementation(() => ({})),
  collectDefaultMetrics: vi.fn().mockImplementation(() => ({})),
}))
vi.mock('express-prom-bundle', () => ({
  default: vi.fn().mockImplementation(() => ({})),
}))
vi.mock('src/middleware/prom', () => ({
  metricsMiddleware: vi.fn().mockImplementation((_req, _res, next) => next()),
}))

describe('main', () => {
  let app: NestExpressApplication
  const fetchMock = vi.fn()

  beforeAll(async () => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        authorization_endpoint: 'https://identity.example.com/realms/test/oauth2/authorize',
        token_endpoint: 'https://identity.example.com/realms/test/oauth2/token',
      }),
    })
    process.env.OIDC_AUTHORITY = 'https://identity.example.com/realms/test'
    process.env.SWAGGER_OAUTH_CLIENT_ID = 'swagger-test-client'
    process.env.SWAGGER_OAUTH_REDIRECT_URL = 'http://localhost:3001/api/docs/oauth2-redirect.html'
    process.env.SWAGGER_OAUTH_SCOPES =
      'openid profile nrs:widgets:read nrs:widgets:create nrs:widgets:update nrs:widgets:delete nrs:widgets:admin'
    app = await bootstrap()
  })

  afterAll(async () => {
    await app.close()
    vi.unstubAllGlobals()
  })

  it('should start the application', async () => {
    expect(app).toBeDefined()
  })

  it('publishes only the discovered OAuth2 authorization-code flow', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json').expect(200)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://identity.example.com/realms/test/.well-known/openid-configuration',
    )
    expect(response.body.components.securitySchemes.openId).toEqual({
      type: 'oauth2',
      description: 'Access token with the scope specified by each operation.',
      flows: {
        authorizationCode: {
          authorizationUrl: 'https://identity.example.com/realms/test/oauth2/authorize',
          tokenUrl: 'https://identity.example.com/realms/test/oauth2/token',
          scopes: {
            openid: 'Authenticate the user with OpenID Connect.',
            profile: "Read the user's basic profile claims.",
            'nrs:widgets:read': 'Read widgets.',
            'nrs:widgets:create': 'Create widgets.',
            'nrs:widgets:update': 'Update widgets.',
            'nrs:widgets:delete': 'Delete widgets.',
            'nrs:widgets:admin': 'Administer widgets across users.',
          },
        },
      },
    })
    expect(response.body.servers).toEqual([
      {
        url: '/api/v1',
        description: 'Widgets API on the same origin as this documentation',
      },
    ])
  })

  it('initializes Swagger authorization with a public PKCE client', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs/swagger-ui-init.js')
      .expect(200)

    expect(response.text).toContain('"clientId": "swagger-test-client"')
    expect(response.text).toContain('"usePkceWithAuthorizationCodeGrant": true')
    expect(response.text).toContain(
      '"oauth2RedirectUrl": "http://localhost:3001/api/docs/oauth2-redirect.html"',
    )
    expect(response.text).toContain('"nrs:widgets:admin"')
  })

  it('loads a helper that preserves the Swagger OAuth popup opener', async () => {
    const docsResponse = await request(app.getHttpServer()).get('/api/docs').expect(200)
    const scriptResponse = await request(app.getHttpServer())
      .get('/api/docs/swagger-oauth-popup.js')
      .expect(200)

    expect(docsResponse.text).toContain("<script src='/api/docs/swagger-oauth-popup.js'></script>")
    expect(scriptResponse.headers['content-type']).toContain('application/javascript')
    expect(scriptResponse.text).toContain("'swagger-oauth2'")
    expect(scriptResponse.text).toContain('https://identity.example.com')
  })

  it('relays the OAuth response without relying on window.opener', async () => {
    const redirectResponse = await request(app.getHttpServer())
      .get('/api/docs/oauth2-redirect.html?code=test-code&state=test-state')
      .expect(200)
    const callbackResponse = await request(app.getHttpServer())
      .get('/api/docs/swagger-oauth-callback.js')
      .expect(200)

    expect(redirectResponse.text).toContain(
      '<script src="/api/docs/swagger-oauth-callback.js"></script>',
    )
    expect(redirectResponse.text).not.toContain('oauth2-redirect.js')
    expect(callbackResponse.text).toContain('new BroadcastChannel("swagger-oauth2")')
    expect(callbackResponse.text).not.toContain('window.opener')
  })

  it('allows Swagger UI to connect to the discovered OIDC endpoints', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs').expect(200)

    expect(response.headers['content-security-policy']).toContain(
      "connect-src 'self' https://identity.example.com",
    )
    expect(response.headers['cross-origin-opener-policy']).toBe('same-origin-allow-popups')
  })
})
