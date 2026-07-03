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
import { ORDER_STATUSES } from '../order.constants';
import { CreateOrderItemDto } from './create-order.dto';

export class UpdateOrderItemDto extends CreateOrderItemDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  id?: number;
}

export class UpdateOrderDto {
  @IsOptional()
  @IsInt()
  @Min(2000)
  serviceYear?: number;

  @IsOptional()
  @IsDateString()
  orderDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  packageAmount?: number;

  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  cancelReason?: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateOrderItemDto)
  items?: UpdateOrderItemDto[];
}
