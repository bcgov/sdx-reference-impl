import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequireScopes } from '../auth/scopes.decorator'
import { ScopesGuard } from '../auth/scopes.guard'
import type { AuthenticatedUser } from '../auth/auth.types'
import { CreateWidgetDto } from './dto/create-widget.dto'
import {
  AdminPatchWidgetDto,
  AdminUpdateWidgetDto,
  PatchWidgetDto,
  UpdateWidgetDto,
} from './dto/update-widget.dto'
import {
  ErrorResponseDto,
  ProblemDetailResponseDto,
  WidgetDto,
  WIDGET_EXAMPLE,
} from './dto/widget.dto'
import { WidgetsService } from './widgets.service'

const WIDGET_ID_EXAMPLE = WIDGET_EXAMPLE.id
const SUBJECT_EXAMPLE = WIDGET_EXAMPLE.subject
const ERROR_EXAMPLE = {
  error: 'not_found',
  message: 'Widget not found',
  details: {
    correlationId: 'req-abc123-xyz',
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
const ERROR_RESPONSE = {
  type: ErrorResponseDto,
  example: ERROR_EXAMPLE,
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
    detail: 'The request body is syntactically valid but failed Widget validation rules',
  },
}

@ApiTags('Widgets')
@ApiSecurity('oidc', ['widgets.read', 'widgets.write'])
@UseGuards(JwtAuthGuard, ScopesGuard)
@Controller({ path: 'widgets', version: '1' })
export class WidgetsController {
  constructor(private readonly widgetsService: WidgetsService) {}

  @Get()
  @RequireScopes('widgets.read')
  @ApiSecurity('oidc', ['widgets.read'])
  @ApiOperation({
    operationId: 'listWidgets',
    summary: 'List widgets owned by the authenticated subject.',
    description: 'Returns only widgets where subject matches the JWT sub claim.',
  })
  @ApiOkResponse({
    description: 'Widgets owned by the authenticated subject.',
    type: WidgetDto,
    isArray: true,
    example: [WIDGET_EXAMPLE],
  })
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.widgetsService.listForSubject(user.subject)
  }

  @Post()
  @RequireScopes('widgets.write')
  @ApiSecurity('oidc', ['widgets.write'])
  @ApiOperation({
    operationId: 'createWidget',
    summary: 'Create a widget for the authenticated subject.',
    description: 'The subject is always taken from the JWT sub claim.',
  })
  @ApiBody({
    type: CreateWidgetDto,
    examples: {
      createWidget: {
        value: CREATE_WIDGET_EXAMPLE,
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Widget created.',
    type: WidgetDto,
    example: WIDGET_EXAMPLE,
  })
  @ApiBadRequestResponse(PROBLEM_DETAIL_RESPONSE)
  @ApiUnprocessableEntityResponse(UNPROCESSABLE_ENTITY_RESPONSE)
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateWidgetDto) {
    return this.widgetsService.createForSubject(user.subject, dto)
  }

  @Get(':widgetId')
  @RequireScopes('widgets.read')
  @ApiSecurity('oidc', ['widgets.read'])
  @ApiOperation({
    operationId: 'getWidget',
    summary: 'Get a widget owned by the authenticated subject.',
    description: 'Responds with 404 when the widget belongs to another subject.',
  })
  @ApiParam({
    name: 'widgetId',
    description: 'Widget UUID.',
    schema: {
      type: 'string',
      format: 'uuid',
      example: WIDGET_ID_EXAMPLE,
    },
  })
  @ApiOkResponse({
    description: 'Widget details.',
    type: WidgetDto,
    example: WIDGET_EXAMPLE,
  })
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  @ApiNotFoundResponse(ERROR_RESPONSE)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('widgetId') widgetId: string) {
    return this.widgetsService.getForSubject(widgetId, user.subject)
  }

  @Put(':widgetId')
  @RequireScopes('widgets.write')
  @ApiSecurity('oidc', ['widgets.write'])
  @ApiOperation({
    operationId: 'replaceWidget',
    summary: 'Replace a caller-owned widget.',
    description: 'The subject cannot be changed through this endpoint.',
  })
  @ApiParam({
    name: 'widgetId',
    description: 'Widget UUID.',
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
        value: UPDATE_WIDGET_EXAMPLE,
      },
    },
  })
  @ApiOkResponse({
    description: 'Widget replaced.',
    type: WidgetDto,
    example: {
      ...WIDGET_EXAMPLE,
      ...UPDATE_WIDGET_EXAMPLE,
    },
  })
  @ApiBadRequestResponse(PROBLEM_DETAIL_RESPONSE)
  @ApiUnprocessableEntityResponse(UNPROCESSABLE_ENTITY_RESPONSE)
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  @ApiNotFoundResponse(ERROR_RESPONSE)
  replace(
    @CurrentUser() user: AuthenticatedUser,
    @Param('widgetId') widgetId: string,
    @Body() dto: UpdateWidgetDto,
  ) {
    return this.widgetsService.replaceForSubject(widgetId, user.subject, dto)
  }

  @Patch(':widgetId')
  @RequireScopes('widgets.write')
  @ApiSecurity('oidc', ['widgets.write'])
  @ApiOperation({
    operationId: 'updateWidget',
    summary: 'Partially update a widget.',
    description: 'The subject cannot be changed through this endpoint.',
  })
  @ApiParam({
    name: 'widgetId',
    description: 'Widget UUID.',
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
        value: PATCH_WIDGET_EXAMPLE,
      },
    },
  })
  @ApiOkResponse({
    description: 'Widget updated.',
    type: WidgetDto,
    example: {
      ...WIDGET_EXAMPLE,
      ...PATCH_WIDGET_EXAMPLE,
    },
  })
  @ApiBadRequestResponse(PROBLEM_DETAIL_RESPONSE)
  @ApiUnprocessableEntityResponse(UNPROCESSABLE_ENTITY_RESPONSE)
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  @ApiNotFoundResponse(ERROR_RESPONSE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('widgetId') widgetId: string,
    @Body() dto: PatchWidgetDto,
  ) {
    return this.widgetsService.patchForSubject(widgetId, user.subject, dto)
  }

  @Delete(':widgetId')
  @HttpCode(204)
  @RequireScopes('widgets.write')
  @ApiSecurity('oidc', ['widgets.write'])
  @ApiOperation({
    operationId: 'deleteWidget',
    summary: 'Delete a widget owned by the authenticated subject.',
    description: 'Responds with 404 when the widget belongs to another subject.',
  })
  @ApiParam({
    name: 'widgetId',
    description: 'Widget UUID.',
    schema: {
      type: 'string',
      format: 'uuid',
      example: WIDGET_ID_EXAMPLE,
    },
  })
  @ApiNoContentResponse({
    description: 'Widget deleted.',
  })
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  @ApiNotFoundResponse(ERROR_RESPONSE)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('widgetId') widgetId: string) {
    return this.widgetsService.deleteForSubject(widgetId, user.subject)
  }
}

@ApiTags('Admin Widgets')
@ApiSecurity('oidc', ['widgets.admin'])
@UseGuards(JwtAuthGuard, ScopesGuard)
@Controller({ path: 'admin', version: '1' })
export class AdminWidgetsController {
  constructor(private readonly widgetsService: WidgetsService) {}

  @Get('subjects/:subject/widgets')
  @RequireScopes('widgets.admin')
  @ApiSecurity('oidc', ['widgets.admin'])
  @ApiOperation({
    operationId: 'adminListSubjectWidgets',
    summary: 'List widgets for a subject.',
    description: 'Requires widgets.admin and may operate on another subject.',
  })
  @ApiParam({
    name: 'subject',
    description: 'Owner subject identifier.',
    schema: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
      example: SUBJECT_EXAMPLE,
    },
  })
  @ApiOkResponse({
    description: 'Widgets owned by the requested subject.',
    type: WidgetDto,
    isArray: true,
    example: [WIDGET_EXAMPLE],
  })
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  findForSubject(@Param('subject') subject: string) {
    return this.widgetsService.adminListForSubject(subject)
  }

  @Post('subjects/:subject/widgets')
  @RequireScopes('widgets.admin')
  @ApiSecurity('oidc', ['widgets.admin'])
  @ApiOperation({
    operationId: 'adminCreateSubjectWidget',
    summary: 'Create a widget for a subject.',
    description: 'Requires widgets.admin and stores the subject from the path.',
  })
  @ApiParam({
    name: 'subject',
    description: 'Owner subject identifier.',
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
      adminCreateSubjectWidget: {
        value: CREATE_WIDGET_EXAMPLE,
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Widget created.',
    type: WidgetDto,
    example: WIDGET_EXAMPLE,
  })
  @ApiBadRequestResponse(PROBLEM_DETAIL_RESPONSE)
  @ApiUnprocessableEntityResponse(UNPROCESSABLE_ENTITY_RESPONSE)
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  createForSubject(@Param('subject') subject: string, @Body() dto: CreateWidgetDto) {
    return this.widgetsService.adminCreateForSubject(subject, dto)
  }

  @Get('widgets/:widgetId')
  @RequireScopes('widgets.admin')
  @ApiSecurity('oidc', ['widgets.admin'])
  @ApiOperation({
    operationId: 'adminGetWidget',
    summary: 'Get any widget by ID.',
    description: 'Requires widgets.admin and can access widgets across subjects.',
  })
  @ApiParam({
    name: 'widgetId',
    description: 'Widget UUID.',
    schema: {
      type: 'string',
      format: 'uuid',
      example: WIDGET_ID_EXAMPLE,
    },
  })
  @ApiOkResponse({
    description: 'Widget details.',
    type: WidgetDto,
    example: WIDGET_EXAMPLE,
  })
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  @ApiNotFoundResponse(ERROR_RESPONSE)
  findOne(@Param('widgetId') widgetId: string) {
    return this.widgetsService.adminGet(widgetId)
  }

  @Put('widgets/:widgetId')
  @RequireScopes('widgets.admin')
  @ApiSecurity('oidc', ['widgets.admin'])
  @ApiOperation({
    operationId: 'adminReplaceWidget',
    summary: 'Replace any widget by ID.',
    description: 'Requires widgets.admin. Subject transfer is allowed only here.',
  })
  @ApiParam({
    name: 'widgetId',
    description: 'Widget UUID.',
    schema: {
      type: 'string',
      format: 'uuid',
      example: WIDGET_ID_EXAMPLE,
    },
  })
  @ApiBody({
    type: AdminUpdateWidgetDto,
    examples: {
      adminReplaceWidget: {
        value: ADMIN_UPDATE_WIDGET_EXAMPLE,
      },
    },
  })
  @ApiOkResponse({
    description: 'Widget replaced.',
    type: WidgetDto,
    example: {
      ...WIDGET_EXAMPLE,
      ...ADMIN_UPDATE_WIDGET_EXAMPLE,
    },
  })
  @ApiBadRequestResponse(PROBLEM_DETAIL_RESPONSE)
  @ApiUnprocessableEntityResponse(UNPROCESSABLE_ENTITY_RESPONSE)
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  @ApiNotFoundResponse(ERROR_RESPONSE)
  replace(@Param('widgetId') widgetId: string, @Body() dto: AdminUpdateWidgetDto) {
    return this.widgetsService.adminReplace(widgetId, dto)
  }

  @Patch('widgets/:widgetId')
  @RequireScopes('widgets.admin')
  @ApiSecurity('oidc', ['widgets.admin'])
  @ApiOperation({
    operationId: 'adminUpdateWidget',
    summary: 'Partially update any widget by ID.',
    description: 'Requires widgets.admin. Subject transfer is allowed only here.',
  })
  @ApiParam({
    name: 'widgetId',
    description: 'Widget UUID.',
    schema: {
      type: 'string',
      format: 'uuid',
      example: WIDGET_ID_EXAMPLE,
    },
  })
  @ApiBody({
    type: AdminPatchWidgetDto,
    examples: {
      adminUpdateWidget: {
        value: ADMIN_PATCH_WIDGET_EXAMPLE,
      },
    },
  })
  @ApiOkResponse({
    description: 'Widget updated.',
    type: WidgetDto,
    example: {
      ...WIDGET_EXAMPLE,
      ...ADMIN_PATCH_WIDGET_EXAMPLE,
    },
  })
  @ApiBadRequestResponse(PROBLEM_DETAIL_RESPONSE)
  @ApiUnprocessableEntityResponse(UNPROCESSABLE_ENTITY_RESPONSE)
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  @ApiNotFoundResponse(ERROR_RESPONSE)
  update(@Param('widgetId') widgetId: string, @Body() dto: AdminPatchWidgetDto) {
    return this.widgetsService.adminPatch(widgetId, dto)
  }

  @Delete('widgets/:widgetId')
  @HttpCode(204)
  @RequireScopes('widgets.admin')
  @ApiSecurity('oidc', ['widgets.admin'])
  @ApiOperation({
    operationId: 'adminDeleteWidget',
    summary: 'Delete any widget by ID.',
    description: 'Requires widgets.admin and can delete widgets across subjects.',
  })
  @ApiParam({
    name: 'widgetId',
    description: 'Widget UUID.',
    schema: {
      type: 'string',
      format: 'uuid',
      example: WIDGET_ID_EXAMPLE,
    },
  })
  @ApiNoContentResponse({
    description: 'Widget deleted.',
  })
  @ApiUnauthorizedResponse(ERROR_RESPONSE)
  @ApiForbiddenResponse(ERROR_RESPONSE)
  @ApiNotFoundResponse(ERROR_RESPONSE)
  remove(@Param('widgetId') widgetId: string) {
    return this.widgetsService.adminDelete(widgetId)
  }
}
