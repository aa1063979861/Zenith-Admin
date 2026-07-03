import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateDictionaryItemDto {
  @IsOptional()
  @IsString()
  name?: string;

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
