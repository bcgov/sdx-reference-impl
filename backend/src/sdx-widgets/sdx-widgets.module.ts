import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma.module'
import { AdminSdxWidgetsController, SdxWidgetsController } from './sdx-widgets.controller'
import { SdxWidgetsService } from './sdx-widgets.service'

@Module({
  imports: [PrismaModule],
  controllers: [SdxWidgetsController, AdminSdxWidgetsController],
  providers: [SdxWidgetsService],
})
export class SdxWidgetsModule {}
