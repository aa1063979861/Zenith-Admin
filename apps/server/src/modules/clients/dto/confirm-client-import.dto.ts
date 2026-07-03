import { IsArray, IsInt } from 'class-validator';

export class ConfirmClientImportDto {
  @IsArray()
  @IsInt({ each: true })
  rowIds: number[];
}
