import { IsBoolean, IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { PermissionType } from '../../../entities/permission.entity';

export class CreatePermissionDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsIn(['MENU', 'BUTTON'])
  type: PermissionType;

  @IsOptional()
  @IsInt()
  parentId?: number | null;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsString()
  component?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  layout?: string;

  @IsOptional()
  @IsString()
  activeMenuCode?: string | null;

  @IsOptional()
  @IsBoolean()
  show?: boolean;

  @IsOptional()
  @IsBoolean()
  enable?: boolean;

  @IsOptional()
  @IsBoolean()
  keepAlive?: boolean;

  @IsOptional()
  @IsInt()
  order?: number;
}
