import { IsArray, IsBoolean, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MaxLength(80, { message: '角色名称不能超过80个字符' })
  name: string;

  @IsOptional()
  @IsBoolean()
  enable?: boolean;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  permissionIds?: number[];
}
