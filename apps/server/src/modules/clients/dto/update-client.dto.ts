import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { CLIENT_UNIT_STATUSES, CUSTOMER_LEVELS } from '../../../common/business.constants';

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  regionCode?: string;

  @IsOptional()
  @Matches(/^\d{6}$/)
  unitCode?: string;

  @IsOptional()
  @IsString()
  unitName?: string;

  @IsOptional()
  @IsIn(CLIENT_UNIT_STATUSES)
  unitStatus?: string;

  @IsOptional()
  @IsIn(CUSTOMER_LEVELS)
  customerLevel?: string;

  @IsOptional()
  @IsString()
  unifiedSocialCreditCode?: string;

  @IsOptional()
  @IsString()
  legalPerson?: string;

  @IsOptional()
  @IsString()
  financeStaff?: string;

  @IsOptional()
  @IsString()
  financeManager?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}
