import { IsOptional, IsString } from 'class-validator';

export class UpdateCredentialDto {
  @IsOptional()
  @IsString()
  systemName?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  loginUrl?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}
