import { IsObject } from 'class-validator';
import { TablePreferenceConfig } from '../../../entities/table-default-preference.entity';

export class ResolveTablePreferenceDto {
  @IsObject()
  defaultConfig: TablePreferenceConfig;
}
