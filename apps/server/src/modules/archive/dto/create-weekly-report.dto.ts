import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsOptional, IsString, ValidateNested } from 'class-validator';

export class WeeklyDayWorkDto {
  @IsString()
  date: string;

  @IsString()
  weekday: string;

  @IsOptional()
  @IsString()
  content?: string;
}

export class CreateWeeklyReportDto {
  @IsDateString()
  weekStart: string;

  @IsDateString()
  weekEnd: string;

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
