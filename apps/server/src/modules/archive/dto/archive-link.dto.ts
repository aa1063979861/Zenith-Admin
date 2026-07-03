import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ARCHIVE_ENTITY_TYPES } from '../archive.constants';

export class ArchiveLinkDto {
  @IsIn(ARCHIVE_ENTITY_TYPES)
  entityType: string;

  @IsInt()
  @Min(1)
  entityId: number;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}
