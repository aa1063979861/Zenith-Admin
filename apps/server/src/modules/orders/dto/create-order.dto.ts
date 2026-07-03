import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { SERVICE_ITEM_STATUSES } from '../order.constants';

export class CreateOrderItemDto {
  @IsString()
  serviceCode: string;

  @IsOptional()
  @IsString()
  serviceName?: string;

  @IsInt()
  @Min(1)
  receiverId: number;

  @IsInt()
  @Min(1)
  performerId: number;

  @IsNumber()
  @Min(0)
  allocatedAmount: number;

  @IsNumber()
  @Min(0)
  billableAmount: number;

  @IsOptional()
  @IsDateString()
  serviceStartDate?: string;

  @IsOptional()
  @IsDateString()
  serviceEndDate?: string;

  @IsOptional()
  @IsIn(SERVICE_ITEM_STATUSES)
  status?: string;

  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @IsOptional()
  @IsString()
  reportSummary?: string;

  @IsOptional()
  @IsString()
  problemDescription?: string;

  @IsOptional()
  @IsString()
  proofUrl?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}

export class CreateOrderDto {
  @IsString()
  regionCode: string;

  @IsInt()
  @Min(1)
  clientId: number;

  @IsInt()
  @Min(2000)
  serviceYear: number;

  @IsNumber()
  @Min(0)
  packageAmount: number;

  @IsDateString()
  orderDate: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
