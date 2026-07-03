import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class PaymentInvoiceMatchDto {
  @IsInt()
  @Min(1)
  invoiceId: number;

  @IsNumber()
  @Min(0)
  matchedAmount: number;

  @IsOptional()
  @IsString()
  remark?: string;
}

export class MatchPaymentDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PaymentInvoiceMatchDto)
  matches: PaymentInvoiceMatchDto[];
}
