import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class FinanceServiceItemLineDto {
  @IsInt()
  @Min(1)
  orderServiceItemId: number;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;
}
