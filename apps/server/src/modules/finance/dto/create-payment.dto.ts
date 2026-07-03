import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePaymentDto {
  @IsDateString()
  paymentDate: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  clientId?: number;

  @IsString()
  payerName: string;

  @IsOptional()
  @IsString()
  bankAccount?: string;

  @IsOptional()
  @IsString()
  bankRemark?: string;

  @IsOptional()
  @IsString()
  bankSerialNo?: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  remark?: string;
}
