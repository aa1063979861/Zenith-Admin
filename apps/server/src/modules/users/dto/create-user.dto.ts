import { IsArray, IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
  @IsOptional()
  @IsBoolean()
  enable?: boolean;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  roleIds?: number[];

  @IsString()
  employeeName: string;
}
