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
import { CreateWidgetDto } from './dto/create-widget.dto'
import {
  ListWidgetsQueryDto,
  WidgetListResponseDto,
  WIDGET_SORT_DIRECTIONS,
  WIDGET_SORT_FIELDS,
} from './dto/list-widgets.dto'
import { PatchWidgetDto, UpdateWidgetDto } from './dto/update-widget.dto'
import {
  ErrorResponseDto,
  ProblemDetailResponseDto,
  WidgetDto,
  WIDGET_STATUSES,
  WIDGET_EXAMPLE,
} from './dto/widget.dto'
import { WidgetsService } from './widgets.service'

const WIDGET_ID_EXAMPLE = WIDGET_EXAMPLE.id
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

  private usernameFor(user: AuthenticatedUser): string {
    for (const claim of ['name', 'preferred_username', 'email']) {
      const value = user.claims[claim]
      if (typeof value === 'string' && value.trim()) {
        return value.trim().slice(0, 255)
      }
    }
    return user.subject
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
    return this.widgetsService.listForSubject(user.subject, this.usernameFor(user), query)
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
    const widget = await this.widgetsService.createForSubject(
      user.subject,
      this.usernameFor(user),
      dto,
      idempotencyKey,
    )
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
    const widget = await this.widgetsService.getForSubject(
      widgetId,
      user.subject,
      this.usernameFor(user),
    )
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
    const widget = await this.widgetsService.replaceForSubject(
      widgetId,
      user.subject,
      this.usernameFor(user),
      dto,
      ifMatch,
    )
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
    const widget = await this.widgetsService.patchForSubject(
      widgetId,
      user.subject,
      this.usernameFor(user),
      dto,
      ifMatch,
    )
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
    return this.widgetsService.deleteForSubject(
      widgetId,
      user.subject,
      this.usernameFor(user),
      ifMatch,
    )
  }
}
