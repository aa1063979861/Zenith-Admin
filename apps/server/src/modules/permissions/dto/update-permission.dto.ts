import { IsBoolean, IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { PermissionType } from '../../../entities/permission.entity';

export class UpdatePermissionDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['MENU', 'BUTTON'])
  type?: PermissionType;

  @IsOptional()
  @IsInt()
  parentId?: number | null;

  @IsOptional()
  @IsString()
  path?: string | null;

  @IsOptional()
  @IsString()
  component?: string | null;

  @IsOptional()
  @IsString()
  icon?: string | null;

  @IsOptional()
  @IsString()
  layout?: string | null;

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
