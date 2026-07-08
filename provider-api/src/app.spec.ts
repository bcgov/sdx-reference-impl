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
    delete process.env.SWAGGER_OAUTH_CLIENT_ID
    delete process.env.SWAGGER_OAUTH_REDIRECT_URL
    delete process.env.SWAGGER_OAUTH_SCOPES
    delete process.env.OIDC_AUTHORITY
    delete process.env.OIDC_OPENID_CONNECT_URL
    vi.stubGlobal('fetch', fetchMock)
    app = await bootstrap()
  })

  afterAll(async () => {
    await app.close()
    vi.unstubAllGlobals()
  })

  it('should start the application', async () => {
    expect(app).toBeDefined()
  })

  it('publishes the non-SDX provider API contract with service bearer security', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json').expect(200)

    expect(response.body.info.title).toBe('Provider API - Widgets')
    expect(response.body.servers).toEqual([
      {
        url: '/api/v1',
        description: 'Provider API on the same origin as this documentation',
      },
    ])
    expect(Object.keys(response.body.paths)).toEqual([
      '/subjects/{subject}/widgets',
      '/widgets/{widgetId}',
      '/users',
    ])
    expect(response.body.components.securitySchemes.serviceBearer).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Internal service bearer token used by provider-sdx-api.',
    })
    expect(response.body.components.securitySchemes.openId).toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('main with Swagger OAuth', () => {
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
    process.env.SWAGGER_OAUTH_CLIENT_ID = 'provider-api-swagger-client'
    process.env.SWAGGER_OAUTH_REDIRECT_URL = 'http://localhost:3002/api/docs/oauth2-redirect.html'
    process.env.SWAGGER_OAUTH_SCOPES = 'openid profile provider-api'
    app = await bootstrap()
  })

  afterAll(async () => {
    await app.close()
    vi.unstubAllGlobals()
    delete process.env.OIDC_AUTHORITY
    delete process.env.SWAGGER_OAUTH_CLIENT_ID
    delete process.env.SWAGGER_OAUTH_REDIRECT_URL
    delete process.env.SWAGGER_OAUTH_SCOPES
  })

  it('publishes an OAuth security scheme when Swagger OAuth is configured', async () => {
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
            'provider-api': 'provider-api',
          },
        },
      },
    })
  })

  it('initializes Swagger authorization with the configured client', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs/swagger-ui-init.js')
      .expect(200)

    expect(response.text).toContain('"clientId": "provider-api-swagger-client"')
    expect(response.text).toContain('"usePkceWithAuthorizationCodeGrant": true')
    expect(response.text).toContain(
      '"oauth2RedirectUrl": "http://localhost:3002/api/docs/oauth2-redirect.html"',
    )
    expect(response.text).toContain('"provider-api"')
  })

  it('loads the OAuth popup helper when Swagger OAuth is configured', async () => {
    const docsResponse = await request(app.getHttpServer()).get('/api/docs').expect(200)
    const scriptResponse = await request(app.getHttpServer())
      .get('/api/docs/swagger-oauth-popup.js')
      .expect(200)

    expect(docsResponse.text).toContain("<script src='/api/docs/swagger-oauth-popup.js'></script>")
    expect(scriptResponse.text).toContain('https://identity.example.com')
    expect(scriptResponse.headers['content-type']).toContain('application/javascript')
  })
})
