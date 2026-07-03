import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ArchiveLinkDto } from './archive-link.dto';

export class CreateArchiveAttachmentDto {
  @IsString()
  tag: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ArchiveLinkDto)
  links: ArchiveLinkDto[];
}
