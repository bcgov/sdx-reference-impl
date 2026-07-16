import request from 'supertest'
import { Test } from '@nestjs/testing'
import { VersioningType, type INestApplication } from '@nestjs/common'
import { WidgetsModule } from './widgets.module'
import { WidgetsService, type WidgetProxyResult } from './widgets.service'
import { BffSessionService } from '../auth/bff-session.service'
import type { BffSession } from '../auth/auth.types'

const session: BffSession = {
  accessToken: 'session-access-token',
  expiresAt: Date.now() + 60_000,
  id: 'test-session',
  user: {
    displayName: 'Test User',
    subjectId: 'user-123',
  },
}

class FakeWidgetsService {
  list = vi.fn<WidgetsService['list']>()
  create = vi.fn<WidgetsService['create']>()
  get = vi.fn<WidgetsService['get']>()
  replace = vi.fn<WidgetsService['replace']>()
  update = vi.fn<WidgetsService['update']>()
  delete = vi.fn<WidgetsService['delete']>()
}

function result(status: number, body?: unknown, etag?: string): WidgetProxyResult {
  return { body, etag, status }
}

describe('BFF WidgetsController', () => {
  let app: INestApplication
  let widgetsService: FakeWidgetsService

  beforeEach(async () => {
    widgetsService = new FakeWidgetsService()
    const moduleRef = await Test.createTestingModule({
      imports: [WidgetsModule],
    })
      .overrideProvider(BffSessionService)
      .useValue({
        requireSession: () => session,
      })
      .overrideProvider(WidgetsService)
      .useValue(widgetsService)
      .compile()

    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    app.enableVersioning({
      type: VersioningType.URI,
      prefix: 'v',
    })
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  it('proxies list requests through the BFF session', async () => {
    widgetsService.list.mockResolvedValue(
      result(200, {
        items: [],
        nextCursor: null,
      }),
    )

    const response = await request(app.getHttpServer())
      .get('/api/v1/widgets')
      .query({ limit: 5, status: 'active' })
      .expect(200)

    expect(response.body).toEqual({ items: [], nextCursor: null })
    expect(widgetsService.list).toHaveBeenCalledWith(
      session,
      expect.objectContaining({ limit: '5', status: 'active' }),
    )
  })

  it('proxies create requests and preserves provider response headers', async () => {
    widgetsService.create.mockResolvedValue(
      result(
        201,
        {
          id: '4f3066e8-5a59-4fc5-8e7b-fcd7f4d01c4f',
          name: 'Widget',
        },
        '"etag"',
      ),
    )

    const response = await request(app.getHttpServer())
      .post('/api/v1/widgets')
      .set('Idempotency-Key', 'request-123')
      .send({ name: 'Widget' })
      .expect(201)

    expect(response.headers.etag).toBe('"etag"')
    expect(widgetsService.create).toHaveBeenCalledWith(
      session,
      expect.objectContaining({ name: 'Widget' }),
      'request-123',
    )
  })

  it('proxies update and delete precondition headers', async () => {
    widgetsService.update.mockResolvedValue(result(200, { id: 'widget-id' }, '"updated"'))
    widgetsService.delete.mockResolvedValue(result(204))

    await request(app.getHttpServer())
      .patch('/api/v1/widgets/4f3066e8-5a59-4fc5-8e7b-fcd7f4d01c4f')
      .set('If-Match', '"old"')
      .send({ status: 'archived' })
      .expect(200)

    await request(app.getHttpServer())
      .delete('/api/v1/widgets/4f3066e8-5a59-4fc5-8e7b-fcd7f4d01c4f')
      .set('If-Match', '"updated"')
      .expect(204)

    expect(widgetsService.update).toHaveBeenCalledWith(
      session,
      '4f3066e8-5a59-4fc5-8e7b-fcd7f4d01c4f',
      expect.objectContaining({ status: 'archived' }),
      '"old"',
    )
    expect(widgetsService.delete).toHaveBeenCalledWith(
      session,
      '4f3066e8-5a59-4fc5-8e7b-fcd7f4d01c4f',
      '"updated"',
    )
  })
})
