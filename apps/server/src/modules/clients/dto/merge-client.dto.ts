import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class MergeClientDto {
  @IsInt()
  @Min(1)
  targetClientId: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
