import { ApiPropertyOptional, ApiSchema, PartialType } from '@nestjs/swagger'
import { CreateSdxWidgetDto } from './create-sdx-widget.dto'

@ApiSchema({ name: 'UpdateSdxWidgetRequest' })
export class UpdateSdxWidgetDto extends CreateSdxWidgetDto {}

@ApiSchema({ name: 'PatchSdxWidgetRequest' })
export class PatchSdxWidgetDto extends PartialType(CreateSdxWidgetDto) {}

@ApiSchema({ name: 'AdminUpdateSdxWidgetRequest' })
export class AdminUpdateSdxWidgetDto extends UpdateSdxWidgetDto {
  @ApiPropertyOptional({
    minLength: 1,
    maxLength: 255,
    example: 'user-456',
  })
  subject?: string
}

@ApiSchema({ name: 'AdminPatchSdxWidgetRequest' })
export class AdminPatchSdxWidgetDto extends PatchSdxWidgetDto {
  @ApiPropertyOptional({
    minLength: 1,
    maxLength: 255,
    example: 'user-456',
  })
  subject?: string
}
