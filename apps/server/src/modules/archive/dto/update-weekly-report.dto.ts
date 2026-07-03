import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { WeeklyDayWorkDto } from './create-weekly-report.dto';

export class UpdateWeeklyReportDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  completedWork?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeeklyDayWorkDto)
  dailyWork?: WeeklyDayWorkDto[];

  @IsOptional()
  @IsString()
  weeklySummary?: string;

  @IsOptional()
  @IsString()
  blockers?: string;

  @IsOptional()
  @IsString()
  nextPlan?: string;
}
