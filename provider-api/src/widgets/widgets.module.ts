import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma.module'
import { ProviderWidgetsController } from './widgets.controller'
import { WidgetsService } from './widgets.service'
import { ProviderServiceAuthGuard } from '../auth/provider-service-auth.guard'
import { UserDirectoryService } from '../users/user-directory.service'

@Module({
  imports: [PrismaModule],
  controllers: [ProviderWidgetsController],
  providers: [ProviderServiceAuthGuard, UserDirectoryService, WidgetsService],
})
export class WidgetsModule {}
