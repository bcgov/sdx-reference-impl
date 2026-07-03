import { ApiPropertyOptional, ApiSchema, PartialType } from '@nestjs/swagger'
import { CreateWidgetDto } from './create-widget.dto'

@ApiSchema({
  name: 'UpdateWidgetRequest',
  description:
    'Request body for replacing a widget. Subject is never accepted here. This is a full replacement. Omitted optional fields are reset to their default values: description is set to null, status is set to active, and additionalData is set to an empty object.',
})
export class UpdateWidgetDto extends CreateWidgetDto {}

@ApiSchema({
  name: 'PatchWidgetRequest',
  description:
    'Request body for partially updating a widget. Subject is never accepted here. Omitted fields preserve their existing values.',
})
export class PatchWidgetDto extends PartialType(CreateWidgetDto) {}

@ApiSchema({
  name: 'AdminUpdateWidgetRequest',
  description:
    'Request body for replacing a widget through an admin endpoint. This is a full replacement for widget fields. Omitted optional fields are reset to their default values: description is set to null, status is set to active, and additionalData is set to an empty object. If subject is omitted, the existing subject is preserved.',
})
export class AdminUpdateWidgetDto extends UpdateWidgetDto {
  @ApiPropertyOptional({
    minLength: 1,
    maxLength: 255,
    example: 'user-456',
  })
  subject?: string
}

@ApiSchema({
  name: 'AdminPatchWidgetRequest',
  description:
    'Request body for partially updating a widget through an admin endpoint. Omitted fields preserve their existing values. If subject is included, the administrative operation may transfer ownership to a different subject.',
})
export class AdminPatchWidgetDto extends PatchWidgetDto {
  @ApiPropertyOptional({
    minLength: 1,
    maxLength: 255,
    example: 'user-456',
  })
  subject?: string
}
