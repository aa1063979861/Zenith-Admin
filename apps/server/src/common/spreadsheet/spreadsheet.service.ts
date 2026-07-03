import { BadRequestException, Injectable } from '@nestjs/common';
import * as XLSX from '@e965/xlsx';
import * as ExcelJS from 'exceljs';

export type SpreadsheetFile = {
  originalname?: string;
  buffer?: Buffer;
};

export type SpreadsheetSheetRows = {
  sheetName: string;
  rows: string[][];
};

export type ReadSpreadsheetOptions = {
  allowedExtensions?: readonly string[];
  parseErrorMessage?: string;
};

const DEFAULT_ALLOWED_EXTENSIONS = ['.xlsx'];

@Injectable()
export class SpreadsheetService {
  async readSheets(file: SpreadsheetFile, options: ReadSpreadsheetOptions = {}): Promise<SpreadsheetSheetRows[]> {
    const allowedExtensions = options.allowedExtensions || DEFAULT_ALLOWED_EXTENSIONS;
    this.assertReadableFile(file, allowedExtensions);

    return this.fileExtension(file) === '.xls'
      ? this.readLegacyXlsSheets(file.buffer as Buffer, options.parseErrorMessage)
      : this.readXlsxSheets(file.buffer as Buffer, options.parseErrorMessage);
  }

  private assertReadableFile(file: SpreadsheetFile, allowedExtensions: readonly string[]) {
    if (!file?.buffer?.length)
      throw new BadRequestException('请上传 Excel 文件');

    const fileName = file.originalname || '';
    const matchedExtension = allowedExtensions.some(extension => fileName.toLowerCase().endsWith(extension));
    if (!matchedExtension)
      throw new BadRequestException(`只能上传 ${allowedExtensions.join('/')} 格式的 Excel 文件`);
  }

  private fileExtension(file: SpreadsheetFile) {
    const fileName = file.originalname || '';
    const dotIndex = fileName.lastIndexOf('.');
    return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : '';
  }

  private async readXlsxSheets(buffer: Buffer, parseErrorMessage?: string) {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    }
    catch {
      throw new BadRequestException(parseErrorMessage || '无法解析 Excel 文件，请确认文件未损坏且格式正确');
    }

    return workbook.worksheets.map(worksheet => ({
      sheetName: worksheet.name,
      rows: this.readExcelJsRows(worksheet),
    }));
  }

  private readExcelJsRows(worksheet: ExcelJS.Worksheet) {
    const rows: string[][] = [];
    worksheet.eachRow((row) => {
      const values = Array.from({ length: row.cellCount }, (_item, index) => row.getCell(index + 1).value);
      const cleanedValues = values.map(value => this.cleanExcelJsCellText(value));
      if (cleanedValues.some(Boolean))
        rows.push(cleanedValues);
    });
    return rows;
  }

  private readLegacyXlsSheets(buffer: Buffer, parseErrorMessage?: string) {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
      return workbook.SheetNames.map(sheetName => ({
        sheetName,
        rows: this.readSheetJsRows(workbook.Sheets[sheetName]),
      }));
    }
    catch {
      throw new BadRequestException(parseErrorMessage || '无法解析 Excel 文件，请确认文件未损坏且格式正确');
    }
  }

  private readSheetJsRows(worksheet: XLSX.WorkSheet) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: '',
      raw: false,
    });
    return rows
      .map(row => row.map(value => this.cleanCellText(value)))
      .filter(row => row.some(Boolean));
  }

  private cleanCellText(value: unknown) {
    if (value === null || value === undefined)
      return '';
    if (value instanceof Date)
      return value.toISOString().slice(0, 10);
    return String(value).trim();
  }

  private cleanExcelJsCellText(value: ExcelJS.CellValue) {
    if (value === null || value === undefined)
      return '';
    if (value instanceof Date)
      return value.toISOString().slice(0, 10);
    if (typeof value === 'object') {
      if ('result' in value)
        return this.cleanCellText(value.result);
      if ('text' in value)
        return this.cleanCellText(value.text);
      if ('richText' in value && Array.isArray(value.richText))
        return value.richText.map(item => item.text).join('').trim();
    }
    return this.cleanCellText(value);
  }
}
