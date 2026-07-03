import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemParameter } from '../../entities/system-parameter.entity';
import { AuthModule } from '../auth/auth.module';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { SystemParametersController } from './system-parameters.controller';
import { SystemParametersService } from './system-parameters.service';

@Module({
  imports: [TypeOrmModule.forFeature([SystemParameter]), forwardRef(() => AuthModule), OperationLogsModule],
  controllers: [SystemParametersController],
  providers: [SystemParametersService],
  exports: [SystemParametersService],
})
export class SystemParametersModule {}
