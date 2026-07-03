import { IsBoolean, IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { DictionaryType } from '../../../entities/dictionary-item.entity';

export class CreateDictionaryItemDto {
  @IsString()
  @IsIn(['region', 'position'], { message: '字典类型仅支持区划、职位' })
  dictionaryType: DictionaryType;

  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  sort?: number;

  @IsOptional()
  @IsString()
  remark?: string;
}
