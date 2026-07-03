import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeProfile } from '../../entities/employee-profile.entity';
import { DictionaryItem } from '../../entities/dictionary-item.entity';
import { OrgDepartment } from '../../entities/org-department.entity';
import { Role } from '../../entities/role.entity';
import { User } from '../../entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { SystemParametersModule } from '../system-parameters/system-parameters.module';
import { TeamService } from './team.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, EmployeeProfile, DictionaryItem, OrgDepartment]),
    AuthModule,
    OperationLogsModule,
    forwardRef(() => SystemParametersModule),
  ],
  controllers: [UsersController],
  providers: [UsersService, TeamService],
  exports: [UsersService],
})
export class UsersModule {}
