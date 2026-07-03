import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class GenerateCommissionDraftDto {
  @IsDateString()
  periodStart: string;

  @IsDateString()
  periodEnd: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  serviceYear?: number;

  @IsOptional()
  @IsString()
  serviceCode?: string;

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  employeeIds?: number[];
}
