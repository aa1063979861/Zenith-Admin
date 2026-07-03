import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from '../../entities/permission.entity';
import { Role } from '../../entities/role.entity';
import { User } from '../../entities/user.entity';
import { AuthSession } from '../../entities/auth-session.entity';
import { AuthModule } from '../auth/auth.module';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission, User, AuthSession]), AuthModule, OperationLogsModule],
  controllers: [RolesController],
  providers: [RolesService],
})
export class RolesModule {}
