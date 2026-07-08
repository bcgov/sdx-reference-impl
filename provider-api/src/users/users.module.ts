import { Module } from '@nestjs/common'
import { ProviderServiceAuthGuard } from '../auth/provider-service-auth.guard'
import { PrismaModule } from '../prisma.module'
import { UserDirectoryService } from './user-directory.service'
import { UsersController } from './users.controller'

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [ProviderServiceAuthGuard, UserDirectoryService],
  exports: [ProviderServiceAuthGuard, UserDirectoryService],
})
export class UsersModule {}
