import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperationLog } from '../../entities/operation-log.entity';
import { AuthModule } from '../auth/auth.module';
import { OperationLogsController } from './operation-logs.controller';
import { OperationLogsService } from './operation-logs.service';

@Module({
  imports: [TypeOrmModule.forFeature([OperationLog]), forwardRef(() => AuthModule)],
  controllers: [OperationLogsController],
  providers: [OperationLogsService],
  exports: [OperationLogsService],
})
export class OperationLogsModule {}
