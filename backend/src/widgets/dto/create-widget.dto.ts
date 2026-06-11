import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger'
import { WidgetStatus, WIDGET_STATUSES } from './widget.dto'

@ApiSchema({
  name: 'CreateWidgetRequest',
  description:
    'Request body for creating a widget. Subject is never accepted here. If status is omitted, the service creates the widget with status `active`. If metadata is omitted, the service stores an empty metadata object.',
})
export class CreateWidgetDto {
  @ApiProperty({
    minLength: 1,
    maxLength: 200,
    example: 'Intake form',
  })
  name: string

  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    maxLength: 1000,
    example: 'Widget used for intake workflow testing.',
  })
  description?: string | null

  @ApiPropertyOptional({
    enum: WIDGET_STATUSES,
    enumName: 'WidgetStatus',
    default: 'active',
    example: 'active',
  })
  status?: WidgetStatus

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: {
      source: 'local-dev',
    },
  })
  metadata?: Record<string, unknown>
}
