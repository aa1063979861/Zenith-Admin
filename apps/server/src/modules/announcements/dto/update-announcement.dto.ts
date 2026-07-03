import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { ANNOUNCEMENT_TYPES } from '../announcement.constants';
import { AnnouncementType } from '../../../entities/announcement.entity';

export class UpdateAnnouncementDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  @IsIn(ANNOUNCEMENT_TYPES)
  type?: AnnouncementType;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  sort?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  publishAt?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  expireAt?: string | null;
}
