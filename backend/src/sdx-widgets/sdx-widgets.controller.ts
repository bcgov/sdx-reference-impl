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
  Res,
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
  ApiPreconditionFailedResponse,
  ApiQuery,
  ApiSecurity,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger'
import type { Response } from 'express'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
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
    correlationId: 'sdxw-2f7b8d43-7b0d-4b5f-8a6c-1a2b3c4d5e6f',
  },
}
const CONFLICT_ERROR_EXAMPLE = {
  error: 'conflict',
  message: 'Request conflicts with the current SDX Widget state',
  details: {
    correlationId: 'sdxw-2f7b8d43-7b0d-4b5f-8a6c-1a2b3c4d5e6f',
  },
}
const TOO_MANY_REQUESTS_ERROR_EXAMPLE = {
  error: 'too_many_requests',
  message: 'Too many requests',
  details: {
    correlationId: 'sdxw-2f7b8d43-7b0d-4b5f-8a6c-1a2b3c4d5e6f',
    retryAfter: 60,
  },
}
const INTERNAL_SERVER_ERROR_EXAMPLE = {
  error: 'internal_server_error',
  message: 'Internal server error',
  details: {
    correlationId: 'sdxw-2f7b8d43-7b0d-4b5f-8a6c-1a2b3c4d5e6f',
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
const CREATED_WIDGET_EXAMPLES = {
  createdWidget: {
    summary: 'Created widget',
    value: SDX_WIDGET_EXAMPLE,
  },
}
const REQUESTED_WIDGET_EXAMPLES = {
  requestedWidget: {
    summary: 'Requested widget',
    value: SDX_WIDGET_EXAMPLE,
  },
}
const REPLACED_WIDGET_EXAMPLES = {
  replacedWidget: {
    summary: 'Replaced widget',
    value: {
      ...SDX_WIDGET_EXAMPLE,
      ...UPDATE_WIDGET_EXAMPLE,
      updatedAt: '2026-05-13T18:30:00Z',
    },
  },
}
const UPDATED_WIDGET_EXAMPLES = {
  updatedWidget: {
    summary: 'Updated widget',
    value: {
      ...SDX_WIDGET_EXAMPLE,
      ...PATCH_WIDGET_EXAMPLE,
      updatedAt: '2026-05-13T18:30:00Z',
    },
  },
}
const ADMIN_REPLACED_WIDGET_EXAMPLES = {
  adminReplacedWidget: {
    summary: 'Replaced widget across subjects',
    value: {
      ...SDX_WIDGET_EXAMPLE,
      ...ADMIN_UPDATE_WIDGET_EXAMPLE,
      updatedAt: '2026-05-13T18:30:00Z',
    },
  },
}
const ADMIN_UPDATED_WIDGET_EXAMPLES = {
  adminUpdatedWidget: {
    summary: 'Updated widget across subjects',
    value: {
      ...SDX_WIDGET_EXAMPLE,
      ...ADMIN_PATCH_WIDGET_EXAMPLE,
      updatedAt: '2026-05-13T18:30:00Z',
    },
  },
}
const IDEMPOTENCY_KEY_EXAMPLE = 'req-12345678'
const ETAG_EXAMPLE = '"u6I3AI8rSnvR3uOSYVQbPiZF7cP8fIQ77U1zba2tI8A"'
const ERROR_RESPONSE = {
  type: ErrorResponseDto,
  examples: {
    errorResponse: {
      summary: 'Error response',
      value: ERROR_EXAMPLE,
    },
  },
}
const CONFLICT_ERROR_RESPONSE = {
  type: ErrorResponseDto,
  examples: {
    widgetConflict: {
      summary: 'Request conflicts with widget state',
      value: CONFLICT_ERROR_EXAMPLE,
    },
  },
}
const TOO_MANY_REQUESTS_RESPONSE = {
  type: ErrorResponseDto,
  examples: {
    rateLimited: {
      summary: 'Request rate limited',
      value: TOO_MANY_REQUESTS_ERROR_EXAMPLE,
    },
  },
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
  examples: {
    unexpectedError: {
      summary: 'Unexpected server error',
      value: INTERNAL_SERVER_ERROR_EXAMPLE,
    },
  },
}
const ETAG_RESPONSE_HEADER = {
  ETag: {
    description: 'Entity tag representing the returned widget version.',
    schema: {
      type: 'string',
      example: ETAG_EXAMPLE,
    },
  },
}
const IF_MATCH_HEADER = {
  name: 'If-Match',
  required: false,
  description:
    'Optional entity tag from a previous GET response. When supplied, the update or delete only succeeds if the widget has not changed.',
  schema: {
    type: 'string',
    example: ETAG_EXAMPLE,
  },
}
const PRECONDITION_FAILED_RESPONSE = {
  description: 'The supplied If-Match value does not match the current widget version.',
  type: ErrorResponseDto,
  examples: {
    staleEntityTag: {
      summary: 'If-Match does not match',
      value: {
        error: 'precondition_failed',
        message: 'The supplied If-Match value does not match the current widget version',
        details: {
          correlationId: 'sdxw-2f7b8d43-7b0d-4b5f-8a6c-1a2b3c4d5e6f',
        },
      },
    },
  },
}
const PROBLEM_DETAIL_RESPONSE = {
  type: ProblemDetailResponseDto,
  examples: {
    invalidRequest: {
      summary: 'Invalid request',
      value: PROBLEM_DETAIL_EXAMPLE,
    },
  },
}
const UNPROCESSABLE_ENTITY_RESPONSE = {
  type: ProblemDetailResponseDto,
  examples: {
    invalidWidgetName: {
      summary: 'Request body fails validation',
      value: {
        ...PROBLEM_DETAIL_EXAMPLE,
        type: 'tag:semantic-validation-errors',
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'The request body is syntactically valid but failed SDX widget validation rules',
      },
    },
  },
}

@ApiTags('SDX Widgets')
@ApiTooManyRequestsResponse(TOO_MANY_REQUESTS_RESPONSE)
@ApiInternalServerErrorResponse(INTERNAL_SERVER_ERROR_RESPONSE)
@UseGuards(JwtAuthGuard)
@Controller({ path: 'sdx-widgets', version: '1' })
export class SdxWidgetsController {
  constructor(private readonly widgetsService: SdxWidgetsService) {}

  private setWidgetEtag(response: Response, widget: SdxWidgetDto): void {
    response.setHeader('ETag', this.widgetsService.etagForWidget(widget))
  }

  @Get()
  @ApiSecurity('openId', ['SDX-RI.sdx-widgets.read'])
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
    enumName: 'SdxWidgetStatus',
    example: 'active',
    description: 'Filter widgets by lifecycle status.',
  })
  @ApiQuery({
    name: 'name',
    required: false,
    schema: {
      type: 'string',
      minLength: 1,
      maxLength: 200,
      example: 'intake',
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
      example: 'eyJvZmZzZXQiOjI1fQ',
    },
    description: 'Opaque pagination cursor from the previous response.',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: SDX_WIDGET_SORT_FIELDS,
    schema: {
      type: 'string',
      enum: [...SDX_WIDGET_SORT_FIELDS],
      default: 'createdAt',
      example: 'createdAt',
    },
    description: 'Field used to sort results.',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: SDX_WIDGET_SORT_DIRECTIONS,
    schema: {
      type: 'string',
      enum: [...SDX_WIDGET_SORT_DIRECTIONS],
      default: 'desc',
      example: 'desc',
    },
    description: 'Sort direction for the selected sort field.',
  })
  @ApiOkResponse({
    description: 'The list of SDX Widgets owned by the authenticated subject.',
    type: SdxWidgetListResponseDto,
    examples: {
      listWidgets: {
        summary: 'List widgets',
        value: {
          items: [SDX_WIDGET_EXAMPLE],
          nextCursor: null,
        },
      },
    },
  })
  @ApiBadRequestResponse(PROBLEM_DETAIL_RESPONSE)
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListSdxWidgetsQueryDto) {
    return this.widgetsService.listForSubject(user.subject, query)
  }

  @Post()
  @ApiSecurity('openId', ['SDX-RI.sdx-widgets.create'])
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
        summary: 'Create an active widget',
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
    examples: CREATED_WIDGET_EXAMPLES,
    headers: ETAG_RESPONSE_HEADER,
  })
  @ApiConflictResponse(CONFLICT_ERROR_RESPONSE)
  @ApiBadRequestResponse(PROBLEM_DETAIL_RESPONSE)
  @ApiUnprocessableEntityResponse(UNPROCESSABLE_ENTITY_RESPONSE)
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSdxWidgetDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const widget = await this.widgetsService.createForSubject(user.subject, dto, idempotencyKey)
    this.setWidgetEtag(response, widget)
    return widget
  }

  @Get(':widgetId')
  @ApiSecurity('openId', ['SDX-RI.sdx-widgets.read'])
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
    examples: REQUESTED_WIDGET_EXAMPLES,
    headers: ETAG_RESPONSE_HEADER,
  })
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  @ApiNotFoundResponse(ERROR_RESPONSE)
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('widgetId') widgetId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const widget = await this.widgetsService.getForSubject(widgetId, user.subject)
    this.setWidgetEtag(response, widget)
    return widget
  }

  @Put(':widgetId')
  @ApiSecurity('openId', ['SDX-RI.sdx-widgets.update'])
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
        summary: 'Replace a widget',
        value: UPDATE_WIDGET_EXAMPLE,
      },
    },
  })
  @ApiOkResponse({
    description: 'The replaced SDX Widget.',
    type: SdxWidgetDto,
    examples: REPLACED_WIDGET_EXAMPLES,
    headers: ETAG_RESPONSE_HEADER,
  })
  @ApiHeader(IF_MATCH_HEADER)
  @ApiBadRequestResponse(PROBLEM_DETAIL_RESPONSE)
  @ApiUnprocessableEntityResponse(UNPROCESSABLE_ENTITY_RESPONSE)
  @ApiConflictResponse(CONFLICT_ERROR_RESPONSE)
  @ApiPreconditionFailedResponse(PRECONDITION_FAILED_RESPONSE)
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  @ApiNotFoundResponse(ERROR_RESPONSE)
  async replace(
    @CurrentUser() user: AuthenticatedUser,
    @Param('widgetId') widgetId: string,
    @Body() dto: UpdateSdxWidgetDto,
    @Headers('if-match') ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const widget = await this.widgetsService.replaceForSubject(widgetId, user.subject, dto, ifMatch)
    this.setWidgetEtag(response, widget)
    return widget
  }

  @Patch(':widgetId')
  @ApiSecurity('openId', ['SDX-RI.sdx-widgets.update'])
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
        summary: 'Archive a widget',
        value: PATCH_WIDGET_EXAMPLE,
      },
    },
  })
  @ApiOkResponse({
    description: 'The updated SDX Widget.',
    type: SdxWidgetDto,
    examples: UPDATED_WIDGET_EXAMPLES,
    headers: ETAG_RESPONSE_HEADER,
  })
  @ApiHeader(IF_MATCH_HEADER)
  @ApiBadRequestResponse(PROBLEM_DETAIL_RESPONSE)
  @ApiUnprocessableEntityResponse(UNPROCESSABLE_ENTITY_RESPONSE)
  @ApiConflictResponse(CONFLICT_ERROR_RESPONSE)
  @ApiPreconditionFailedResponse(PRECONDITION_FAILED_RESPONSE)
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  @ApiNotFoundResponse(ERROR_RESPONSE)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('widgetId') widgetId: string,
    @Body() dto: PatchSdxWidgetDto,
    @Headers('if-match') ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const widget = await this.widgetsService.patchForSubject(widgetId, user.subject, dto, ifMatch)
    this.setWidgetEtag(response, widget)
    return widget
  }

  @Delete(':widgetId')
  @HttpCode(204)
  @ApiSecurity('openId', ['SDX-RI.sdx-widgets.delete'])
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
  @ApiHeader(IF_MATCH_HEADER)
  @ApiConflictResponse(CONFLICT_ERROR_RESPONSE)
  @ApiPreconditionFailedResponse(PRECONDITION_FAILED_RESPONSE)
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  @ApiNotFoundResponse(ERROR_RESPONSE)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('widgetId') widgetId: string,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    return this.widgetsService.deleteForSubject(widgetId, user.subject, ifMatch)
  }
}

@ApiTags('Admin SDX Widgets')
@ApiTooManyRequestsResponse(TOO_MANY_REQUESTS_RESPONSE)
@ApiInternalServerErrorResponse(INTERNAL_SERVER_ERROR_RESPONSE)
@UseGuards(JwtAuthGuard)
@Controller({ path: 'admin', version: '1' })
export class AdminSdxWidgetsController {
  constructor(private readonly widgetsService: SdxWidgetsService) {}

  private setWidgetEtag(response: Response, widget: SdxWidgetDto): void {
    response.setHeader('ETag', this.widgetsService.etagForWidget(widget))
  }

  @Get('subjects/:subject/sdx-widgets')
  @ApiSecurity('openId', ['SDX-RI.sdx-widgets.admin'])
  @ApiOperation({
    operationId: 'adminListSubjectSdxWidgets',
    summary: 'List SDX Widgets for the requested subject.',
    description: 'Returns the SDX Widgets owned by the subject identified in the path.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: SDX_WIDGET_STATUSES,
    enumName: 'SdxWidgetStatus',
    example: 'active',
    description: 'Filter widgets by lifecycle status.',
  })
  @ApiQuery({
    name: 'name',
    required: false,
    schema: {
      type: 'string',
      minLength: 1,
      maxLength: 200,
      example: 'intake',
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
      example: 'eyJvZmZzZXQiOjI1fQ',
    },
    description: 'Opaque pagination cursor from the previous response.',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: SDX_WIDGET_SORT_FIELDS,
    schema: {
      type: 'string',
      enum: [...SDX_WIDGET_SORT_FIELDS],
      default: 'createdAt',
      example: 'createdAt',
    },
    description: 'Field used to sort results.',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: SDX_WIDGET_SORT_DIRECTIONS,
    schema: {
      type: 'string',
      enum: [...SDX_WIDGET_SORT_DIRECTIONS],
      default: 'desc',
      example: 'desc',
    },
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
    examples: {
      listWidgetsForSubject: {
        summary: 'List widgets for a subject',
        value: {
          items: [SDX_WIDGET_EXAMPLE],
          nextCursor: null,
        },
      },
    },
  })
  @ApiBadRequestResponse(PROBLEM_DETAIL_RESPONSE)
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  findForSubject(@Param('subject') subject: string, @Query() query: ListSdxWidgetsQueryDto) {
    return this.widgetsService.adminListForSubject(subject, query)
  }

  @Post('subjects/:subject/sdx-widgets')
  @ApiSecurity('openId', ['SDX-RI.sdx-widgets.admin'])
  @ApiOperation({
    operationId: 'adminCreateSubjectSdxWidget',
    summary: 'Create a SDX Widget for the requested subject.',
    description: 'Creates a new SDX Widget for the subject identified in the path.',
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
        summary: 'Create an active widget for a subject',
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
    examples: CREATED_WIDGET_EXAMPLES,
    headers: ETAG_RESPONSE_HEADER,
  })
  @ApiConflictResponse(CONFLICT_ERROR_RESPONSE)
  @ApiBadRequestResponse(PROBLEM_DETAIL_RESPONSE)
  @ApiUnprocessableEntityResponse(UNPROCESSABLE_ENTITY_RESPONSE)
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  async createForSubject(
    @Param('subject') subject: string,
    @Body() dto: CreateSdxWidgetDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const widget = await this.widgetsService.adminCreateForSubject(subject, dto, idempotencyKey)
    this.setWidgetEtag(response, widget)
    return widget
  }

  @Get('sdx-widgets/:widgetId')
  @ApiSecurity('openId', ['SDX-RI.sdx-widgets.admin'])
  @ApiOperation({
    operationId: 'adminGetSdxWidget',
    summary: 'Get a SDX Widget by ID across subjects.',
    description: 'Returns the SDX Widget identified by the path parameter across all subjects.',
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
    examples: REQUESTED_WIDGET_EXAMPLES,
    headers: ETAG_RESPONSE_HEADER,
  })
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  @ApiNotFoundResponse(ERROR_RESPONSE)
  async findOne(
    @Param('widgetId') widgetId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const widget = await this.widgetsService.adminGet(widgetId)
    this.setWidgetEtag(response, widget)
    return widget
  }

  @Put('sdx-widgets/:widgetId')
  @ApiSecurity('openId', ['SDX-RI.sdx-widgets.admin'])
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
        summary: 'Replace a widget and transfer ownership',
        value: ADMIN_UPDATE_WIDGET_EXAMPLE,
      },
    },
  })
  @ApiOkResponse({
    description: 'The replaced SDX Widget.',
    type: SdxWidgetDto,
    examples: ADMIN_REPLACED_WIDGET_EXAMPLES,
    headers: ETAG_RESPONSE_HEADER,
  })
  @ApiHeader(IF_MATCH_HEADER)
  @ApiBadRequestResponse(PROBLEM_DETAIL_RESPONSE)
  @ApiUnprocessableEntityResponse(UNPROCESSABLE_ENTITY_RESPONSE)
  @ApiConflictResponse(CONFLICT_ERROR_RESPONSE)
  @ApiPreconditionFailedResponse(PRECONDITION_FAILED_RESPONSE)
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  @ApiNotFoundResponse(ERROR_RESPONSE)
  async replace(
    @Param('widgetId') widgetId: string,
    @Body() dto: AdminUpdateSdxWidgetDto,
    @Headers('if-match') ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const widget = await this.widgetsService.adminReplace(widgetId, dto, ifMatch)
    this.setWidgetEtag(response, widget)
    return widget
  }

  @Patch('sdx-widgets/:widgetId')
  @ApiSecurity('openId', ['SDX-RI.sdx-widgets.admin'])
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
        summary: 'Archive a widget and transfer ownership',
        value: ADMIN_PATCH_WIDGET_EXAMPLE,
      },
    },
  })
  @ApiOkResponse({
    description: 'The updated SDX Widget.',
    type: SdxWidgetDto,
    examples: ADMIN_UPDATED_WIDGET_EXAMPLES,
    headers: ETAG_RESPONSE_HEADER,
  })
  @ApiHeader(IF_MATCH_HEADER)
  @ApiBadRequestResponse(PROBLEM_DETAIL_RESPONSE)
  @ApiUnprocessableEntityResponse(UNPROCESSABLE_ENTITY_RESPONSE)
  @ApiConflictResponse(CONFLICT_ERROR_RESPONSE)
  @ApiPreconditionFailedResponse(PRECONDITION_FAILED_RESPONSE)
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  @ApiNotFoundResponse(ERROR_RESPONSE)
  async update(
    @Param('widgetId') widgetId: string,
    @Body() dto: AdminPatchSdxWidgetDto,
    @Headers('if-match') ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const widget = await this.widgetsService.adminPatch(widgetId, dto, ifMatch)
    this.setWidgetEtag(response, widget)
    return widget
  }

  @Delete('sdx-widgets/:widgetId')
  @HttpCode(204)
  @ApiSecurity('openId', ['SDX-RI.sdx-widgets.admin'])
  @ApiOperation({
    operationId: 'adminDeleteSdxWidget',
    summary: 'Delete a SDX Widget by ID across subjects.',
    description: 'Deletes the SDX Widget identified by the path parameter across all subjects.',
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
  @ApiHeader(IF_MATCH_HEADER)
  @ApiConflictResponse(CONFLICT_ERROR_RESPONSE)
  @ApiPreconditionFailedResponse(PRECONDITION_FAILED_RESPONSE)
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  @ApiNotFoundResponse(ERROR_RESPONSE)
  remove(@Param('widgetId') widgetId: string, @Headers('if-match') ifMatch: string | undefined) {
    return this.widgetsService.adminDelete(widgetId, ifMatch)
  }
}
