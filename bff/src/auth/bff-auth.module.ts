import { Module } from '@nestjs/common'
import { BffAuthController } from './bff-auth.controller'
import { BffSessionGuard } from './bff-session.guard'
import { BffSessionService } from './bff-session.service'

@Module({
  controllers: [BffAuthController],
  providers: [BffSessionGuard, BffSessionService],
  exports: [BffSessionGuard, BffSessionService],
})
export class BffAuthModule {}
