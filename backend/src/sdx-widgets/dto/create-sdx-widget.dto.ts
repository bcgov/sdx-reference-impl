import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger'
import { SdxWidgetStatus, SDX_WIDGET_STATUSES } from './sdx-widget.dto'

@ApiSchema({ name: 'CreateSdxWidgetRequest' })
export class CreateSdxWidgetDto {
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
    enum: SDX_WIDGET_STATUSES,
    default: 'active',
    example: 'active',
  })
  status?: SdxWidgetStatus

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: {
      source: 'local-dev',
    },
  })
  metadata?: Record<string, unknown>
}
