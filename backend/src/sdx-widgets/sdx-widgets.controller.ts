import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiSecurity,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequireScopes } from '../auth/scopes.decorator'
import { ScopesGuard } from '../auth/scopes.guard'
import type { AuthenticatedUser } from '../auth/auth.types'
import { CreateSdxWidgetDto } from './dto/create-sdx-widget.dto'
import {
  ListSdxWidgetsQueryDto,
  SdxWidgetListResponseDto,
  SDX_WIDGET_SORT_DIRECTIONS,
  SDX_WIDGET_SORT_FIELDS,
} from './dto/list-sdx-widgets.dto'
import {
  AdminPatchSdxWidgetDto,
  AdminUpdateSdxWidgetDto,
  PatchSdxWidgetDto,
  UpdateSdxWidgetDto,
} from './dto/update-sdx-widget.dto'
import {
  ErrorResponseDto,
  ProblemDetailResponseDto,
  SdxWidgetDto,
  SDX_WIDGET_STATUSES,
  SDX_WIDGET_EXAMPLE,
} from './dto/sdx-widget.dto'
import { SdxWidgetsService } from './sdx-widgets.service'

const SDX_WIDGET_ID_EXAMPLE = SDX_WIDGET_EXAMPLE.id
const SUBJECT_EXAMPLE = SDX_WIDGET_EXAMPLE.subject
const ERROR_EXAMPLE = {
  error: 'not_found',
  message: 'SDX Widget not found',
  details: {
    correlationId: 'req-abc123-xyz',
  },
}
const CONFLICT_ERROR_EXAMPLE = {
  error: 'conflict',
  message: 'Request conflicts with the current SDX Widget state',
  details: {
    correlationId: 'req-abc123-xyz',
  },
}
const TOO_MANY_REQUESTS_ERROR_EXAMPLE = {
  error: 'too_many_requests',
  message: 'Too many requests',
  details: {
    correlationId: 'req-abc123-xyz',
    retryAfter: 60,
  },
}
const INTERNAL_SERVER_ERROR_EXAMPLE = {
  error: 'internal_server_error',
  message: 'Internal server error',
  details: {
    correlationId: 'req-abc123-xyz',
    timestamp: '2026-05-13T18:00:00Z',
  },
}
const PROBLEM_DETAIL_EXAMPLE = {
  type: 'tag:validation-errors',
  title: 'Bad Request',
  status: 400,
  detail: 'One or more validation errors occurred',
  errors: [
    {
      code: 'INVALID_REQUEST',
      location: 'body',
      message: 'Invalid request body or parameter',
      pointer: '#/name',
      received: '',
      type: 'tag:validation-error',
    },
  ],
}
const CREATE_WIDGET_EXAMPLE = {
  name: 'Intake form',
  description: 'Widget used for intake workflow testing.',
  status: 'active',
  metadata: {
    source: 'local-dev',
  },
}
const UPDATE_WIDGET_EXAMPLE = {
  name: 'Intake form v2',
  description: 'Updated widget used for intake workflow testing.',
  status: 'inactive',
  metadata: {
    source: 'local-dev',
  },
}
const PATCH_WIDGET_EXAMPLE = {
  status: 'archived',
}
const ADMIN_UPDATE_WIDGET_EXAMPLE = {
  subject: 'user-456',
  ...UPDATE_WIDGET_EXAMPLE,
}
const ADMIN_PATCH_WIDGET_EXAMPLE = {
  subject: 'user-456',
  status: 'archived',
}
const IDEMPOTENCY_KEY_EXAMPLE = 'req-12345678'
const ERROR_RESPONSE = {
  type: ErrorResponseDto,
  example: ERROR_EXAMPLE,
}
const CONFLICT_ERROR_RESPONSE = {
  type: ErrorResponseDto,
  example: CONFLICT_ERROR_EXAMPLE,
}
const TOO_MANY_REQUESTS_RESPONSE = {
  type: ErrorResponseDto,
  example: TOO_MANY_REQUESTS_ERROR_EXAMPLE,
  headers: {
    'Retry-After': {
      description: 'Number of seconds to wait before retrying the request.',
      schema: {
        type: 'integer',
        minimum: 1,
        example: 60,
      },
    },
  },
}
const INTERNAL_SERVER_ERROR_RESPONSE = {
  type: ErrorResponseDto,
  example: INTERNAL_SERVER_ERROR_EXAMPLE,
}
const PROBLEM_DETAIL_RESPONSE = {
  type: ProblemDetailResponseDto,
  example: PROBLEM_DETAIL_EXAMPLE,
}
const UNPROCESSABLE_ENTITY_RESPONSE = {
  type: ProblemDetailResponseDto,
  example: {
    ...PROBLEM_DETAIL_EXAMPLE,
    type: 'tag:semantic-validation-errors',
    title: 'Unprocessable Entity',
    status: 422,
    detail: 'The request body is syntactically valid but failed SDX widget validation rules',
  },
}

@ApiTags('SDX Widgets')
@ApiSecurity('oidc', [
  'SDX-RI.sdx-widgets.read',
  'SDX-RI.sdx-widgets.create',
  'SDX-RI.sdx-widgets.update',
  'SDX-RI.sdx-widgets.delete',
])
@ApiTooManyRequestsResponse(TOO_MANY_REQUESTS_RESPONSE)
@ApiInternalServerErrorResponse(INTERNAL_SERVER_ERROR_RESPONSE)
@UseGuards(JwtAuthGuard, ScopesGuard)
@Controller({ path: 'sdx-widgets', version: '1' })
export class SdxWidgetsController {
  constructor(private readonly widgetsService: SdxWidgetsService) {}

  @Get()
  @RequireScopes('SDX-RI.sdx-widgets.read')
  @ApiSecurity('oidc', ['SDX-RI.sdx-widgets.read'])
  @ApiOperation({
    operationId: 'listSdxWidgets',
    summary: 'List SDX Widgets owned by the authenticated subject.',
    description:
      'Returns the SDX Widgets owned by the authenticated subject identified by the JWT sub claim.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: SDX_WIDGET_STATUSES,
    description: 'Filter widgets by lifecycle status.',
  })
  @ApiQuery({
    name: 'name',
    required: false,
    schema: {
      type: 'string',
      minLength: 1,
      maxLength: 200,
    },
    description: 'Case-insensitive partial name match.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 25,
    },
    description: 'Maximum number of widgets to return.',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    schema: {
      type: 'string',
    },
    description: 'Opaque pagination cursor from the previous response.',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: SDX_WIDGET_SORT_FIELDS,
    description: 'Field used to sort results.',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: SDX_WIDGET_SORT_DIRECTIONS,
    description: 'Sort direction for the selected sort field.',
  })
  @ApiOkResponse({
    description: 'The list of SDX Widgets owned by the authenticated subject.',
    type: SdxWidgetListResponseDto,
    example: {
      items: [SDX_WIDGET_EXAMPLE],
      nextCursor: null,
    },
  })
  @ApiBadRequestResponse(PROBLEM_DETAIL_RESPONSE)
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListSdxWidgetsQueryDto) {
    return this.widgetsService.listForSubject(user.subject, query)
  }

  @Post()
  @RequireScopes('SDX-RI.sdx-widgets.create')
  @ApiSecurity('oidc', ['SDX-RI.sdx-widgets.create'])
  @ApiOperation({
    operationId: 'createSdxWidget',
    summary: 'Create a SDX Widget for the authenticated subject.',
    description:
      'Creates a new SDX Widget for the authenticated subject. The service identifies the subject from the JWT sub claim rather than from the request body.',
  })
  @ApiBody({
    type: CreateSdxWidgetDto,
    examples: {
      createWidget: {
        value: CREATE_WIDGET_EXAMPLE,
      },
    },
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'Optional client-generated key used to make create requests safely retryable. Reusing the same key with the same request body returns the original result.',
    schema: {
      type: 'string',
      minLength: 8,
      maxLength: 255,
      example: IDEMPOTENCY_KEY_EXAMPLE,
    },
  })
  @ApiCreatedResponse({
    description: 'The created SDX Widget.',
    type: SdxWidgetDto,
    example: SDX_WIDGET_EXAMPLE,
  })
  @ApiConflictResponse(CONFLICT_ERROR_RESPONSE)
  @ApiBadRequestResponse(PROBLEM_DETAIL_RESPONSE)
  @ApiUnprocessableEntityResponse(UNPROCESSABLE_ENTITY_RESPONSE)
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSdxWidgetDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.widgetsService.createForSubject(user.subject, dto, idempotencyKey)
  }

  @Get(':widgetId')
  @RequireScopes('SDX-RI.sdx-widgets.read')
  @ApiSecurity('oidc', ['SDX-RI.sdx-widgets.read'])
  @ApiOperation({
    operationId: 'getSdxWidget',
    summary: 'Get a SDX Widget owned by the authenticated subject.',
    description:
      'Returns the SDX Widget when it is owned by the authenticated subject. Responds with 404 when the widget does not exist or is owned by another subject.',
  })
  @ApiParam({
    name: 'widgetId',
    description: 'The UUID of the SDX Widget.',
    schema: {
      type: 'string',
      format: 'uuid',
      example: SDX_WIDGET_ID_EXAMPLE,
    },
  })
  @ApiOkResponse({
    description: 'The requested SDX Widget.',
    type: SdxWidgetDto,
    example: SDX_WIDGET_EXAMPLE,
  })
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  @ApiNotFoundResponse(ERROR_RESPONSE)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('widgetId') widgetId: string) {
    return this.widgetsService.getForSubject(widgetId, user.subject)
  }

  @Put(':widgetId')
  @RequireScopes('SDX-RI.sdx-widgets.update')
  @ApiSecurity('oidc', ['SDX-RI.sdx-widgets.update'])
  @ApiOperation({
    operationId: 'replaceSdxWidget',
    summary: 'Replace a SDX Widget for the authenticated subject.',
    description:
      'Replaces the SDX Widget when it is owned by the authenticated subject. The service identifies the subject from the JWT sub claim rather than from the request body.',
  })
  @ApiParam({
    name: 'widgetId',
    description: 'The UUID of the SDX Widget.',
    schema: {
      type: 'string',
      format: 'uuid',
      example: SDX_WIDGET_ID_EXAMPLE,
    },
  })
  @ApiBody({
    type: UpdateSdxWidgetDto,
    examples: {
      replaceWidget: {
        value: UPDATE_WIDGET_EXAMPLE,
      },
    },
  })
  @ApiOkResponse({
    description: 'The replaced SDX Widget.',
    type: SdxWidgetDto,
    example: {
      ...SDX_WIDGET_EXAMPLE,
      ...UPDATE_WIDGET_EXAMPLE,
    },
  })
  @ApiBadRequestResponse(PROBLEM_DETAIL_RESPONSE)
  @ApiUnprocessableEntityResponse(UNPROCESSABLE_ENTITY_RESPONSE)
  @ApiConflictResponse(CONFLICT_ERROR_RESPONSE)
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  @ApiNotFoundResponse(ERROR_RESPONSE)
  replace(
    @CurrentUser() user: AuthenticatedUser,
    @Param('widgetId') widgetId: string,
    @Body() dto: UpdateSdxWidgetDto,
  ) {
    return this.widgetsService.replaceForSubject(widgetId, user.subject, dto)
  }

  @Patch(':widgetId')
  @RequireScopes('SDX-RI.sdx-widgets.update')
  @ApiSecurity('oidc', ['SDX-RI.sdx-widgets.update'])
  @ApiOperation({
    operationId: 'updateSdxWidget',
    summary: 'Partially update a SDX Widget for the authenticated subject.',
    description:
      'Applies a partial update to the SDX Widget when it is owned by the authenticated subject. The service identifies the subject from the JWT sub claim rather than from the request body.',
  })
  @ApiParam({
    name: 'widgetId',
    description: 'The UUID of the SDX Widget.',
    schema: {
      type: 'string',
      format: 'uuid',
      example: SDX_WIDGET_ID_EXAMPLE,
    },
  })
  @ApiBody({
    type: PatchSdxWidgetDto,
    examples: {
      updateWidget: {
        value: PATCH_WIDGET_EXAMPLE,
      },
    },
  })
  @ApiOkResponse({
    description: 'The updated SDX Widget.',
    type: SdxWidgetDto,
    example: {
      ...SDX_WIDGET_EXAMPLE,
      ...PATCH_WIDGET_EXAMPLE,
    },
  })
  @ApiBadRequestResponse(PROBLEM_DETAIL_RESPONSE)
  @ApiUnprocessableEntityResponse(UNPROCESSABLE_ENTITY_RESPONSE)
  @ApiConflictResponse(CONFLICT_ERROR_RESPONSE)
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  @ApiNotFoundResponse(ERROR_RESPONSE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('widgetId') widgetId: string,
    @Body() dto: PatchSdxWidgetDto,
  ) {
    return this.widgetsService.patchForSubject(widgetId, user.subject, dto)
  }

  @Delete(':widgetId')
  @HttpCode(204)
  @RequireScopes('SDX-RI.sdx-widgets.delete')
  @ApiSecurity('oidc', ['SDX-RI.sdx-widgets.delete'])
  @ApiOperation({
    operationId: 'deleteSdxWidget',
    summary: 'Delete a SDX Widget owned by the authenticated subject.',
    description:
      'Deletes the SDX Widget when it is owned by the authenticated subject. Responds with 404 when the widget does not exist or is owned by another subject.',
  })
  @ApiParam({
    name: 'widgetId',
    description: 'The UUID of the SDX Widget.',
    schema: {
      type: 'string',
      format: 'uuid',
      example: SDX_WIDGET_ID_EXAMPLE,
    },
  })
  @ApiNoContentResponse({
    description: 'The SDX Widget was deleted.',
  })
  @ApiConflictResponse(CONFLICT_ERROR_RESPONSE)
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  @ApiNotFoundResponse(ERROR_RESPONSE)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('widgetId') widgetId: string) {
    return this.widgetsService.deleteForSubject(widgetId, user.subject)
  }
}

@ApiTags('Admin SDX Widgets')
@ApiSecurity('oidc', ['SDX-RI.sdx-widgets.admin'])
@ApiTooManyRequestsResponse(TOO_MANY_REQUESTS_RESPONSE)
@ApiInternalServerErrorResponse(INTERNAL_SERVER_ERROR_RESPONSE)
@UseGuards(JwtAuthGuard, ScopesGuard)
@Controller({ path: 'admin', version: '1' })
export class AdminSdxWidgetsController {
  constructor(private readonly widgetsService: SdxWidgetsService) {}

  @Get('subjects/:subject/sdx-widgets')
  @RequireScopes('SDX-RI.sdx-widgets.admin')
  @ApiSecurity('oidc', ['SDX-RI.sdx-widgets.admin'])
  @ApiOperation({
    operationId: 'adminListSubjectSdxWidgets',
    summary: 'List SDX Widgets for the requested subject.',
    description:
      'Returns the SDX Widgets owned by the subject identified in the path. This operation requires the SDX-RI.sdx-widgets.admin scope.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: SDX_WIDGET_STATUSES,
    description: 'Filter widgets by lifecycle status.',
  })
  @ApiQuery({
    name: 'name',
    required: false,
    schema: {
      type: 'string',
      minLength: 1,
      maxLength: 200,
    },
    description: 'Case-insensitive partial name match.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 25,
    },
    description: 'Maximum number of widgets to return.',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    schema: {
      type: 'string',
    },
    description: 'Opaque pagination cursor from the previous response.',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: SDX_WIDGET_SORT_FIELDS,
    description: 'Field used to sort results.',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: SDX_WIDGET_SORT_DIRECTIONS,
    description: 'Sort direction for the selected sort field.',
  })
  @ApiParam({
    name: 'subject',
    description: 'The subject identifier for the administrative operation.',
    schema: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
      example: SUBJECT_EXAMPLE,
    },
  })
  @ApiOkResponse({
    description: 'The list of SDX Widgets owned by the requested subject.',
    type: SdxWidgetListResponseDto,
    example: {
      items: [SDX_WIDGET_EXAMPLE],
      nextCursor: null,
    },
  })
  @ApiBadRequestResponse(PROBLEM_DETAIL_RESPONSE)
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  findForSubject(@Param('subject') subject: string, @Query() query: ListSdxWidgetsQueryDto) {
    return this.widgetsService.adminListForSubject(subject, query)
  }

  @Post('subjects/:subject/sdx-widgets')
  @RequireScopes('SDX-RI.sdx-widgets.admin')
  @ApiSecurity('oidc', ['SDX-RI.sdx-widgets.admin'])
  @ApiOperation({
    operationId: 'adminCreateSubjectSdxWidget',
    summary: 'Create a SDX Widget for the requested subject.',
    description:
      'Creates a new SDX Widget for the subject identified in the path. This operation requires the SDX-RI.sdx-widgets.admin scope.',
  })
  @ApiParam({
    name: 'subject',
    description: 'The subject identifier for the administrative operation.',
    schema: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
      example: SUBJECT_EXAMPLE,
    },
  })
  @ApiBody({
    type: CreateSdxWidgetDto,
    examples: {
      adminCreateSubjectWidget: {
        value: CREATE_WIDGET_EXAMPLE,
      },
    },
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'Optional client-generated key used to make create requests safely retryable. Reusing the same key with the same request body returns the original result.',
    schema: {
      type: 'string',
      minLength: 8,
      maxLength: 255,
      example: IDEMPOTENCY_KEY_EXAMPLE,
    },
  })
  @ApiCreatedResponse({
    description: 'The created SDX Widget.',
    type: SdxWidgetDto,
    example: SDX_WIDGET_EXAMPLE,
  })
  @ApiConflictResponse(CONFLICT_ERROR_RESPONSE)
  @ApiBadRequestResponse(PROBLEM_DETAIL_RESPONSE)
  @ApiUnprocessableEntityResponse(UNPROCESSABLE_ENTITY_RESPONSE)
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  createForSubject(
    @Param('subject') subject: string,
    @Body() dto: CreateSdxWidgetDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.widgetsService.adminCreateForSubject(subject, dto, idempotencyKey)
  }

  @Get('sdx-widgets/:widgetId')
  @RequireScopes('SDX-RI.sdx-widgets.admin')
  @ApiSecurity('oidc', ['SDX-RI.sdx-widgets.admin'])
  @ApiOperation({
    operationId: 'adminGetSdxWidget',
    summary: 'Get a SDX Widget by ID across subjects.',
    description:
      'Returns the SDX Widget identified by the path parameter across all subjects. This operation requires the SDX-RI.sdx-widgets.admin scope.',
  })
  @ApiParam({
    name: 'widgetId',
    description: 'The UUID of the SDX Widget.',
    schema: {
      type: 'string',
      format: 'uuid',
      example: SDX_WIDGET_ID_EXAMPLE,
    },
  })
  @ApiOkResponse({
    description: 'The requested SDX Widget.',
    type: SdxWidgetDto,
    example: SDX_WIDGET_EXAMPLE,
  })
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  @ApiNotFoundResponse(ERROR_RESPONSE)
  findOne(@Param('widgetId') widgetId: string) {
    return this.widgetsService.adminGet(widgetId)
  }

  @Put('sdx-widgets/:widgetId')
  @RequireScopes('SDX-RI.sdx-widgets.admin')
  @ApiSecurity('oidc', ['SDX-RI.sdx-widgets.admin'])
  @ApiOperation({
    operationId: 'adminReplaceSdxWidget',
    summary: 'Replace any SDX Widget by ID.',
    description:
      'Replaces the SDX Widget identified by the path parameter across all subjects. Subject transfer is allowed only on this administrative operation.',
  })
  @ApiParam({
    name: 'widgetId',
    description: 'The UUID of the SDX Widget.',
    schema: {
      type: 'string',
      format: 'uuid',
      example: SDX_WIDGET_ID_EXAMPLE,
    },
  })
  @ApiBody({
    type: AdminUpdateSdxWidgetDto,
    examples: {
      adminReplaceWidget: {
        value: ADMIN_UPDATE_WIDGET_EXAMPLE,
      },
    },
  })
  @ApiOkResponse({
    description: 'The replaced SDX Widget.',
    type: SdxWidgetDto,
    example: {
      ...SDX_WIDGET_EXAMPLE,
      ...ADMIN_UPDATE_WIDGET_EXAMPLE,
    },
  })
  @ApiBadRequestResponse(PROBLEM_DETAIL_RESPONSE)
  @ApiUnprocessableEntityResponse(UNPROCESSABLE_ENTITY_RESPONSE)
  @ApiConflictResponse(CONFLICT_ERROR_RESPONSE)
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  @ApiNotFoundResponse(ERROR_RESPONSE)
  replace(@Param('widgetId') widgetId: string, @Body() dto: AdminUpdateSdxWidgetDto) {
    return this.widgetsService.adminReplace(widgetId, dto)
  }

  @Patch('sdx-widgets/:widgetId')
  @RequireScopes('SDX-RI.sdx-widgets.admin')
  @ApiSecurity('oidc', ['SDX-RI.sdx-widgets.admin'])
  @ApiOperation({
    operationId: 'adminUpdateSdxWidget',
    summary: 'Partially update a SDX Widget by ID across subjects.',
    description:
      'Applies a partial update to the SDX Widget identified by the path parameter across all subjects. Subject transfer is allowed only on this administrative operation.',
  })
  @ApiParam({
    name: 'widgetId',
    description: 'The UUID of the SDX Widget.',
    schema: {
      type: 'string',
      format: 'uuid',
      example: SDX_WIDGET_ID_EXAMPLE,
    },
  })
  @ApiBody({
    type: AdminPatchSdxWidgetDto,
    examples: {
      adminUpdateWidget: {
        value: ADMIN_PATCH_WIDGET_EXAMPLE,
      },
    },
  })
  @ApiOkResponse({
    description: 'The updated SDX Widget.',
    type: SdxWidgetDto,
    example: {
      ...SDX_WIDGET_EXAMPLE,
      ...ADMIN_PATCH_WIDGET_EXAMPLE,
    },
  })
  @ApiBadRequestResponse(PROBLEM_DETAIL_RESPONSE)
  @ApiUnprocessableEntityResponse(UNPROCESSABLE_ENTITY_RESPONSE)
  @ApiConflictResponse(CONFLICT_ERROR_RESPONSE)
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  @ApiNotFoundResponse(ERROR_RESPONSE)
  update(@Param('widgetId') widgetId: string, @Body() dto: AdminPatchSdxWidgetDto) {
    return this.widgetsService.adminPatch(widgetId, dto)
  }

  @Delete('sdx-widgets/:widgetId')
  @HttpCode(204)
  @RequireScopes('SDX-RI.sdx-widgets.admin')
  @ApiSecurity('oidc', ['SDX-RI.sdx-widgets.admin'])
  @ApiOperation({
    operationId: 'adminDeleteSdxWidget',
    summary: 'Delete a SDX Widget by ID across subjects.',
    description:
      'Deletes the SDX Widget identified by the path parameter across all subjects. This operation requires the SDX-RI.sdx-widgets.admin scope.',
  })
  @ApiParam({
    name: 'widgetId',
    description: 'The UUID of the SDX Widget.',
    schema: {
      type: 'string',
      format: 'uuid',
      example: SDX_WIDGET_ID_EXAMPLE,
    },
  })
  @ApiNoContentResponse({
    description: 'The SDX Widget was deleted.',
  })
  @ApiConflictResponse(CONFLICT_ERROR_RESPONSE)
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  @ApiNotFoundResponse(ERROR_RESPONSE)
  remove(@Param('widgetId') widgetId: string) {
    return this.widgetsService.adminDelete(widgetId)
  }
}
