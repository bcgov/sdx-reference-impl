import { ApiSchema, PartialType } from '@nestjs/swagger'
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
