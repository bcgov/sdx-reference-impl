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
    app = await bootstrap()
  })

  afterAll(async () => {
    await app.close()
    vi.unstubAllGlobals()
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
