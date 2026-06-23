import { Controller, Get, UseGuards } from '@nestjs/common'
import {
  ApiForbiddenResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { ErrorResponseDto } from '../widgets/dto/widget.dto'
import { UserSummaryDto } from './dto/user.dto'
import { UserDirectoryService } from './user-directory.service'

@ApiTags('Admin Users')
@ApiExtraModels(UserSummaryDto)
@UseGuards(JwtAuthGuard)
@Controller({ path: 'admin/users', version: '1' })
export class UsersController {
  constructor(private readonly userDirectory: UserDirectoryService) {}

  @Get()
  @ApiSecurity('openId', ['nrs:widgets:admin'])
  @ApiOperation({
    operationId: 'adminListUsersWithWidgets',
    summary: 'List known users that own widgets.',
    description:
      'Returns distinct widget owners with their most recently observed display name and current widget count.',
  })
  @ApiOkResponse({
    description: 'Known users that currently own at least one widget.',
    schema: {
      type: 'array',
      items: { $ref: getSchemaPath(UserSummaryDto) },
      example: [
        {
          subject: 'user-123',
          displayName: 'Alex Smith',
          widgetCount: 3,
          lastSeenAt: '2026-06-11T15:00:00Z',
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  listUsers(): Promise<UserSummaryDto[]> {
    return this.userDirectory.listUsersWithWidgets()
  }
}
