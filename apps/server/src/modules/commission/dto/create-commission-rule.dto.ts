import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { CommissionBaseType, CommissionRoleType } from '../../../entities/commission-rule.entity';

const ROLE_TYPES: CommissionRoleType[] = ['receiver', 'performer'];
const BASE_TYPES: CommissionBaseType[] = ['received_amount', 'billable_amount', 'allocated_amount'];

export class CreateCommissionRuleDto {
  @IsString()
  title: string;

  @IsString()
  @IsIn(ROLE_TYPES)
  roleType: CommissionRoleType;

  @IsOptional()
  @IsString()
  serviceCode?: string;

  @IsString()
  @IsIn(BASE_TYPES)
  baseType: CommissionBaseType;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  rate: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fixedAmount: number;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort?: number;
}
