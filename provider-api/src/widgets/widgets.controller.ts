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
  ApiBearerAuth,
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
import { CurrentProviderCaller } from '../auth/current-provider-caller.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { ProviderServiceAuthGuard } from '../auth/provider-service-auth.guard'
import type { AuthenticatedUser, ProviderCaller } from '../auth/auth.types'
import { CreateWidgetDto } from './dto/create-widget.dto'
import {
  ListWidgetsQueryDto,
  WidgetListResponseDto,
  WIDGET_SORT_DIRECTIONS,
  WIDGET_SORT_FIELDS,
} from './dto/list-widgets.dto'
import {
  ListWidgetAccessEventsQueryDto,
  WidgetAccessEventListResponseDto,
} from './dto/widget-access-event.dto'
import {
  PatchWidgetDto,
  ProviderPatchWidgetDto,
  ProviderUpdateWidgetDto,
  UpdateWidgetDto,
} from './dto/update-widget.dto'
import {
  ErrorResponseDto,
  ProblemDetailResponseDto,
  WidgetDto,
  WIDGET_STATUSES,
  WIDGET_EXAMPLE,
} from './dto/widget.dto'
import { WidgetsService } from './widgets.service'

const WIDGET_ID_EXAMPLE = WIDGET_EXAMPLE.id
const SUBJECT_EXAMPLE = WIDGET_EXAMPLE.subject
const ERROR_EXAMPLE = {
  error: 'not_found',
  message: 'Widget not found',
  details: {
    correlationId: 'widget-2f7b8d43-7b0d-4b5f-8a6c-1a2b3c4d5e6f',
  },
}
const CONFLICT_ERROR_EXAMPLE = {
  error: 'conflict',
  message: 'Request conflicts with the current Widget state',
  details: {
    correlationId: 'widget-2f7b8d43-7b0d-4b5f-8a6c-1a2b3c4d5e6f',
  },
}
const TOO_MANY_REQUESTS_ERROR_EXAMPLE = {
  error: 'too_many_requests',
  message: 'Too many requests',
  details: {
    correlationId: 'widget-2f7b8d43-7b0d-4b5f-8a6c-1a2b3c4d5e6f',
    retryAfter: 60,
  },
}
const INTERNAL_SERVER_ERROR_EXAMPLE = {
  error: 'internal_server_error',
  message: 'Internal server error',
  details: {
    correlationId: 'widget-2f7b8d43-7b0d-4b5f-8a6c-1a2b3c4d5e6f',
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
  additionalData: {
    source: 'local-dev',
  },
}
const UPDATE_WIDGET_EXAMPLE = {
  name: 'Intake form v2',
  description: 'Updated widget used for intake workflow testing.',
  status: 'inactive',
  additionalData: {
    source: 'local-dev',
  },
}
const PATCH_WIDGET_EXAMPLE = {
  status: 'archived',
}
const WIDGET_SUMMARY_EXAMPLE = {
  id: WIDGET_EXAMPLE.id,
  subject: WIDGET_EXAMPLE.subject,
  name: WIDGET_EXAMPLE.name,
  status: WIDGET_EXAMPLE.status,
  updatedAt: WIDGET_EXAMPLE.updatedAt,
}
const PROVIDER_UPDATE_WIDGET_EXAMPLE = {
  subject: 'user-456',
  ...UPDATE_WIDGET_EXAMPLE,
}
const PROVIDER_PATCH_WIDGET_EXAMPLE = {
  subject: 'user-456',
  status: 'archived',
}
const CREATED_WIDGET_EXAMPLES = {
  createdWidget: {
    summary: 'Created widget',
    value: WIDGET_EXAMPLE,
  },
}
const REQUESTED_WIDGET_EXAMPLES = {
  requestedWidget: {
    summary: 'Requested widget',
    value: WIDGET_EXAMPLE,
  },
}
const REPLACED_WIDGET_EXAMPLES = {
  replacedWidget: {
    summary: 'Replaced widget',
    value: {
      ...WIDGET_EXAMPLE,
      ...UPDATE_WIDGET_EXAMPLE,
      updatedAt: '2026-05-13T18:30:00Z',
    },
  },
}
const UPDATED_WIDGET_EXAMPLES = {
  updatedWidget: {
    summary: 'Updated widget',
    value: {
      ...WIDGET_EXAMPLE,
      ...PATCH_WIDGET_EXAMPLE,
      updatedAt: '2026-05-13T18:30:00Z',
    },
  },
}
const PROVIDER_REPLACED_WIDGET_EXAMPLES = {
  providerReplacedWidget: {
    summary: 'Replaced provider widget',
    value: {
      ...WIDGET_EXAMPLE,
      ...PROVIDER_UPDATE_WIDGET_EXAMPLE,
      updatedAt: '2026-05-13T18:30:00Z',
    },
  },
}
const PROVIDER_UPDATED_WIDGET_EXAMPLES = {
  providerUpdatedWidget: {
    summary: 'Updated provider widget',
    value: {
      ...WIDGET_EXAMPLE,
      ...PROVIDER_PATCH_WIDGET_EXAMPLE,
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
          correlationId: 'widget-2f7b8d43-7b0d-4b5f-8a6c-1a2b3c4d5e6f',
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
        detail: 'The request body is syntactically valid but failed widget validation rules',
      },
    },
  },
}

@ApiTags('Widgets')
@ApiTooManyRequestsResponse(TOO_MANY_REQUESTS_RESPONSE)
@ApiInternalServerErrorResponse(INTERNAL_SERVER_ERROR_RESPONSE)
@UseGuards(JwtAuthGuard)
@Controller({ path: 'widgets', version: '1' })
export class WidgetsController {
  constructor(private readonly widgetsService: WidgetsService) {}

  private setWidgetEtag(response: Response, widget: WidgetDto): void {
    response.setHeader('ETag', this.widgetsService.etagForWidget(widget))
  }

  @Get()
  @ApiSecurity('openId', ['nrs:widgets:read'])
  @ApiOperation({
    operationId: 'listWidgets',
    summary: 'List Widgets owned by the authenticated subject.',
    description:
      'Returns the Widgets owned by the authenticated subject identified by the JWT sub claim.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: WIDGET_STATUSES,
    enumName: 'WidgetStatus',
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
    enum: WIDGET_SORT_FIELDS,
    schema: {
      type: 'string',
      enum: [...WIDGET_SORT_FIELDS],
      default: 'createdAt',
      example: 'createdAt',
    },
    description: 'Field used to sort results.',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: WIDGET_SORT_DIRECTIONS,
    schema: {
      type: 'string',
      enum: [...WIDGET_SORT_DIRECTIONS],
      default: 'desc',
      example: 'desc',
    },
    description: 'Sort direction for the selected sort field.',
  })
  @ApiOkResponse({
    description: 'The list of Widgets owned by the authenticated subject.',
    type: WidgetListResponseDto,
    examples: {
      listWidgets: {
        summary: 'List widgets',
        value: {
          items: [WIDGET_EXAMPLE],
          nextCursor: null,
        },
      },
    },
  })
  @ApiBadRequestResponse(PROBLEM_DETAIL_RESPONSE)
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListWidgetsQueryDto) {
    return this.widgetsService.listForSubject(user.subject, query)
  }

  @Post()
  @ApiSecurity('openId', ['nrs:widgets:create'])
  @ApiOperation({
    operationId: 'createWidget',
    summary: 'Create a Widget for the authenticated subject.',
    description:
      'Creates a new Widget for the authenticated subject. The service identifies the subject from the JWT sub claim rather than from the request body.',
  })
  @ApiBody({
    type: CreateWidgetDto,
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
    description: 'The created Widget.',
    type: WidgetDto,
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
    @Body() dto: CreateWidgetDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const widget = await this.widgetsService.createForSubject(user.subject, dto, idempotencyKey)
    this.setWidgetEtag(response, widget)
    return widget
  }

  @Get(':widgetId')
  @ApiSecurity('openId', ['nrs:widgets:read'])
  @ApiOperation({
    operationId: 'getWidget',
    summary: 'Get a Widget owned by the authenticated subject.',
    description:
      'Returns the Widget when it is owned by the authenticated subject. Responds with 404 when the widget does not exist or is owned by another subject.',
  })
  @ApiParam({
    name: 'widgetId',
    description: 'The UUID of the Widget.',
    schema: {
      type: 'string',
      format: 'uuid',
      example: WIDGET_ID_EXAMPLE,
    },
  })
  @ApiOkResponse({
    description: 'The requested Widget.',
    type: WidgetDto,
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
  @ApiSecurity('openId', ['nrs:widgets:update'])
  @ApiOperation({
    operationId: 'replaceWidget',
    summary: 'Replace a Widget for the authenticated subject.',
    description:
      'Replaces the Widget when it is owned by the authenticated subject. The service identifies the subject from the JWT sub claim rather than from the request body.',
  })
  @ApiParam({
    name: 'widgetId',
    description: 'The UUID of the Widget.',
    schema: {
      type: 'string',
      format: 'uuid',
      example: WIDGET_ID_EXAMPLE,
    },
  })
  @ApiBody({
    type: UpdateWidgetDto,
    examples: {
      replaceWidget: {
        summary: 'Replace a widget',
        value: UPDATE_WIDGET_EXAMPLE,
      },
    },
  })
  @ApiOkResponse({
    description: 'The replaced Widget.',
    type: WidgetDto,
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
    @Body() dto: UpdateWidgetDto,
    @Headers('if-match') ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const widget = await this.widgetsService.replaceForSubject(widgetId, user.subject, dto, ifMatch)
    this.setWidgetEtag(response, widget)
    return widget
  }

  @Patch(':widgetId')
  @ApiSecurity('openId', ['nrs:widgets:update'])
  @ApiOperation({
    operationId: 'updateWidget',
    summary: 'Partially update a Widget for the authenticated subject.',
    description:
      'Applies a partial update to the Widget when it is owned by the authenticated subject. The service identifies the subject from the JWT sub claim rather than from the request body.',
  })
  @ApiParam({
    name: 'widgetId',
    description: 'The UUID of the Widget.',
    schema: {
      type: 'string',
      format: 'uuid',
      example: WIDGET_ID_EXAMPLE,
    },
  })
  @ApiBody({
    type: PatchWidgetDto,
    examples: {
      updateWidget: {
        summary: 'Archive a widget',
        value: PATCH_WIDGET_EXAMPLE,
      },
    },
  })
  @ApiOkResponse({
    description: 'The partially updated Widget.',
    type: WidgetDto,
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
    @Body() dto: PatchWidgetDto,
    @Headers('if-match') ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const widget = await this.widgetsService.patchForSubject(widgetId, user.subject, dto, ifMatch)
    this.setWidgetEtag(response, widget)
    return widget
  }

  @Delete(':widgetId')
  @HttpCode(204)
  @ApiSecurity('openId', ['nrs:widgets:delete'])
  @ApiOperation({
    operationId: 'deleteWidget',
    summary: 'Delete a Widget owned by the authenticated subject.',
    description:
      'Deletes the Widget when it is owned by the authenticated subject. Responds with 404 when the widget does not exist or is owned by another subject.',
  })
  @ApiParam({
    name: 'widgetId',
    description: 'The UUID of the Widget.',
    schema: {
      type: 'string',
      format: 'uuid',
      example: WIDGET_ID_EXAMPLE,
    },
  })
  @ApiNoContentResponse({
    description: 'The Widget was deleted.',
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

@ApiTags('Provider Widgets')
@ApiBearerAuth('serviceBearer')
@ApiHeader({
  name: 'x-on-behalf-of-sub',
  required: false,
  description:
    'Original user subject represented by a provider-sdx-api client token. Required when the bearer token is a client token; omit for user tokens.',
  schema: {
    type: 'string',
    example: SUBJECT_EXAMPLE,
  },
})
@ApiHeader({
  name: 'x-on-behalf-of-username',
  required: false,
  description:
    'Original username represented by a provider-sdx-api client token. Required when the bearer token is a client token; omit for user tokens.',
  schema: {
    type: 'string',
    example: 'Alex Smith',
  },
})
@ApiTooManyRequestsResponse(TOO_MANY_REQUESTS_RESPONSE)
@ApiInternalServerErrorResponse(INTERNAL_SERVER_ERROR_RESPONSE)
@UseGuards(ProviderServiceAuthGuard)
@Controller({ version: '1' })
export class ProviderWidgetsController {
  constructor(private readonly widgetsService: WidgetsService) {}

  private setWidgetEtag(response: Response, widget: WidgetDto): void {
    response.setHeader('ETag', this.widgetsService.etagForWidget(widget))
  }

  @Get('subjects/:subject/widgets')
  @ApiSecurity('openId', ['nrs:widgets:read'])
  @ApiOperation({
    operationId: 'providerListSubjectWidgets',
    summary: 'List Widgets for the requested subject.',
    description: 'Returns the Widgets owned by the subject identified in the path.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: WIDGET_STATUSES,
    enumName: 'WidgetStatus',
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
    enum: WIDGET_SORT_FIELDS,
    schema: {
      type: 'string',
      enum: [...WIDGET_SORT_FIELDS],
      default: 'createdAt',
      example: 'createdAt',
    },
    description: 'Field used to sort results.',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: WIDGET_SORT_DIRECTIONS,
    schema: {
      type: 'string',
      enum: [...WIDGET_SORT_DIRECTIONS],
      default: 'desc',
      example: 'desc',
    },
    description: 'Sort direction for the selected sort field.',
  })
  @ApiParam({
    name: 'subject',
    description: 'The owner subject identifier.',
    schema: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
      example: SUBJECT_EXAMPLE,
    },
  })
  @ApiOkResponse({
    description: 'The list of Widgets owned by the requested subject.',
    type: WidgetListResponseDto,
    examples: {
      listWidgetsForSubject: {
        summary: 'List widgets for a subject',
        value: {
          items: [WIDGET_SUMMARY_EXAMPLE],
          nextCursor: null,
        },
      },
    },
  })
  @ApiBadRequestResponse(PROBLEM_DETAIL_RESPONSE)
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  findForSubject(
    @CurrentProviderCaller() caller: ProviderCaller,
    @Param('subject') subject: string,
    @Query() query: ListWidgetsQueryDto,
  ) {
    return this.widgetsService.providerListForSubject(subject, query, caller)
  }

  @Get('subjects/:subject/events')
  @ApiSecurity('openId', ['nrs:widgets:read'])
  @ApiOperation({
    operationId: 'providerListSubjectWidgetEvents',
    summary: 'List Widget access events for the requested subject.',
    description:
      'Returns audit events for widget resources owned by the subject identified in the path.',
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
    description: 'Maximum number of events to return.',
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
  @ApiParam({
    name: 'subject',
    description: 'The owner subject identifier.',
    schema: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
      example: SUBJECT_EXAMPLE,
    },
  })
  @ApiOkResponse({
    description: 'The list of Widget access events for the requested subject.',
    type: WidgetAccessEventListResponseDto,
  })
  @ApiBadRequestResponse(PROBLEM_DETAIL_RESPONSE)
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  listEventsForSubject(
    @CurrentProviderCaller() caller: ProviderCaller,
    @Param('subject') subject: string,
    @Query() query: ListWidgetAccessEventsQueryDto,
  ) {
    return this.widgetsService.providerListEventsForSubject(subject, query, caller)
  }

  @Post('subjects/:subject/widgets')
  @ApiSecurity('openId', ['nrs:widgets:create'])
  @ApiOperation({
    operationId: 'providerCreateSubjectWidget',
    summary: 'Create a Widget for the requested subject.',
    description: 'Creates a new Widget for the subject identified in the path.',
  })
  @ApiParam({
    name: 'subject',
    description: 'The owner subject identifier.',
    schema: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
      example: SUBJECT_EXAMPLE,
    },
  })
  @ApiBody({
    type: CreateWidgetDto,
    examples: {
      providerCreateSubjectWidget: {
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
    description: 'The created Widget.',
    type: WidgetDto,
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
    @Body() dto: CreateWidgetDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
    @CurrentProviderCaller() caller: ProviderCaller,
  ) {
    const widget = await this.widgetsService.providerCreateForSubject(
      subject,
      dto,
      caller,
      idempotencyKey,
    )
    this.setWidgetEtag(response, widget)
    return widget
  }

  @Get('widgets/:widgetId')
  @ApiSecurity('openId', ['nrs:widgets:read'])
  @ApiOperation({
    operationId: 'providerGetWidget',
    summary: 'Get a Widget by ID.',
    description: 'Returns the Widget identified by the path parameter.',
  })
  @ApiParam({
    name: 'widgetId',
    description: 'The UUID of the Widget.',
    schema: {
      type: 'string',
      format: 'uuid',
      example: WIDGET_ID_EXAMPLE,
    },
  })
  @ApiOkResponse({
    description: 'The requested Widget.',
    type: WidgetDto,
    examples: REQUESTED_WIDGET_EXAMPLES,
    headers: ETAG_RESPONSE_HEADER,
  })
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  @ApiNotFoundResponse(ERROR_RESPONSE)
  async findOne(
    @CurrentProviderCaller() caller: ProviderCaller,
    @Param('widgetId') widgetId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const widget = await this.widgetsService.providerGet(widgetId, caller)
    this.setWidgetEtag(response, widget)
    return widget
  }

  @Put('widgets/:widgetId')
  @ApiSecurity('openId', ['nrs:widgets:update'])
  @ApiOperation({
    operationId: 'providerReplaceWidget',
    summary: 'Replace any Widget by ID.',
    description:
      'Replaces the Widget identified by the path parameter. Subject transfer is allowed on this provider operation.',
  })
  @ApiParam({
    name: 'widgetId',
    description: 'The UUID of the Widget.',
    schema: {
      type: 'string',
      format: 'uuid',
      example: WIDGET_ID_EXAMPLE,
    },
  })
  @ApiBody({
    type: ProviderUpdateWidgetDto,
    examples: {
      providerReplaceWidget: {
        summary: 'Replace a widget',
        value: PROVIDER_UPDATE_WIDGET_EXAMPLE,
      },
    },
  })
  @ApiOkResponse({
    description: 'The replaced Widget.',
    type: WidgetDto,
    examples: PROVIDER_REPLACED_WIDGET_EXAMPLES,
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
    @Body() dto: ProviderUpdateWidgetDto,
    @Headers('if-match') ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
    @CurrentProviderCaller() caller: ProviderCaller,
  ) {
    const widget = await this.widgetsService.providerReplace(widgetId, dto, caller, ifMatch)
    this.setWidgetEtag(response, widget)
    return widget
  }

  @Patch('widgets/:widgetId')
  @ApiSecurity('openId', ['nrs:widgets:update'])
  @ApiOperation({
    operationId: 'providerUpdateWidget',
    summary: 'Partially update a Widget by ID.',
    description:
      'Applies a partial update to the Widget identified by the path parameter. Subject transfer is allowed on this provider operation.',
  })
  @ApiParam({
    name: 'widgetId',
    description: 'The UUID of the Widget.',
    schema: {
      type: 'string',
      format: 'uuid',
      example: WIDGET_ID_EXAMPLE,
    },
  })
  @ApiBody({
    type: ProviderPatchWidgetDto,
    examples: {
      providerUpdateWidget: {
        summary: 'Archive a widget',
        value: PROVIDER_PATCH_WIDGET_EXAMPLE,
      },
    },
  })
  @ApiOkResponse({
    description: 'The partially updated Widget.',
    type: WidgetDto,
    examples: PROVIDER_UPDATED_WIDGET_EXAMPLES,
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
    @Body() dto: ProviderPatchWidgetDto,
    @Headers('if-match') ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
    @CurrentProviderCaller() caller: ProviderCaller,
  ) {
    const widget = await this.widgetsService.providerPatch(widgetId, dto, caller, ifMatch)
    this.setWidgetEtag(response, widget)
    return widget
  }

  @Delete('widgets/:widgetId')
  @ApiSecurity('openId', ['nrs:widgets:delete'])
  @HttpCode(204)
  @ApiOperation({
    operationId: 'providerDeleteWidget',
    summary: 'Delete a Widget by ID.',
    description: 'Deletes the Widget identified by the path parameter.',
  })
  @ApiParam({
    name: 'widgetId',
    description: 'The UUID of the Widget.',
    schema: {
      type: 'string',
      format: 'uuid',
      example: WIDGET_ID_EXAMPLE,
    },
  })
  @ApiNoContentResponse({
    description: 'The Widget was deleted.',
  })
  @ApiHeader(IF_MATCH_HEADER)
  @ApiConflictResponse(CONFLICT_ERROR_RESPONSE)
  @ApiPreconditionFailedResponse(PRECONDITION_FAILED_RESPONSE)
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  @ApiNotFoundResponse(ERROR_RESPONSE)
  remove(
    @CurrentProviderCaller() caller: ProviderCaller,
    @Param('widgetId') widgetId: string,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    return this.widgetsService.providerDelete(widgetId, caller, ifMatch)
  }
}
