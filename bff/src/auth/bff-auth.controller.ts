import { Controller, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common'
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { BffSessionService } from './bff-session.service'

@ApiTags('BFF Auth')
@Controller({ path: 'auth' })
export class BffAuthController {
  constructor(private readonly sessions: BffSessionService) {}

  @Get('login')
  @ApiOperation({
    operationId: 'beginLogin',
    summary: 'Start BFF Authorization Code with PKCE login.',
  })
  beginLogin(
    @Req() request: Request,
    @Res() response: Response,
    @Query('returnTo') returnTo?: string,
  ): Promise<void> {
    return this.sessions.beginLogin(request, response, returnTo)
  }

  @Get('callback')
  @ApiOperation({
    operationId: 'completeLogin',
    summary: 'Complete BFF Authorization Code with PKCE login.',
  })
  completeLogin(@Req() request: Request, @Res() response: Response): Promise<void> {
    return this.sessions.completeLogin(request, response)
  }

  @Get('session')
  @ApiOperation({
    operationId: 'getSession',
    summary: 'Return the current BFF session user.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        authenticated: true,
        user: {
          displayName: 'Alex Smith',
          subjectId: 'user-123',
        },
      },
    },
  })
  getSession(@Req() request: Request) {
    const session = this.sessions.getSession(request)
    return session
      ? {
          authenticated: true,
          user: session.user,
        }
      : {
          authenticated: false,
          user: null,
        }
  }

  @Post('logout')
  @HttpCode(204)
  @ApiCookieAuth('bff_session')
  @ApiOperation({
    operationId: 'logout',
    summary: 'End the current BFF session.',
  })
  @ApiUnauthorizedResponse()
  logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): void {
    this.sessions.endSession(request, response)
  }
}
