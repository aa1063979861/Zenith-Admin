import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { IMPORT_CONFIRM_ACTIONS } from '../../../common/business.constants';

export class ConfirmPaymentImportRowDto {
  @IsInt()
  @Min(1)
  rowId: number;

  @IsOptional()
  @IsIn(IMPORT_CONFIRM_ACTIONS)
  action?: 'import' | 'skip';

  @IsOptional()
  @IsInt()
  @Min(1)
  clientId?: number;

  @IsOptional()
  @IsString()
  remark?: string;
}

export class ConfirmPaymentImportDto {
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  rowIds?: number[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmPaymentImportRowDto)
  rows?: ConfirmPaymentImportRowDto[];
}
