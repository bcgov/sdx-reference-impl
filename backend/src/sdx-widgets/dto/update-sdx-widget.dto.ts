import { ApiPropertyOptional, ApiSchema, PartialType } from '@nestjs/swagger'
import { CreateSdxWidgetDto } from './create-sdx-widget.dto'

@ApiSchema({
  name: 'UpdateSdxWidgetRequest',
  description:
    'Request body for replacing a widget. Subject is never accepted here. This is a full replacement. Omitted optional fields are reset to their default values: description is set to null, status is set to active, and metadata is set to an empty object.',
})
export class UpdateSdxWidgetDto extends CreateSdxWidgetDto {}

@ApiSchema({
  name: 'PatchSdxWidgetRequest',
  description:
    'Request body for partially updating a widget. Subject is never accepted here. Omitted fields preserve their existing values.',
})
export class PatchSdxWidgetDto extends PartialType(CreateSdxWidgetDto) {}

@ApiSchema({
  name: 'AdminUpdateSdxWidgetRequest',
  description:
    'Request body for replacing a widget through an admin endpoint. This is a full replacement for widget fields. Omitted optional fields are reset to their default values: description is set to null, status is set to active, and metadata is set to an empty object. If subject is omitted, the existing subject is preserved.',
})
export class AdminUpdateSdxWidgetDto extends UpdateSdxWidgetDto {
  @ApiPropertyOptional({
    minLength: 1,
    maxLength: 255,
    example: 'user-456',
  })
  subject?: string
}

@ApiSchema({
  name: 'AdminPatchSdxWidgetRequest',
  description:
    'Request body for partially updating a widget through an admin endpoint. Omitted fields preserve their existing values. If subject is included, the administrative operation may transfer ownership to a different subject.',
})
export class AdminPatchSdxWidgetDto extends PatchSdxWidgetDto {
  @ApiPropertyOptional({
    minLength: 1,
    maxLength: 255,
    example: 'user-456',
  })
  subject?: string
}
