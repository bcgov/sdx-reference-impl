import { Module } from '@nestjs/common'
import { BffAuthModule } from '../auth/bff-auth.module'
import { WidgetsController } from './widgets.controller'
import { WidgetsService } from './widgets.service'

@Module({
  imports: [BffAuthModule],
  controllers: [WidgetsController],
  providers: [WidgetsService],
})
export class WidgetsModule {}
