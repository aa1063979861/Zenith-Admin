import { IsOptional, IsString } from 'class-validator';

export class CreateCredentialDto {
  @IsString()
  systemName: string;

  @IsString()
  username: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  loginUrl?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}
