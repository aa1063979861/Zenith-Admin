import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { INVOICE_DELIVERY_STATUSES, INVOICE_STATUSES } from '../../../common/business.constants';
import { FinanceServiceItemLineDto } from './finance-line.dto';

export class CreateInvoiceDto {
  @IsString()
  invoiceNo: string;

  @IsInt()
  @Min(1)
  clientId: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  contractId?: number;

  @IsOptional()
  @IsString()
  buyerName?: string;

  @IsDateString()
  invoiceDate: string;

  @IsNumber()
  @Min(0)
  invoiceAmount: number;

  @IsOptional()
  @IsIn(INVOICE_DELIVERY_STATUSES)
  deliveryStatus?: string;

  @IsOptional()
  @IsIn(INVOICE_STATUSES)
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
