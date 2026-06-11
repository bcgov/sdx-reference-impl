import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma.module'
import { AdminWidgetsController, WidgetsController } from './widgets.controller'
import { WidgetsService } from './widgets.service'

@Module({
  imports: [PrismaModule],
  controllers: [WidgetsController, AdminWidgetsController],
  providers: [WidgetsService],
})
export class WidgetsModule {}
