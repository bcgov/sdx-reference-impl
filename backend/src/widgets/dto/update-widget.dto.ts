import { ApiPropertyOptional, ApiSchema, PartialType } from '@nestjs/swagger'
import { CreateWidgetDto } from './create-widget.dto'

@ApiSchema({ name: 'UpdateWidgetRequest' })
export class UpdateWidgetDto extends CreateWidgetDto {}

@ApiSchema({ name: 'PatchWidgetRequest' })
export class PatchWidgetDto extends PartialType(CreateWidgetDto) {}

@ApiSchema({ name: 'AdminUpdateWidgetRequest' })
export class AdminUpdateWidgetDto extends UpdateWidgetDto {
  @ApiPropertyOptional({
    minLength: 1,
    maxLength: 255,
    example: 'user-456',
  })
  subject?: string
}

@ApiSchema({ name: 'AdminPatchWidgetRequest' })
export class AdminPatchWidgetDto extends PatchWidgetDto {
  @ApiPropertyOptional({
    minLength: 1,
    maxLength: 255,
    example: 'user-456',
  })
  subject?: string
}
