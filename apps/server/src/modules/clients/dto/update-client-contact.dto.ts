import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { CLIENT_CONTACT_ROLES } from '../../../common/business.constants';

export class UpdateClientContactDto {
  @IsOptional()
  @IsIn(CLIENT_CONTACT_ROLES)
  role?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsString()
  remark?: string;
}
