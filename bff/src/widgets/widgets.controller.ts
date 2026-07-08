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
  ApiBody,
  ApiCreatedResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import type { Response } from 'express'
import { BffSessionGuard } from '../auth/bff-session.guard'
import { CurrentBffSession } from '../auth/current-bff-session.decorator'
import type { BffSession } from '../auth/auth.types'
import { CreateWidgetDto } from './dto/create-widget.dto'
import { ListWidgetsQueryDto, WidgetListResponseDto } from './dto/list-widgets.dto'
import { PatchWidgetDto, UpdateWidgetDto } from './dto/update-widget.dto'
import { WidgetDto, WIDGET_EXAMPLE } from './dto/widget.dto'
import { WidgetProxyResult, WidgetsService } from './widgets.service'

const WIDGET_ID_EXAMPLE = WIDGET_EXAMPLE.id
const ETAG_EXAMPLE = '"u6I3AI8rSnvR3uOSYVQbPiZF7cP8fIQ77U1zba2tI8A"'
const ETAG_RESPONSE_HEADER = {
  ETag: {
    description: 'Entity tag returned by the provider SDX API.',
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
    'Optional entity tag from a previous GET response. Forwarded to the provider SDX API.',
  schema: {
    type: 'string',
    example: ETAG_EXAMPLE,
  },
}

@ApiTags('BFF Widgets')
@ApiUnauthorizedResponse({ description: 'Login is required.' })
@UseGuards(BffSessionGuard)
@Controller({ path: 'widgets', version: '1' })
export class WidgetsController {
  constructor(private readonly widgetsService: WidgetsService) {}

  @Get()
  @ApiOperation({
    operationId: 'listWidgets',
    summary: 'List Widgets for the signed-in user through the BFF.',
  })
  @ApiOkResponse({
    description: 'The list of Widgets owned by the signed-in user.',
    type: WidgetListResponseDto,
  })
  async findAll(
    @CurrentBffSession() session: BffSession,
    @Query() query: ListWidgetsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.send(
      response,
      await this.widgetsService.list(session, query as Record<string, unknown>),
    )
  }

  @Post()
  @ApiOperation({
    operationId: 'createWidget',
    summary: 'Create a Widget for the signed-in user through the BFF.',
  })
  @ApiBody({ type: CreateWidgetDto })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Optional client-generated key forwarded to the provider SDX API.',
    schema: {
      type: 'string',
      minLength: 8,
      maxLength: 255,
      example: 'req-12345678',
    },
  })
  @ApiCreatedResponse({
    description: 'The created Widget.',
    type: WidgetDto,
    headers: ETAG_RESPONSE_HEADER,
  })
  async create(
    @CurrentBffSession() session: BffSession,
    @Body() dto: CreateWidgetDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.send(response, await this.widgetsService.create(session, dto, idempotencyKey))
  }

  @Get(':widgetId')
  @ApiOperation({
    operationId: 'getWidget',
    summary: 'Get a Widget for the signed-in user through the BFF.',
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
    headers: ETAG_RESPONSE_HEADER,
  })
  async findOne(
    @CurrentBffSession() session: BffSession,
    @Param('widgetId') widgetId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.send(response, await this.widgetsService.get(session, widgetId))
  }

  @Put(':widgetId')
  @ApiOperation({
    operationId: 'replaceWidget',
    summary: 'Replace a Widget for the signed-in user through the BFF.',
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
  @ApiBody({ type: UpdateWidgetDto })
  @ApiHeader(IF_MATCH_HEADER)
  @ApiOkResponse({
    description: 'The replaced Widget.',
    type: WidgetDto,
    headers: ETAG_RESPONSE_HEADER,
  })
  async replace(
    @CurrentBffSession() session: BffSession,
    @Param('widgetId') widgetId: string,
    @Body() dto: UpdateWidgetDto,
    @Headers('if-match') ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.send(response, await this.widgetsService.replace(session, widgetId, dto, ifMatch))
  }

  @Patch(':widgetId')
  @ApiOperation({
    operationId: 'updateWidget',
    summary: 'Partially update a Widget for the signed-in user through the BFF.',
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
  @ApiBody({ type: PatchWidgetDto })
  @ApiHeader(IF_MATCH_HEADER)
  @ApiOkResponse({
    description: 'The partially updated Widget.',
    type: WidgetDto,
    headers: ETAG_RESPONSE_HEADER,
  })
  async update(
    @CurrentBffSession() session: BffSession,
    @Param('widgetId') widgetId: string,
    @Body() dto: PatchWidgetDto,
    @Headers('if-match') ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.send(response, await this.widgetsService.update(session, widgetId, dto, ifMatch))
  }

  @Delete(':widgetId')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'deleteWidget',
    summary: 'Delete a Widget for the signed-in user through the BFF.',
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
  @ApiHeader(IF_MATCH_HEADER)
  @ApiNoContentResponse({ description: 'The Widget was deleted.' })
  async remove(
    @CurrentBffSession() session: BffSession,
    @Param('widgetId') widgetId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.send(response, await this.widgetsService.delete(session, widgetId, ifMatch))
  }

  private send(response: Response, result: WidgetProxyResult): unknown {
    response.status(result.status)
    if (result.etag) {
      response.setHeader('ETag', result.etag)
    }
    return result.body
  }
}
