import { ForbiddenException, NotFoundException } from '@nestjs/common'
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

const updatedWidget = {
  ...widget,
  name: 'Updated Widget',
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
  effectiveSubject: 'user-123',
  effectiveUsername: 'Alex Smith',
}

describe('WidgetsService provider access events', () => {
  const widgetCreate = vi.fn()
  const widgetFindFirst = vi.fn()
  const widgetFindUnique = vi.fn()
  const widgetUpdate = vi.fn()
  const widgetDelete = vi.fn()
  const eventCreate = vi.fn()
  const eventFindMany = vi.fn()
  const prisma = {
    widget: {
      create: widgetCreate,
      findFirst: widgetFindFirst,
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
    widgetFindFirst.mockResolvedValue(widget)
    widgetFindUnique.mockResolvedValue(widget)
    widgetUpdate.mockResolvedValue(updatedWidget)
    widgetDelete.mockResolvedValue(widget)
    eventCreate.mockResolvedValue({})
    eventFindMany.mockResolvedValue([accessEvent])
    vi.clearAllMocks()
  })

  it('records a readable create event with the widget URL', async () => {
    await service.providerCreateForSubject('user-123', { name: 'Forest Tenure Widget' }, caller)

    expect(eventCreate).toHaveBeenCalledWith({
      data: {
        ownerSubject: 'user-123',
        actorSubject: 'user-123',
        actorUsername: 'Alex Smith',
        event: 'widget.create',
        description: 'Alex Smith created widget Forest Tenure Widget',
        resourceUrl: `/api/v1/widgets/${widgetId}`,
      },
    })
  })

  it('records a readable delete event before removing the widget', async () => {
    await service.providerDelete(widgetId, caller)

    expect(widgetFindFirst).toHaveBeenCalledWith({
      where: { id: widgetId, subject: 'user-123' },
    })
    expect(widgetDelete).toHaveBeenCalledWith({ where: { id: widgetId } })
    expect(eventCreate).toHaveBeenCalledWith({
      data: {
        ownerSubject: 'user-123',
        actorSubject: 'user-123',
        actorUsername: 'Alex Smith',
        event: 'widget.delete',
        description: 'Alex Smith deleted widget Forest Tenure Widget',
        resourceUrl: `/api/v1/widgets/${widgetId}`,
      },
    })
  })

  it('overwrites a requested transfer with the effective subject', async () => {
    await service.providerReplace(
      widgetId,
      {
        subject: 'user-456',
        name: 'Updated Widget',
        status: 'active',
        description: null,
        additionalData: {},
      },
      caller,
    )

    expect(widgetUpdate).toHaveBeenCalledWith({
      where: { id: widgetId },
      data: {
        subject: 'user-123',
        name: 'Updated Widget',
        status: 'active',
        description: null,
        additionalData: {},
      },
    })
    expect(eventCreate).toHaveBeenCalledWith({
      data: {
        ownerSubject: 'user-123',
        actorSubject: 'user-123',
        actorUsername: 'Alex Smith',
        event: 'widget.replace',
        description: 'Alex Smith replaced widget Updated Widget',
        resourceUrl: `/api/v1/widgets/${widgetId}`,
      },
    })
  })

  it('lists access events for the owner subject', async () => {
    await expect(
      service.providerListEventsForSubject('user-123', { limit: '25' }, caller),
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

  it.each([
    ['get', () => service.providerGet(widgetId, caller)],
    [
      'replace',
      () =>
        service.providerReplace(widgetId, { subject: 'user-123', name: 'Updated Widget' }, caller),
    ],
    [
      'patch',
      () =>
        service.providerPatch(widgetId, { subject: 'user-123', name: 'Updated Widget' }, caller),
    ],
    ['delete', () => service.providerDelete(widgetId, caller)],
  ])('returns not found when %s targets a widget owned by another subject', async (_name, call) => {
    widgetFindFirst.mockResolvedValueOnce(null)

    await expect(call()).rejects.toBeInstanceOf(NotFoundException)

    expect(widgetFindFirst).toHaveBeenCalledWith({
      where: { id: widgetId, subject: 'user-123' },
    })
    expect(widgetUpdate).not.toHaveBeenCalled()
    expect(widgetDelete).not.toHaveBeenCalled()
    expect(eventCreate).not.toHaveBeenCalled()
  })

  it('rejects a subject path that does not match the effective subject', async () => {
    await expect(
      service.providerCreateForSubject('user-456', { name: 'Another User Widget' }, caller),
    ).rejects.toBeInstanceOf(ForbiddenException)

    expect(widgetCreate).not.toHaveBeenCalled()
  })

  it('overwrites a patch subject with the effective subject', async () => {
    await service.providerPatch(widgetId, { subject: 'user-456' }, caller)

    expect(widgetFindFirst).toHaveBeenCalledWith({
      where: { id: widgetId, subject: 'user-123' },
    })
    expect(widgetUpdate).toHaveBeenCalledWith({
      where: { id: widgetId },
      data: { subject: 'user-123' },
    })
  })
})
