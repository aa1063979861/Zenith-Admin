import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TableDefaultPreference } from '../../entities/table-default-preference.entity';
import { UserTablePreference } from '../../entities/user-table-preference.entity';
import { AuthModule } from '../auth/auth.module';
import { TablePreferencesController } from './table-preferences.controller';
import { TablePreferencesService } from './table-preferences.service';

@Module({
  imports: [TypeOrmModule.forFeature([TableDefaultPreference, UserTablePreference]), AuthModule],
  controllers: [TablePreferencesController],
  providers: [TablePreferencesService],
})
export class TablePreferencesModule {}
