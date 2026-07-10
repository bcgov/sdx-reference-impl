import type { ProviderCaller } from '../auth/auth.types'
import type { PrismaService } from '../prisma.service'
import { WidgetsService } from './widgets.service'

const widgetId = '4f3066e8-5a59-4fc5-8e7b-fcd7f4d01c4f'
const now = new Date('2026-01-02T03:04:05.000Z')

const widget = {
  id: widgetId,
  subject: 'user-123',
  name: 'Forest Tenure Widget',
  description: null,
  status: 'active',
  additionalData: {},
  createdAt: now,
  updatedAt: now,
}

const transferredWidget = {
  ...widget,
  subject: 'user-456',
  name: 'Transferred Widget',
}

const accessEvent = {
  id: '8f91c829-6935-4fb0-90bb-2e4f4cc9d3d1',
  ownerSubject: 'user-123',
  actorSubject: 'actor-789',
  actorUsername: 'Alex Smith',
  event: 'widget.get',
  description: 'Alex Smith viewed widget Forest Tenure Widget',
  resourceUrl: `/api/v1/widgets/${widgetId}`,
  createdAt: now,
}

const caller: ProviderCaller = {
  tokenSubject: 'dev-provider-sdx-api',
  claims: {},
  clientToken: true,
  clientId: 'dev-provider-sdx-api',
  onBehalfOfSubject: 'actor-789',
  onBehalfOfUsername: 'Alex Smith',
}

describe('WidgetsService provider access events', () => {
  const widgetCreate = vi.fn()
  const widgetFindUnique = vi.fn()
  const widgetUpdate = vi.fn()
  const widgetDelete = vi.fn()
  const eventCreate = vi.fn()
  const eventFindMany = vi.fn()
  const prisma = {
    widget: {
      create: widgetCreate,
      findUnique: widgetFindUnique,
      update: widgetUpdate,
      delete: widgetDelete,
    },
    widgetAccessEvent: {
      create: eventCreate,
      findMany: eventFindMany,
    },
  } as unknown as PrismaService
  const service = new WidgetsService(prisma)

  beforeEach(() => {
    widgetCreate.mockResolvedValue(widget)
    widgetFindUnique.mockResolvedValue(widget)
    widgetUpdate.mockResolvedValue(transferredWidget)
    widgetDelete.mockResolvedValue(widget)
    eventCreate.mockResolvedValue({})
    eventFindMany.mockResolvedValue([accessEvent])
    vi.clearAllMocks()
  })

  it('records a readable create event with the widget URL', async () => {
    await service.providerCreateForSubject(
      'user-123',
      { name: 'Forest Tenure Widget' },
      undefined,
      caller,
    )

    expect(eventCreate).toHaveBeenCalledWith({
      data: {
        ownerSubject: 'user-123',
        actorSubject: 'actor-789',
        actorUsername: 'Alex Smith',
        event: 'widget.create',
        description: 'Alex Smith created widget Forest Tenure Widget',
        resourceUrl: `/api/v1/widgets/${widgetId}`,
      },
    })
  })

  it('records a readable delete event before removing the widget', async () => {
    await service.providerDelete(widgetId, undefined, caller)

    expect(widgetFindUnique).toHaveBeenCalledWith({ where: { id: widgetId } })
    expect(widgetDelete).toHaveBeenCalledWith({ where: { id: widgetId } })
    expect(eventCreate).toHaveBeenCalledWith({
      data: {
        ownerSubject: 'user-123',
        actorSubject: 'actor-789',
        actorUsername: 'Alex Smith',
        event: 'widget.delete',
        description: 'Alex Smith deleted widget Forest Tenure Widget',
        resourceUrl: `/api/v1/widgets/${widgetId}`,
      },
    })
  })

  it('records ownership transfer updates against the previous owner', async () => {
    await service.providerReplace(
      widgetId,
      {
        subject: 'user-456',
        name: 'Transferred Widget',
        status: 'active',
        description: null,
        additionalData: {},
      },
      undefined,
      caller,
    )

    expect(widgetUpdate).toHaveBeenCalledWith({
      where: { id: widgetId },
      data: {
        subject: 'user-456',
        name: 'Transferred Widget',
        status: 'active',
        description: null,
        additionalData: {},
      },
    })
    expect(eventCreate).toHaveBeenCalledWith({
      data: {
        ownerSubject: 'user-123',
        actorSubject: 'actor-789',
        actorUsername: 'Alex Smith',
        event: 'widget.replace',
        description: 'Alex Smith replaced widget Transferred Widget',
        resourceUrl: `/api/v1/widgets/${widgetId}`,
      },
    })
  })

  it('lists access events for the owner subject', async () => {
    await expect(
      service.providerListEventsForSubject('user-123', { limit: '25' }),
    ).resolves.toEqual({
      items: [accessEvent],
      nextCursor: null,
    })

    expect(eventFindMany).toHaveBeenCalledWith({
      where: { ownerSubject: 'user-123' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 26,
    })
  })
})
