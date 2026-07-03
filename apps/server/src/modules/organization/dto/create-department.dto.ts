import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateDepartmentDto {
  @IsOptional()
  @IsInt()
  parentId?: number | null;

  @IsString()
  name: string;

  @IsOptional()
  @IsInt()
  managerUserId?: number | null;

  @IsOptional()
  @IsInt()
  sort?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  remark?: string;
}
