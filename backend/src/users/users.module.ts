import { Module } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PrismaModule } from '../prisma.module'
import { UserDirectoryService } from './user-directory.service'
import { UsersController } from './users.controller'

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [JwtAuthGuard, UserDirectoryService],
  exports: [JwtAuthGuard, UserDirectoryService],
})
export class UsersModule {}
