import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { CONTRACT_STATUSES } from '../../../common/business.constants';
import { FinanceServiceItemLineDto } from './finance-line.dto';

export class CreateContractDto {
  @IsString()
  contractNo: string;

  @IsInt()
  @Min(1)
  clientId: number;

  @IsString()
  title: string;

  @IsNumber()
  @Min(0)
  totalAmount: number;

  @IsOptional()
  @IsDateString()
  signedAt?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsIn(CONTRACT_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FinanceServiceItemLineDto)
  lines: FinanceServiceItemLineDto[];
}
