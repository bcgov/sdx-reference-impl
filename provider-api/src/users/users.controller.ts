import { Controller, Get, UseGuards } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiExtraModels,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'
import { ErrorResponseDto } from '../widgets/dto/widget.dto'
import { ProviderServiceAuthGuard } from '../auth/provider-service-auth.guard'
import { UserSummaryDto } from './dto/user.dto'
import { UserDirectoryService } from './user-directory.service'

@ApiTags('Provider Users')
@ApiBearerAuth('serviceBearer')
@ApiHeader({
  name: 'x-on-behalf-of-sub',
  required: false,
  description:
    'Original user subject represented by a provider-sdx-api client token. Required when the bearer token is a client token; omit for user tokens.',
  schema: {
    type: 'string',
    example: 'user-123',
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
@ApiExtraModels(UserSummaryDto)
@UseGuards(ProviderServiceAuthGuard)
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly userDirectory: UserDirectoryService) {}

  @Get()
  @ApiOperation({
    operationId: 'providerListUsersWithWidgets',
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
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  listUsers(): Promise<UserSummaryDto[]> {
    return this.userDirectory.listUsersWithWidgets()
  }
}
