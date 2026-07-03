import { IsBoolean, IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { ARCHIVE_MATERIAL_STATUSES, ARCHIVE_MATERIAL_TYPES } from '../archive.constants';

export class CreateArchiveMaterialDto {
  @IsString()
  title: string;

  @IsString()
  category: string;

  @IsIn(ARCHIVE_MATERIAL_TYPES)
  documentType: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsIn(ARCHIVE_MATERIAL_STATUSES)
  status?: string;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @IsOptional()
  @IsDateString()
  expiredDate?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
