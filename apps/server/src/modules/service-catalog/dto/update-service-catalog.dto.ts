import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { SERVICE_CATALOG_CATEGORIES } from '../service-catalog.constants';

export class UpdateServiceCatalogDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(SERVICE_CATALOG_CATEGORIES)
  category?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultPrice?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  sort?: number;

  @IsOptional()
  @IsString()
  remark?: string;
}
