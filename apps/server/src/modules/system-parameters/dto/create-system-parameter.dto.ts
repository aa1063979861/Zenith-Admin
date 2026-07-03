import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { SystemParameterValueType } from '../../../entities/system-parameter.entity';

export class CreateSystemParameterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Matches(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, { message: '参数键必须使用小写字母、数字、下划线和点号，例如：employee.initial_password' })
  paramKey: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  paramName: string;

  @IsIn(['string', 'number', 'boolean', 'password'])
  valueType: SystemParameterValueType;

  @IsString()
  @IsNotEmpty()
  paramValue: string;

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
