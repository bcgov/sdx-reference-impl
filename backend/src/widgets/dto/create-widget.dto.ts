import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger'
import { WidgetStatus, WIDGET_STATUSES } from './widget.dto'

@ApiSchema({ name: 'CreateWidgetRequest' })
export class CreateWidgetDto {
  @ApiProperty({
    minLength: 1,
    maxLength: 200,
    example: 'Intake form',
  })
  name: string

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 1000,
    example: 'Widget used for intake workflow testing.',
  })
  description?: string | null

  @ApiPropertyOptional({
    enum: WIDGET_STATUSES,
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
