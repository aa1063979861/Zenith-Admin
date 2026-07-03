import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { SystemParameterValueType } from '../../../entities/system-parameter.entity';

export class UpdateSystemParameterDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  paramName?: string;

  @IsOptional()
  @IsIn(['string', 'number', 'boolean', 'password'])
  valueType?: SystemParameterValueType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  paramValue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  groupName?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  sort?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
