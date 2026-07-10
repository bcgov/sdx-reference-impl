import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger'

export const WIDGET_EVENT_TYPES = [
  'widget.create',
  'widget.list',
  'widget.get',
  'widget.replace',
  'widget.patch',
  'widget.delete',
] as const

export type WidgetEventType = (typeof WIDGET_EVENT_TYPES)[number]

export const WIDGET_ACCESS_EVENT_EXAMPLE = {
  id: '8f91c829-6935-4fb0-90bb-2e4f4cc9d3d1',
  ownerSubject: 'user-123',
  actorSubject: 'actor-789',
  actorUsername: 'Alex Smith',
  event: 'widget.get',
  description: 'Alex Smith viewed widget Intake form',
  resourceUrl: '/api/v1/widgets/4f3066e8-5a59-4fc5-8e7b-fcd7f4d01c4f',
  createdAt: '2026-05-13T18:30:00Z',
}

@ApiSchema({ name: 'ListWidgetAccessEventsQuery' })
export class ListWidgetAccessEventsQueryDto {
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: 100,
    default: 25,
    description: 'Maximum number of events to return.',
    example: 25,
  })
  limit?: string

  @ApiPropertyOptional({
    type: 'string',
    description: 'Opaque pagination cursor from the previous response.',
    example: 'eyJvZmZzZXQiOjI1fQ==',
  })
  cursor?: string
}

@ApiSchema({
  name: 'WidgetAccessEvent',
  description: 'Audit event describing access to a widget resource owned by a subject.',
})
export class WidgetAccessEventDto {
  @ApiProperty({
    format: 'uuid',
    example: WIDGET_ACCESS_EVENT_EXAMPLE.id,
    readOnly: true,
  })
  id: string

  @ApiProperty({
    description: 'Subject that owns the accessed resource.',
    example: WIDGET_ACCESS_EVENT_EXAMPLE.ownerSubject,
    readOnly: true,
  })
  ownerSubject: string

  @ApiProperty({
    description: 'Subject that performed the action.',
    example: WIDGET_ACCESS_EVENT_EXAMPLE.actorSubject,
    readOnly: true,
  })
  actorSubject: string

  @ApiProperty({
    description: 'Display name or username for the actor.',
    example: WIDGET_ACCESS_EVENT_EXAMPLE.actorUsername,
    readOnly: true,
  })
  actorUsername: string

  @ApiProperty({
    enum: WIDGET_EVENT_TYPES,
    enumName: 'WidgetEventType',
    description: 'Machine-readable event type.',
    example: WIDGET_ACCESS_EVENT_EXAMPLE.event,
    readOnly: true,
  })
  event: WidgetEventType

  @ApiProperty({
    description: 'Human-readable event description.',
    example: WIDGET_ACCESS_EVENT_EXAMPLE.description,
    readOnly: true,
  })
  description: string

  @ApiProperty({
    description: 'Relative URL for the resource that was acted on.',
    example: WIDGET_ACCESS_EVENT_EXAMPLE.resourceUrl,
    readOnly: true,
  })
  resourceUrl: string

  @ApiProperty({
    format: 'date-time',
    example: WIDGET_ACCESS_EVENT_EXAMPLE.createdAt,
    readOnly: true,
  })
  createdAt: Date
}

@ApiSchema({
  name: 'WidgetAccessEventListResponse',
  description: 'A paginated list of widget access audit events.',
})
export class WidgetAccessEventListResponseDto {
  @ApiProperty({
    type: WidgetAccessEventDto,
    isArray: true,
    example: [WIDGET_ACCESS_EVENT_EXAMPLE],
  })
  items: WidgetAccessEventDto[]

  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    description: 'Cursor to retrieve the next page, or null when there are no more results.',
    example: 'eyJvZmZzZXQiOjI1fQ==',
  })
  nextCursor: string | null
}
