import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger'
import { SdxWidgetDto, SDX_WIDGET_STATUSES } from './sdx-widget.dto'

export const SDX_WIDGET_SORT_FIELDS = ['createdAt', 'updatedAt', 'name', 'status'] as const
export type SdxWidgetSortField = (typeof SDX_WIDGET_SORT_FIELDS)[number]

export const SDX_WIDGET_SORT_DIRECTIONS = ['asc', 'desc'] as const
export type SdxWidgetSortDirection = (typeof SDX_WIDGET_SORT_DIRECTIONS)[number]

@ApiSchema({ name: 'ListSdxWidgetsQuery' })
export class ListSdxWidgetsQueryDto {
  @ApiPropertyOptional({
    enum: SDX_WIDGET_STATUSES,
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
    enum: SDX_WIDGET_SORT_FIELDS,
    description: 'Field used to sort results.',
    example: 'createdAt',
  })
  sortBy?: string

  @ApiPropertyOptional({
    enum: SDX_WIDGET_SORT_DIRECTIONS,
    description: 'Sort direction for the selected sort field.',
    example: 'desc',
  })
  sortOrder?: string
}

@ApiSchema({
  name: 'SdxWidgetListResponse',
  description: 'A paginated list of SDX Widgets with an optional cursor for the next page.',
})
export class SdxWidgetListResponseDto {
  @ApiProperty({
    type: SdxWidgetDto,
    isArray: true,
    example: [
      {
        id: '4f3066e8-5a59-4fc5-8e7b-fcd7f4d01c4f',
        subject: 'user-123',
        name: 'Intake form',
        description: 'Widget used for intake workflow testing.',
        status: 'active',
        metadata: {
          source: 'local-dev',
        },
        createdAt: '2026-05-13T18:00:00Z',
        updatedAt: '2026-05-13T18:00:00Z',
      },
    ],
  })
  items: SdxWidgetDto[]

  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    description: 'Cursor to retrieve the next page, or null when there are no more results.',
    example: 'eyJvZmZzZXQiOjI1fQ==',
  })
  nextCursor: string | null
}
