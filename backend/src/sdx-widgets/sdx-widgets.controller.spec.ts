import request from 'supertest'
import { Test } from '@nestjs/testing'
import { VersioningType, type INestApplication } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { SdxWidgetsModule } from './sdx-widgets.module'
import { PrismaService } from '../prisma.service'

type WidgetRow = {
  id: string
  subject: string
  name: string
  description: string | null
  status: string
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

type IdempotencyRow = {
  id: string
  subject: string
  idempotencyKey: string
  requestHash: string
  widgetId: string
  createdAt: Date
}

class FakePrismaService {
  private rows: WidgetRow[] = []
  private idempotencyRows: IdempotencyRow[] = []

  sdxWidget = {
    create: async ({ data }: { data: Partial<WidgetRow> }) => {
      const now = new Date()
      const row: WidgetRow = {
        id: randomUUID(),
        subject: data.subject,
        name: data.name,
        description: data.description ?? null,
        status: data.status ?? 'active',
        metadata: data.metadata ?? {},
        createdAt: now,
        updatedAt: now,
      } as WidgetRow
      this.rows.push(row)
      return row
    },
    findMany: async ({
      where,
      orderBy,
      skip = 0,
      take,
    }: {
      where?: {
        subject?: string
        status?: string
        name?: { contains?: string; mode?: string }
      }
      orderBy?: Array<Record<string, 'asc' | 'desc'>>
      skip?: number
      take?: number
    }) => {
      const filtered = this.rows.filter((row) => {
        if (where?.subject && row.subject !== where.subject) {
          return false
        }
        if (where?.status && row.status !== where.status) {
          return false
        }
        if (where?.name?.contains) {
          return row.name.toLowerCase().includes(where.name.contains.toLowerCase())
        }
        return true
      })

      const sorted = [...filtered]
      if (orderBy?.length) {
        sorted.sort((left, right) => {
          for (const clause of orderBy) {
            const [field, direction] = Object.entries(clause)[0]
            const leftValue = left[field as keyof WidgetRow]
            const rightValue = right[field as keyof WidgetRow]

            if (leftValue === rightValue) {
              continue
            }

            const comparison = leftValue! < rightValue! ? -1 : 1
            return direction === 'asc' ? comparison : comparison * -1
          }
          return 0
        })
      }

      return sorted.slice(skip, take !== undefined ? skip + take : undefined)
    },
    findFirst: async ({ where }: { where: Partial<WidgetRow> }) =>
      this.rows.find(
        (row) =>
          (!where.id || row.id === where.id) && (!where.subject || row.subject === where.subject),
      ) ?? null,
    findUnique: async ({ where }: { where: Partial<WidgetRow> }) =>
      this.rows.find((row) => row.id === where.id) ?? null,
    update: async ({ where, data }: { where: Partial<WidgetRow>; data: Partial<WidgetRow> }) => {
      const row = this.rows.find((item) => item.id === where.id)
      Object.assign(row, data, { updatedAt: new Date() })
      return row
    },
    delete: async ({ where }: { where: Partial<WidgetRow> }) => {
      const index = this.rows.findIndex((row) => row.id === where.id)
      const [row] = this.rows.splice(index, 1)
      return row
    },
  }

  sdxWidgetIdempotency = {
    findUnique: async ({
      where,
    }: {
      where: { subject_idempotencyKey: { subject: string; idempotencyKey: string } }
    }) =>
      this.idempotencyRows.find(
        (row) =>
          row.subject === where.subject_idempotencyKey.subject &&
          row.idempotencyKey === where.subject_idempotencyKey.idempotencyKey,
      ) ?? null,
    create: async ({
      data,
    }: {
      data: {
        subject: string
        idempotencyKey: string
        requestHash: string
        widgetId: string
      }
    }) => {
      const row: IdempotencyRow = {
        id: randomUUID(),
        subject: data.subject,
        idempotencyKey: data.idempotencyKey,
        requestHash: data.requestHash,
        widgetId: data.widgetId,
        createdAt: new Date(),
      }
      this.idempotencyRows.push(row)
      return row
    },
  }

  $transaction = async <T>(fn: (tx: this) => Promise<T>) => fn(this)
}

const tokenFor = (subject: string, scopes?: string[]) => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const claims = scopes ? { sub: subject, scope: scopes.join(' ') } : { sub: subject }
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return `${header}.${payload}.`
}

describe('SdxWidgetsController', () => {
  let app: INestApplication

  beforeEach(async () => {
    process.env.NODE_ENV = 'test'
    const moduleRef = await Test.createTestingModule({
      imports: [SdxWidgetsModule],
    })
      .overrideProvider(PrismaService)
      .useValue(new FakePrismaService())
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

  it('creates a widget for the authenticated subject', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/sdx-widgets')
      .set('authorization', `Bearer ${tokenFor('alice', ['SDX-RI.sdx-widgets.create'])}`)
      .send({ name: 'Alpha', subject: 'spoofed-subject' })
      .expect(201)

    expect(response.body.subject).toBe('alice')
    expect(response.body.name).toBe('Alpha')
  })

  it('does not enforce operation scopes after the gateway forwards a request', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/sdx-widgets')
      .set('authorization', `Bearer ${tokenFor('alice')}`)
      .send({ name: 'Gateway-authorized widget' })
      .expect(201)
  })

  it('lists only SDX Widgets for the authenticated subject', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/sdx-widgets')
      .set('authorization', `Bearer ${tokenFor('alice', ['SDX-RI.sdx-widgets.create'])}`)
      .send({ name: 'Alice widget' })
      .expect(201)

    await request(app.getHttpServer())
      .post('/api/v1/sdx-widgets')
      .set('authorization', `Bearer ${tokenFor('bob', ['SDX-RI.sdx-widgets.create'])}`)
      .send({ name: 'Bob widget' })
      .expect(201)

    const response = await request(app.getHttpServer())
      .get('/api/v1/sdx-widgets')
      .set('authorization', `Bearer ${tokenFor('alice', ['SDX-RI.sdx-widgets.read'])}`)
      .expect(200)

    expect(response.body.items).toHaveLength(1)
    expect(response.body.items[0].subject).toBe('alice')
    expect(response.body.nextCursor).toBeNull()
  })

  it('does not expose another subject widget through normal endpoints', async () => {
    const bobWidget = await request(app.getHttpServer())
      .post('/api/v1/sdx-widgets')
      .set('authorization', `Bearer ${tokenFor('bob', ['SDX-RI.sdx-widgets.create'])}`)
      .send({ name: 'Bob widget' })
      .expect(201)

    await request(app.getHttpServer())
      .get(`/api/v1/sdx-widgets/${bobWidget.body.id}`)
      .set('authorization', `Bearer ${tokenFor('alice', ['SDX-RI.sdx-widgets.read'])}`)
      .expect(404)
  })

  it('allows admins to list SDX Widgets for a subject', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/sdx-widgets')
      .set('authorization', `Bearer ${tokenFor('bob', ['SDX-RI.sdx-widgets.create'])}`)
      .send({ name: 'Bob widget' })
      .expect(201)

    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/subjects/bob/sdx-widgets')
      .set('authorization', `Bearer ${tokenFor('admin', ['SDX-RI.sdx-widgets.admin'])}`)
      .expect(200)

    expect(response.body.items).toHaveLength(1)
    expect(response.body.items[0].subject).toBe('bob')
    expect(response.body.nextCursor).toBeNull()
  })

  it('allows admins to access a widget by ID', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/sdx-widgets')
      .set('authorization', `Bearer ${tokenFor('bob', ['SDX-RI.sdx-widgets.create'])}`)
      .send({ name: 'Bob widget' })
      .expect(201)

    const response = await request(app.getHttpServer())
      .get(`/api/v1/admin/sdx-widgets/${created.body.id}`)
      .set('authorization', `Bearer ${tokenFor('admin', ['SDX-RI.sdx-widgets.admin'])}`)
      .expect(200)

    expect(response.body.id).toBe(created.body.id)
  })

  it('updates a widget for the authenticated subject', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/sdx-widgets')
      .set('authorization', `Bearer ${tokenFor('alice', ['SDX-RI.sdx-widgets.create'])}`)
      .send({ name: 'Old name' })
      .expect(201)

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/sdx-widgets/${created.body.id}`)
      .set('authorization', `Bearer ${tokenFor('alice', ['SDX-RI.sdx-widgets.update'])}`)
      .send({ name: 'New name', status: 'inactive' })
      .expect(200)

    expect(response.body.name).toBe('New name')
    expect(response.body.status).toBe('inactive')
  })

  it('deletes a widget for the authenticated subject', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/sdx-widgets')
      .set('authorization', `Bearer ${tokenFor('alice', ['SDX-RI.sdx-widgets.create'])}`)
      .send({ name: 'Delete me' })
      .expect(201)

    await request(app.getHttpServer())
      .delete(`/api/v1/sdx-widgets/${created.body.id}`)
      .set('authorization', `Bearer ${tokenFor('alice', ['SDX-RI.sdx-widgets.delete'])}`)
      .expect(204)

    await request(app.getHttpServer())
      .get(`/api/v1/sdx-widgets/${created.body.id}`)
      .set('authorization', `Bearer ${tokenFor('alice', ['SDX-RI.sdx-widgets.read'])}`)
      .expect(404)
  })

  it('rejects invalid create values before writing to the database', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/sdx-widgets')
      .set('authorization', `Bearer ${tokenFor('alice', ['SDX-RI.sdx-widgets.create'])}`)
      .send({ name: 123 })
      .expect(422)

    const response = await request(app.getHttpServer())
      .get('/api/v1/sdx-widgets')
      .set('authorization', `Bearer ${tokenFor('alice', ['SDX-RI.sdx-widgets.read'])}`)
      .expect(200)

    expect(response.body.items).toHaveLength(0)
  })

  it('makes create requests safely retryable with Idempotency-Key', async () => {
    const idempotencyKey = 'req-12345678'

    const first = await request(app.getHttpServer())
      .post('/api/v1/sdx-widgets')
      .set('authorization', `Bearer ${tokenFor('alice', ['SDX-RI.sdx-widgets.create'])}`)
      .set('idempotency-key', idempotencyKey)
      .send({ name: 'Alpha' })
      .expect(201)

    const second = await request(app.getHttpServer())
      .post('/api/v1/sdx-widgets')
      .set('authorization', `Bearer ${tokenFor('alice', ['SDX-RI.sdx-widgets.create'])}`)
      .set('idempotency-key', idempotencyKey)
      .send({ name: 'Alpha' })
      .expect(201)

    expect(second.body.id).toBe(first.body.id)
    expect(second.body.subject).toBe('alice')
  })

  it('returns 409 when Idempotency-Key is reused with a different request body', async () => {
    const idempotencyKey = 'req-12345678'

    await request(app.getHttpServer())
      .post('/api/v1/sdx-widgets')
      .set('authorization', `Bearer ${tokenFor('alice', ['SDX-RI.sdx-widgets.create'])}`)
      .set('idempotency-key', idempotencyKey)
      .send({ name: 'Alpha' })
      .expect(201)

    await request(app.getHttpServer())
      .post('/api/v1/sdx-widgets')
      .set('authorization', `Bearer ${tokenFor('alice', ['SDX-RI.sdx-widgets.create'])}`)
      .set('idempotency-key', idempotencyKey)
      .send({ name: 'Bravo' })
      .expect(409)
  })

  it('filters, sorts, and paginates SDX Widget lists', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/sdx-widgets')
      .set('authorization', `Bearer ${tokenFor('alice', ['SDX-RI.sdx-widgets.create'])}`)
      .send({ name: 'Bravo intake', status: 'active' })
      .expect(201)

    await request(app.getHttpServer())
      .post('/api/v1/sdx-widgets')
      .set('authorization', `Bearer ${tokenFor('alice', ['SDX-RI.sdx-widgets.create'])}`)
      .send({ name: 'Alpha intake', status: 'active' })
      .expect(201)

    await request(app.getHttpServer())
      .post('/api/v1/sdx-widgets')
      .set('authorization', `Bearer ${tokenFor('alice', ['SDX-RI.sdx-widgets.create'])}`)
      .send({ name: 'Archived item', status: 'archived' })
      .expect(201)

    const firstPage = await request(app.getHttpServer())
      .get('/api/v1/sdx-widgets')
      .query({ status: 'active', name: 'intake', sortBy: 'name', sortOrder: 'asc', limit: 1 })
      .set('authorization', `Bearer ${tokenFor('alice', ['SDX-RI.sdx-widgets.read'])}`)
      .expect(200)

    expect(firstPage.body.items).toHaveLength(1)
    expect(firstPage.body.items[0].name).toBe('Alpha intake')
    expect(firstPage.body.nextCursor).toBeTruthy()

    const secondPage = await request(app.getHttpServer())
      .get('/api/v1/sdx-widgets')
      .query({
        status: 'active',
        name: 'intake',
        sortBy: 'name',
        sortOrder: 'asc',
        limit: 1,
        cursor: firstPage.body.nextCursor,
      })
      .set('authorization', `Bearer ${tokenFor('alice', ['SDX-RI.sdx-widgets.read'])}`)
      .expect(200)

    expect(secondPage.body.items).toHaveLength(1)
    expect(secondPage.body.items[0].name).toBe('Bravo intake')
    expect(secondPage.body.nextCursor).toBeNull()
  })

  it('rejects invalid list query parameters', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/sdx-widgets')
      .query({ limit: 101 })
      .set('authorization', `Bearer ${tokenFor('alice', ['SDX-RI.sdx-widgets.read'])}`)
      .expect(400)
  })

  it('rejects update values that exceed database column sizes', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/sdx-widgets')
      .set('authorization', `Bearer ${tokenFor('alice', ['SDX-RI.sdx-widgets.create'])}`)
      .send({ name: 'Valid widget' })
      .expect(201)

    await request(app.getHttpServer())
      .put(`/api/v1/sdx-widgets/${created.body.id}`)
      .set('authorization', `Bearer ${tokenFor('alice', ['SDX-RI.sdx-widgets.update'])}`)
      .send({ name: 'x'.repeat(201) })
      .expect(422)
  })

  it('resets omitted optional fields during full replacement', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/sdx-widgets')
      .set('authorization', `Bearer ${tokenFor('alice', ['SDX-RI.sdx-widgets.create'])}`)
      .send({
        name: 'Original widget',
        description: 'Original description',
        status: 'inactive',
        metadata: { source: 'custom' },
      })
      .expect(201)

    const replaced = await request(app.getHttpServer())
      .put(`/api/v1/sdx-widgets/${created.body.id}`)
      .set('authorization', `Bearer ${tokenFor('alice', ['SDX-RI.sdx-widgets.update'])}`)
      .send({ name: 'Replacement widget' })
      .expect(200)

    expect(replaced.body.name).toBe('Replacement widget')
    expect(replaced.body.description).toBeNull()
    expect(replaced.body.status).toBe('active')
    expect(replaced.body.metadata).toEqual({})
  })

  it('rejects patch values with invalid status or metadata shape', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/sdx-widgets')
      .set('authorization', `Bearer ${tokenFor('alice', ['SDX-RI.sdx-widgets.create'])}`)
      .send({ name: 'Valid widget' })
      .expect(201)

    await request(app.getHttpServer())
      .patch(`/api/v1/sdx-widgets/${created.body.id}`)
      .set('authorization', `Bearer ${tokenFor('alice', ['SDX-RI.sdx-widgets.update'])}`)
      .send({ status: 'deleted' })
      .expect(422)

    await request(app.getHttpServer())
      .patch(`/api/v1/sdx-widgets/${created.body.id}`)
      .set('authorization', `Bearer ${tokenFor('alice', ['SDX-RI.sdx-widgets.update'])}`)
      .send({ metadata: ['not', 'an', 'object'] })
      .expect(422)
  })

  it('rejects invalid widget IDs before querying Prisma', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/sdx-widgets/not-a-uuid')
      .set('authorization', `Bearer ${tokenFor('alice', ['SDX-RI.sdx-widgets.read'])}`)
      .expect(400)
  })
})
