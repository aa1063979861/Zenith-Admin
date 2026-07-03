import { IsObject } from 'class-validator';
import { TablePreferenceConfig } from '../../../entities/table-default-preference.entity';

export class SaveUserTablePreferenceDto {
  @IsObject()
  settings: TablePreferenceConfig;
}
