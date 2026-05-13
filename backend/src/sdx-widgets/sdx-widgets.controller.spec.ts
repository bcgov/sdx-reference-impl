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

class FakePrismaService {
  private rows: WidgetRow[] = []

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
    findMany: async ({ where }: { where?: Partial<WidgetRow> }) =>
      this.rows.filter((row) => !where?.subject || row.subject === where.subject),
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
}

const tokenFor = (subject: string, scopes: string[]) => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ sub: subject, scope: scopes.join(' ') })).toString(
    'base64url',
  )
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

    expect(response.body).toHaveLength(1)
    expect(response.body[0].subject).toBe('alice')
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

    expect(response.body).toHaveLength(1)
    expect(response.body[0].subject).toBe('bob')
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

    expect(response.body).toHaveLength(0)
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
