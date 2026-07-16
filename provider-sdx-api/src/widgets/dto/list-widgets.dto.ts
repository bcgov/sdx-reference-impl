import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger'
import { WIDGET_EXAMPLE, WidgetStatus, WIDGET_STATUSES } from './widget.dto'

export const WIDGET_SORT_FIELDS = ['createdAt', 'updatedAt', 'name', 'status'] as const
export type WidgetSortField = (typeof WIDGET_SORT_FIELDS)[number]

export const WIDGET_SORT_DIRECTIONS = ['asc', 'desc'] as const
export type WidgetSortDirection = (typeof WIDGET_SORT_DIRECTIONS)[number]

@ApiSchema({ name: 'ListWidgetsQuery' })
export class ListWidgetsQueryDto {
  @ApiPropertyOptional({
    enum: WIDGET_STATUSES,
    description: 'Filter widgets by lifecycle status.',
    example: 'active',
  })
  status?: string

  @ApiPropertyOptional({
    type: 'string',
    minLength: 1,
    maxLength: 200,
    description: 'Case-insensitive partial name match.',
    example: 'intake',
  })
  name?: string

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: 100,
    default: 25,
    description: 'Maximum number of widgets to return.',
    example: 25,
  })
  limit?: string

  @ApiPropertyOptional({
    type: 'string',
    description: 'Opaque pagination cursor from the previous response.',
    example: 'eyJvZmZzZXQiOjI1fQ==',
  })
  cursor?: string

  @ApiPropertyOptional({
    enum: WIDGET_SORT_FIELDS,
    description: 'Field used to sort results.',
    example: 'createdAt',
  })
  sortBy?: string

  @ApiPropertyOptional({
    enum: WIDGET_SORT_DIRECTIONS,
    description: 'Sort direction for the selected sort field.',
    example: 'desc',
  })
  sortOrder?: string
}

@ApiSchema({
  name: 'WidgetSummary',
  description: 'Summary representation used in widget list responses.',
})
export class WidgetSummaryDto {
  @ApiProperty({
    format: 'uuid',
    example: WIDGET_EXAMPLE.id,
    readOnly: true,
  })
  id: string

  @ApiProperty({
    description: 'Owner subject from the JWT sub claim or provider operation.',
    example: WIDGET_EXAMPLE.subject,
    readOnly: true,
  })
  subject: string

  @ApiProperty({
    minLength: 1,
    maxLength: 200,
    example: WIDGET_EXAMPLE.name,
  })
  name: string

  @ApiProperty({
    enum: WIDGET_STATUSES,
    enumName: 'WidgetStatus',
    example: WIDGET_EXAMPLE.status,
  })
  status: WidgetStatus

  @ApiProperty({
    format: 'date-time',
    example: WIDGET_EXAMPLE.updatedAt,
    readOnly: true,
  })
  updatedAt: Date
}

@ApiSchema({
  name: 'WidgetListResponse',
  description: 'A paginated list of widget summaries with an optional cursor for the next page.',
})
export class WidgetListResponseDto {
  @ApiProperty({
    type: WidgetSummaryDto,
    isArray: true,
    example: [
      {
        id: '4f3066e8-5a59-4fc5-8e7b-fcd7f4d01c4f',
        subject: 'user-123',
        name: 'Intake form',
        status: 'active',
        updatedAt: '2026-05-13T18:00:00Z',
      },
    ],
  })
  items: WidgetSummaryDto[]

  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    description: 'Cursor to retrieve the next page, or null when there are no more results.',
    example: 'eyJvZmZzZXQiOjI1fQ==',
  })
  nextCursor: string | null
}
