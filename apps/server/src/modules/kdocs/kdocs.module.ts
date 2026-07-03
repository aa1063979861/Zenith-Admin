import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemParameter } from '../../entities/system-parameter.entity';
import { AuthModule } from '../auth/auth.module';
import { KdocsController } from './kdocs.controller';
import { KdocsService } from './kdocs.service';

@Module({
  imports: [TypeOrmModule.forFeature([SystemParameter]), AuthModule],
  controllers: [KdocsController],
  providers: [KdocsService],
})
export class KdocsModule {}
