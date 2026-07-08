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
    delete process.env.PUBLIC_BASE_PATH
    vi.stubGlobal('fetch', fetchMock)
    app = await bootstrap()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
    vi.unstubAllGlobals()
    delete process.env.PUBLIC_BASE_PATH
  })

  it('starts without loading OIDC discovery during bootstrap', async () => {
    expect(app).toBeDefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('publishes BFF auth and widget documentation', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json').expect(200)

    expect(response.body.tags).toEqual(
      expect.arrayContaining([
        { name: 'BFF Auth', description: 'BFF login, callback, session, and logout endpoints.' },
        { name: 'BFF Widgets', description: 'Widget calls proxied through the BFF session.' },
      ]),
    )
    expect(response.body.paths['/api/auth/login'].get.operationId).toBe('beginLogin')
    expect(response.body.paths['/api/v1/widgets'].get.operationId).toBe('listWidgets')
    expect(response.body.components?.securitySchemes).toBeUndefined()
  })

  it('uses same-origin CSP for the BFF docs', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs').expect(200)

    expect(response.headers['content-security-policy']).toContain("connect-src 'self'")
    expect(response.headers['cross-origin-opener-policy']).toBe('same-origin-allow-popups')
  })
})

describe('main with a preserved public base path', () => {
  let app: NestExpressApplication

  beforeAll(async () => {
    process.env.PUBLIC_BASE_PATH = '/bff'
    app = await bootstrap()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
    delete process.env.PUBLIC_BASE_PATH
  })

  it('serves Swagger and advertises BFF URLs under the preserved path', async () => {
    const response = await request(app.getHttpServer()).get('/bff/api/docs-json').expect(200)

    expect(response.body.servers).toEqual([
      {
        url: '/bff/api',
        description: 'BFF auth endpoints on the same origin as this documentation',
      },
      {
        url: '/bff/api/v1',
        description: 'BFF Widget API on the same origin as this documentation',
      },
    ])
    await request(app.getHttpServer()).get('/api/docs-json').expect(404)
  })
})
