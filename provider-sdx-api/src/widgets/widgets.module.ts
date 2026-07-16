import { Module } from '@nestjs/common'
import { WidgetsController } from './widgets.controller'
import { WidgetsService } from './widgets.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@Module({
  controllers: [WidgetsController],
  providers: [JwtAuthGuard, WidgetsService],
})
export class WidgetsModule {}
