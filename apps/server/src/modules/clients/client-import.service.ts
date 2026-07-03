import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { IMPORT_BATCH_STATUS, IMPORT_ROW_STATUS, IMPORT_ROW_STATUSES, ImportRowStatus } from '../../common/business.constants';
import { normalizePage, pageResult } from '../../common/page';
import { SpreadsheetService, SpreadsheetSheetRows } from '../../common/spreadsheet/spreadsheet.service';
import { normalizeUploadFileName } from '../../common/upload-file-name';
import { Client } from '../../entities/client.entity';
import { DictionaryItem } from '../../entities/dictionary-item.entity';
import { ImportBatch, ImportSourceType } from '../../entities/import-batch.entity';
import { ImportRow } from '../../entities/import-row.entity';
import { ServiceCatalog } from '../../entities/service-catalog.entity';
import { User } from '../../entities/user.entity';
import { createDictionaryItemCode } from '../dictionaries/dictionary-code';
import { ConfirmClientImportDto } from './dto/confirm-client-import.dto';

type NormalizedClientImportRow = {
  regionCode: string;
  regionName: string;
  unitCode: string;
  unitName: string;
  unifiedSocialCreditCode: string | null;
  legalPerson: string | null;
  financeStaff: string | null;
  financeManager: string | null;
  address: string | null;
  contactPhone: string | null;
  remark: string | null;
};

type ClientImportValidation = {
  status: ImportRowStatus;
  messages: string[];
  normalized: NormalizedClientImportRow | null;
};

type LegacyBusinessSourceType = Exclude<ImportSourceType, 'client_unit_directory'>;

type LegacyCredentialRow = {
  systemName: string;
  username: string;
  password: string | null;
};

type NormalizedLegacyBusinessImportRow = {
  sourceType: LegacyBusinessSourceType;
  clientId: number | null;
  regionCode: string | null;
  regionName: string | null;
  unitCode: string;
  unitName: string;
  canonicalUnitName: string | null;
  nameChanged: boolean;
  clientExists: boolean;
  contactName: string | null;
  contactPhone: string | null;
  otherContact: string | null;
  serviceProject: string;
  serviceNames: string[];
  splitRequired: boolean;
  receiverName: string | null;
  receiverId: number | null;
  performerName: string | null;
  performerId: number | null;
  serviceYear: number | null;
  orderDate: string | null;
  serviceStartDate: string | null;
  serviceEndDate: string | null;
  packageAmount: string | null;
  billableAmount: string | null;
  invoiceAmount: string | null;
  receivedAmount: string | null;
  paymentDate: string | null;
  contractStatus: string | null;
  invoiceStatus: string | null;
  paymentStatus: string | null;
  progressNote: string | null;
  financeReference: Record<string, string | number | null> | null;
  credentials: LegacyCredentialRow[];
};

type LegacyBusinessImportValidation = {
  status: ImportRowStatus;
  messages: string[];
  normalized: NormalizedLegacyBusinessImportRow | null;
};

type ImportBatchDetailQuery = {
  pageNo?: number;
  pageSize?: number;
  validationStatus?: string | null;
};

type ParsedClientUnitDirectoryRow = {
  sheetName: string;
  rowNo: number;
  raw: Record<string, unknown>;
};

type ClientUnitDirectoryFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

type ImportValidationContext = {
  existingClientKeys: Set<string>;
  existingClientByUnitName: Map<string, ExistingClientIdentity | null>;
  existingClientsByRegionUnitCode: Map<string, ExistingClientIdentity[]>;
  regions: DictionaryItem[];
  services: ServiceCatalog[];
  employees: User[];
};

type ExistingClientIdentity = {
  id: number;
  regionCode: string;
  unitCode: string;
  unitName: string;
  source?: string | null;
  remark?: string | null;
};

const CLIENT_UNIT_DIRECTORY_HEADERS = [
  '*单位代码',
  '*单位名称',
  '*单位所在地区',
  '*统一社会信用代码',
  '*单位地址',
  '*法人',
  '*财务人员',
  '*联系电话',
];

const IMPORTABLE_CLIENT_ROW_STATUSES: readonly ImportRowStatus[] = [IMPORT_ROW_STATUS.VALID, IMPORT_ROW_STATUS.WARNING];
const LOCKED_CLIENT_ROW_STATUSES: readonly ImportRowStatus[] = [IMPORT_ROW_STATUS.IMPORTED, IMPORT_ROW_STATUS.SKIPPED];

const IMPORT_SOURCE_TYPES: readonly ImportSourceType[] = [
  'client_unit_directory',
  'asset_report_control',
  'integration_value_added',
];

const LEGACY_SERVICE_SPLIT_SUGGESTIONS = new Map<string, string[]>([
  ['财报内控', ['财报', '内控']],
  ['资产财报内控', ['资产', '财报', '内控']],
  ['决算财报内控', ['决算', '财报', '内控']],
  ['决算资产财报内控', ['决算', '资产', '财报', '内控']],
]);
const LEGACY_SPLIT_SERVICE_NAMES = ['决算', '资产', '财报', '内控'];

@Injectable()
export class ClientImportService {
  constructor(
    @InjectRepository(Client) private readonly clientRepository: Repository<Client>,
    @InjectRepository(DictionaryItem) private readonly dictionaryRepository: Repository<DictionaryItem>,
    @InjectRepository(ImportBatch) private readonly importBatchRepository: Repository<ImportBatch>,
    @InjectRepository(ImportRow) private readonly importRowRepository: Repository<ImportRow>,
    @InjectRepository(ServiceCatalog) private readonly serviceCatalogRepository: Repository<ServiceCatalog>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly spreadsheetService: SpreadsheetService,
  ) {}

  async importUnitDirectory(file: ClientUnitDirectoryFile, user: User) {
    const parsedRows = await this.parseClientUnitDirectoryFile(file);
    if (!parsedRows.length)
      throw new BadRequestException('未读取到可导入的单位数据');

    const batch = await this.importBatchRepository.save(this.importBatchRepository.create({
      sourceFileName: normalizeUploadFileName(file.originalname),
      sourceType: 'client_unit_directory',
      importedBy: user.id,
      importedByName: this.resolveUserDisplayName(user),
      importedAt: new Date(),
      status: IMPORT_BATCH_STATUS.PARSED,
      totalRows: parsedRows.length,
      validRows: 0,
      warningRows: 0,
      errorRows: 0,
      importedRows: 0,
      remark: '单位基础客户库导入',
    }));

    const existingKeys = await this.loadExistingClientKeys();
    const seenKeys = new Set<string>();
    const rows: ImportRow[] = [];

    for (const parsedRow of parsedRows) {
      const validation = await this.validateClientUnitDirectoryRow(parsedRow.raw, existingKeys, seenKeys);
      const importRow = this.importRowRepository.create({
        batchId: batch.id,
        sheetName: parsedRow.sheetName,
        rowNo: parsedRow.rowNo,
        rawJson: parsedRow.raw,
        normalizedJson: validation.normalized,
        validationStatus: validation.status,
        validationMessage: validation.messages.join('；') || null,
      });
      rows.push(importRow);

      if (validation.normalized)
        seenKeys.add(this.clientUniqueKey(validation.normalized.regionCode, validation.normalized.unitCode));
    }

    const savedRows = await this.importRowRepository.save(rows);
    await this.refreshImportBatchSummary(batch.id);
    return this.importBatchDetail(batch.id, savedRows);
  }

  async importAssetReportControl(file: ClientUnitDirectoryFile, user: User) {
    return this.importLegacyBusinessFile(file, user, 'asset_report_control');
  }

  async importIntegrationValueAdded(file: ClientUnitDirectoryFile, user: User) {
    return this.importLegacyBusinessFile(file, user, 'integration_value_added');
  }

  async importBatches(query: { pageNo?: number; pageSize?: number; sourceType?: string }) {
    const { pageSize, skip } = normalizePage(query);
    const sourceType = query.sourceType ? this.ensureImportSourceType(query.sourceType) : undefined;
    const [batches, total] = await this.importBatchRepository.findAndCount({
      where: sourceType ? { sourceType } : {},
      order: { id: 'DESC' },
      skip,
      take: pageSize,
    });
    return pageResult(await this.toImportBatchDtoList(batches), total);
  }

  async importBatchDetail(batchId: number, rows?: ImportRow[], query: ImportBatchDetailQuery = {}) {
    const batch = await this.importBatchRepository.findOne({ where: { id: batchId } });
    if (!batch)
      throw new NotFoundException('导入批次不存在');
    const { pageSize, skip } = normalizePage(query);
    const validationStatus = this.normalizeImportRowStatus(query.validationStatus);
    let importRows: ImportRow[];
    let rowTotal: number;
    if (rows) {
      const filteredRows = validationStatus
        ? rows.filter(row => row.validationStatus === validationStatus)
        : rows;
      rowTotal = filteredRows.length;
      importRows = filteredRows.slice(skip, skip + pageSize);
    }
    else {
      const where = validationStatus ? { batchId, validationStatus } : { batchId };
      [importRows, rowTotal] = await this.importRowRepository.findAndCount({
        where,
        order: { rowNo: 'ASC', id: 'ASC' },
        skip,
        take: pageSize,
      });
    }
    const batchDto = await this.loadImportBatchDto(batch);
    return {
      ...batchDto,
      rows: importRows.map(row => this.toImportRowDto(row)),
      rowTotal,
    };
  }

  async importableImportRowIds(batchId: number) {
    const batch = await this.importBatchRepository.findOne({ where: { id: batchId } });
    if (!batch)
      throw new NotFoundException('导入批次不存在');
    if (batch.sourceType !== 'client_unit_directory')
      throw new BadRequestException('旧业务表当前只支持预览校验，不能直接确认入库');

    const rows = await this.importRowRepository.find({
      select: ['id'],
      where: {
        batchId,
        validationStatus: In([...IMPORTABLE_CLIENT_ROW_STATUSES]),
      },
      order: { rowNo: 'ASC', id: 'ASC' },
    });
    return rows.map(row => row.id);
  }

  async revalidateImportBatch(batchId: number) {
    const batch = await this.importBatchRepository.findOne({ where: { id: batchId } });
    if (!batch)
      throw new NotFoundException('导入批次不存在');
    if (batch.status === IMPORT_BATCH_STATUS.CONFIRMED)
      throw new BadRequestException('已确认入库的批次不能重新校验');

    const rows = await this.importRowRepository.find({ where: { batchId }, order: { rowNo: 'ASC' } });
    const context = await this.loadImportValidationContext();
    const seenKeys = new Set<string>();

    for (const row of rows) {
      if (LOCKED_CLIENT_ROW_STATUSES.includes(row.validationStatus))
        continue;

      const validation = await this.validateImportRow(batch.sourceType, row.rawJson, context, seenKeys);
      row.normalizedJson = validation.normalized;
      row.validationStatus = validation.status;
      row.validationMessage = validation.messages.join('；') || null;
      row.clientId = batch.sourceType === 'client_unit_directory'
        ? row.clientId
        : (validation.normalized as NormalizedLegacyBusinessImportRow | null)?.clientId || null;
      await this.importRowRepository.save(row);

      if (batch.sourceType === 'client_unit_directory' && validation.normalized) {
        const normalized = validation.normalized as NormalizedClientImportRow;
        seenKeys.add(this.clientUniqueKey(normalized.regionCode, normalized.unitCode));
      }
    }

    batch.status = IMPORT_BATCH_STATUS.PARSED;
    await this.importBatchRepository.save(batch);
    await this.refreshImportBatchSummary(batchId);
    return this.importBatchDetail(batchId);
  }

  async confirmImportBatch(batchId: number, dto: ConfirmClientImportDto) {
    const batch = await this.importBatchRepository.findOne({ where: { id: batchId } });
    if (!batch)
      throw new NotFoundException('导入批次不存在');
    if (batch.sourceType !== 'client_unit_directory')
      throw new BadRequestException('该批次不是单位基础客户库导入');
    if (batch.status === IMPORT_BATCH_STATUS.CONFIRMED)
      throw new BadRequestException('该导入批次已确认入库');
    if (!dto.rowIds.length)
      throw new BadRequestException('请选择需要确认入库的行');

    // 确认入库前使用当前客户库和区划字典重校验，避免预览后基础资料变化导致脏数据入库。
    await this.revalidateImportBatch(batchId);

    const result = await this.dataSource.transaction(async (manager) => {
      const clientRepository = manager.getRepository(Client);
      const importRowRepository = manager.getRepository(ImportRow);
      const importBatchRepository = manager.getRepository(ImportBatch);
      const rows = await importRowRepository.find({
        where: { id: In(dto.rowIds), batchId },
        order: { rowNo: 'ASC' },
      });
      if (rows.length !== dto.rowIds.length)
        throw new BadRequestException('存在不属于当前批次的导入行');

      const invalidRows = rows.filter(row => !IMPORTABLE_CLIENT_ROW_STATUSES.includes(row.validationStatus));
      if (invalidRows.length)
        throw new BadRequestException(`第 ${invalidRows.map(row => row.rowNo).join('、')} 行未通过校验，不能入库`);

      const existingClientsByKey = await this.loadExistingClientKeyMap(clientRepository);
      let created = 0;
      let skipped = 0;
      for (const row of rows) {
        const normalized = row.normalizedJson as NormalizedClientImportRow | null;
        if (!normalized) {
          row.validationStatus = IMPORT_ROW_STATUS.ERROR;
          row.validationMessage = '标准化客户数据为空';
          await importRowRepository.save(row);
          continue;
        }

        const clientKey = this.clientUniqueKey(normalized.regionCode, normalized.unitCode);
        const exists = existingClientsByKey.get(clientKey);
        if (exists) {
          row.clientId = exists.id;
          row.validationStatus = IMPORT_ROW_STATUS.SKIPPED;
          row.validationMessage = '该区划下单位编码已存在，已跳过入库';
          skipped += 1;
          await importRowRepository.save(row);
          continue;
        }

        // 导入确认时再次查询正式客户，避免预览后用户手工新增导致重复入库。
        const client = await clientRepository.save(clientRepository.create({
          regionCode: normalized.regionCode,
          regionName: normalized.regionName,
          unitCode: normalized.unitCode,
          unitName: normalized.unitName,
          unifiedSocialCreditCode: normalized.unifiedSocialCreditCode,
          legalPerson: normalized.legalPerson,
          financeStaff: normalized.financeStaff,
          financeManager: normalized.financeManager,
          address: normalized.address,
          contactPhone: normalized.contactPhone,
          remark: normalized.remark,
          source: 'import',
        }));
        row.clientId = client.id;
        row.validationStatus = IMPORT_ROW_STATUS.IMPORTED;
        row.validationMessage = '已确认入库';
        existingClientsByKey.set(clientKey, { id: client.id });
        created += 1;
        await importRowRepository.save(row);
      }

      const refreshedBatch = await importBatchRepository.findOne({ where: { id: batchId } });
      if (refreshedBatch) {
        const [totalRows, validRows, warningRows, errorRows, importedRows] = await Promise.all([
          importRowRepository.count({ where: { batchId } }),
          importRowRepository.count({ where: { batchId, validationStatus: IMPORT_ROW_STATUS.VALID } }),
          importRowRepository.count({ where: { batchId, validationStatus: IMPORT_ROW_STATUS.WARNING } }),
          importRowRepository.count({ where: { batchId, validationStatus: IMPORT_ROW_STATUS.ERROR } }),
          importRowRepository.count({ where: { batchId, validationStatus: IMPORT_ROW_STATUS.IMPORTED } }),
        ]);
        refreshedBatch.totalRows = totalRows;
        refreshedBatch.validRows = validRows;
        refreshedBatch.warningRows = warningRows;
        refreshedBatch.errorRows = errorRows;
        refreshedBatch.importedRows = importedRows;
        refreshedBatch.status = validRows || warningRows
          ? IMPORT_BATCH_STATUS.PARSED
          : IMPORT_BATCH_STATUS.CONFIRMED;
        await importBatchRepository.save(refreshedBatch);
      }

      return { created, skipped };
    });
    return {
      ...result,
      batch: await this.importBatchDetail(batchId),
    };
  }

  async removeImportBatch(batchId: number) {
    const batch = await this.importBatchRepository.findOne({ where: { id: batchId } });
    if (!batch)
      throw new NotFoundException('导入批次不存在');
    if (batch.status === IMPORT_BATCH_STATUS.CONFIRMED)
      throw new BadRequestException('已确认入库的导入批次不能删除');

    const lockedRowCount = await this.importRowRepository.count({
      where: {
        batchId,
        validationStatus: In([...LOCKED_CLIENT_ROW_STATUSES]),
      },
    });
    if (lockedRowCount > 0)
      throw new BadRequestException('该导入批次已有入库或跳过记录，不能删除');

    // 删除未确认批次时同步删除明细，避免留下无主暂存数据。
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(ImportRow, { batchId });
      await manager.delete(ImportBatch, { id: batchId });
    });
    return true;
  }

  private async importLegacyBusinessFile(file: ClientUnitDirectoryFile, user: User, sourceType: LegacyBusinessSourceType) {
    const parsedRows = await this.parseLegacyBusinessFile(file, sourceType);
    if (!parsedRows.length)
      throw new BadRequestException('未读取到可预览的旧业务数据');

    const context = await this.loadImportValidationContext();

    const result = await this.dataSource.transaction(async (manager) => {
      const batch = await manager.save(ImportBatch, manager.create(ImportBatch, {
        sourceFileName: normalizeUploadFileName(file.originalname),
        sourceType,
        importedBy: user.id,
        importedByName: this.resolveUserDisplayName(user),
        importedAt: new Date(),
        status: IMPORT_BATCH_STATUS.PARSED,
        totalRows: parsedRows.length,
        validRows: 0,
        warningRows: 0,
        errorRows: 0,
        importedRows: 0,
        remark: this.getImportSourceRemark(sourceType),
      }));

      const rows: ImportRow[] = [];
      for (const parsedRow of parsedRows) {
        const validation = await this.validateLegacyBusinessRow(sourceType, parsedRow.raw, context);
        rows.push(manager.create(ImportRow, {
          batchId: batch.id,
          sheetName: parsedRow.sheetName,
          rowNo: parsedRow.rowNo,
          rawJson: parsedRow.raw,
          normalizedJson: validation.normalized,
          validationStatus: validation.status,
          validationMessage: validation.messages.join('；') || null,
        }));
      }

      const savedRows = await manager.save(ImportRow, rows);
      batch.totalRows = savedRows.length;
      batch.validRows = savedRows.filter(row => row.validationStatus === IMPORT_ROW_STATUS.VALID).length;
      batch.warningRows = savedRows.filter(row => row.validationStatus === IMPORT_ROW_STATUS.WARNING).length;
      batch.errorRows = savedRows.filter(row => row.validationStatus === IMPORT_ROW_STATUS.ERROR).length;
      batch.importedRows = 0;
      await manager.save(ImportBatch, batch);
      return { batchId: batch.id, rows: savedRows };
    });
    return this.importBatchDetail(result.batchId, result.rows);
  }

  private async parseLegacyBusinessFile(file: ClientUnitDirectoryFile, sourceType: LegacyBusinessSourceType) {
    const sheets = await this.spreadsheetService.readSheets(file, {
      allowedExtensions: ['.xls', '.xlsx'],
      parseErrorMessage: '无法解析 Excel 文件，请确认文件未损坏且为正确的旧业务表',
    });
    if (sourceType === 'asset_report_control')
      return this.parseAssetReportControlSheets(sheets);
    return this.parseIntegrationValueAddedSheets(sheets);
  }

  private parseAssetReportControlSheets(sheets: SpreadsheetSheetRows[]) {
    const parsedRows: ParsedClientUnitDirectoryRow[] = [];
    const requiredHeaders = ['单位编码', '区县', '单位名称', '项目明细', '报价', '接单人', '完成人'];

    for (const { sheetName, rows: table } of sheets) {
      const rows = this.readMultiHeaderRows(table, 2);
      if (!rows.length)
        continue;
      const headers = Object.keys(rows[0] || {}).map(header => this.normalizeHeader(header));
      const matchedHeaderCount = requiredHeaders.filter(header => headers.includes(header)).length;
      if (matchedHeaderCount < requiredHeaders.length)
        continue;

      rows.forEach((row, index) => {
        const raw = this.normalizeRawRowKeys(row);
        if (!this.hasAnyLegacyBusinessValue(raw, '项目明细'))
          return;
        raw.__sheetName = sheetName;
        parsedRows.push({
          sheetName,
          rowNo: index + 3,
          raw,
        });
      });
    }

    return parsedRows;
  }

  private parseIntegrationValueAddedSheets(sheets: SpreadsheetSheetRows[]) {
    const parsedRows: ParsedClientUnitDirectoryRow[] = [];
    const requiredHeaders = ['区县', '单位编码', '单位名称', '服务项目', '签单人', '收款情况应收金额'];

    for (const { sheetName, rows: table } of sheets) {
      const rows = this.readMultiHeaderRows(table, 2);
      if (!rows.length)
        continue;
      const headers = Object.keys(rows[0] || {}).map(header => this.normalizeHeader(header));
      const matchedHeaderCount = requiredHeaders.filter(header => headers.includes(header)).length;
      if (matchedHeaderCount < requiredHeaders.length)
        continue;

      rows.forEach((row, index) => {
        const raw = this.normalizeRawRowKeys(row);
        if (!this.hasAnyLegacyBusinessValue(raw, '服务项目'))
          return;
        raw.__sheetName = sheetName;
        parsedRows.push({
          sheetName,
          rowNo: index + 3,
          raw,
        });
      });
    }

    return parsedRows;
  }

  private async parseClientUnitDirectoryFile(file: ClientUnitDirectoryFile) {
    const sheets = await this.spreadsheetService.readSheets(file, {
      allowedExtensions: ['.xls', '.xlsx'],
      parseErrorMessage: '无法解析 Excel 文件，请确认文件未损坏且为正确的单位基础库文件',
    });
    return this.parseClientUnitDirectorySheets(sheets);
  }

  private parseClientUnitDirectorySheets(sheets: SpreadsheetSheetRows[]) {
    const parsedRows: ParsedClientUnitDirectoryRow[] = [];

    for (const { sheetName, rows: table } of sheets) {
      const rows = this.readTableRows(table);
      if (!rows.length)
        continue;

      const headers = Object.keys(rows[0] || {}).map(header => this.normalizeHeader(header));
      const matchedHeaderCount = CLIENT_UNIT_DIRECTORY_HEADERS.filter(header => headers.includes(header)).length;
      if (matchedHeaderCount < CLIENT_UNIT_DIRECTORY_HEADERS.length)
        throw new BadRequestException(`工作表“${sheetName}”不是单位基础客户库模板，请检查导入文件`);

      rows.forEach((row, index) => {
        const raw = this.normalizeRawRowKeys(row);
        if (!this.hasAnyRequiredClientValue(raw))
          return;
        parsedRows.push({
          sheetName,
          rowNo: index + 2,
          raw,
        });
      });
    }

    return parsedRows;
  }

  private readTableRows(table: string[][]) {
    if (table.length < 2)
      return [];

    const headers = table[0].map(cell => this.cleanCellText(cell));
    const rows: Array<Record<string, unknown>> = [];

    for (const row of table.slice(1)) {
      const record: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        if (header)
          record[header] = this.cleanCellText(row[index]);
      });
      rows.push(record);
    }

    return rows;
  }

  private readMultiHeaderRows(table: string[][], headerRowCount: 2) {
    if (table.length <= headerRowCount)
      return [];

    const headers = this.buildMultiRowHeaders(table.slice(0, headerRowCount));
    const rows: Array<Record<string, unknown>> = [];

    for (const row of table.slice(headerRowCount)) {
      const record: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        if (header)
          record[header] = this.cleanCellText(row[index]);
      });
      rows.push(record);
    }

    return rows;
  }

  private buildMultiRowHeaders(headerRows: string[][]) {
    const maxColumnCount = Math.max(...headerRows.map(row => row.length));
    const headers: string[] = [];
    let currentTopHeader = '';

    for (let index = 0; index < maxColumnCount; index += 1) {
      const topHeader = this.cleanCellText(headerRows[0]?.[index]);
      if (topHeader)
        currentTopHeader = topHeader;
      const childHeader = this.cleanCellText(headerRows[1]?.[index]);
      if (childHeader && currentTopHeader && childHeader !== currentTopHeader)
        headers.push(`${currentTopHeader}${childHeader}`);
      else
        headers.push(childHeader || currentTopHeader);
    }

    return headers;
  }

  private cleanCellText(value: unknown) {
    if (value === null || value === undefined)
      return '';
    if (value instanceof Date)
      return value.toISOString().slice(0, 10);
    return String(value).trim();
  }

  private async validateClientUnitDirectoryRow(
    raw: Record<string, unknown>,
    existingKeys: Set<string>,
    seenKeys: Set<string>,
  ): Promise<ClientImportValidation> {
    const messages: string[] = [];
    const unitCode = this.cleanRequired(raw['*单位代码']);
    const unitName = this.cleanRequired(raw['*单位名称']);
    const fiscalRegion = this.parseFiscalRegion(this.cleanOptionalValue(raw['*单位所在地区']));
    const region = fiscalRegion.name
      ? await this.findOrCreateRegionByImportedName(fiscalRegion.name)
      : null;

    if (!/^\d{6}$/.test(unitCode))
      messages.push('单位代码必须是6位数字');
    if (!unitName)
      messages.push('单位名称不能为空');
    if (!fiscalRegion.name)
      messages.push('单位所在地区不能为空');
    if (!unitCode || !unitName || !region)
      return { status: IMPORT_ROW_STATUS.ERROR, messages, normalized: null };

    const uniqueKey = this.clientUniqueKey(region.code, unitCode);
    if (existingKeys.has(uniqueKey))
      messages.push('系统中已存在相同区划和单位代码的客户');
    if (seenKeys.has(uniqueKey))
      messages.push('本次导入文件中存在重复客户');
    const normalized: NormalizedClientImportRow = {
      regionCode: region.code,
      regionName: region.name,
      unitCode,
      unitName,
      unifiedSocialCreditCode: this.cleanOptionalValue(raw['*统一社会信用代码']),
      legalPerson: this.cleanOptionalValue(raw['*法人']),
      financeStaff: this.cleanOptionalValue(raw['*财务人员']),
      financeManager: this.cleanOptionalValue(raw['财务负责人']),
      address: this.cleanOptionalValue(raw['*单位地址']),
      contactPhone: this.cleanOptionalValue(raw['*联系电话']),
      remark: this.cleanOptionalValue(raw['不纳入统计原因']),
    };

    if (messages.length)
      return { status: IMPORT_ROW_STATUS.WARNING, messages, normalized };
    return { status: IMPORT_ROW_STATUS.VALID, messages: ['校验通过'], normalized };
  }

  private async validateImportRow(
    sourceType: ImportSourceType,
    raw: Record<string, unknown>,
    context: ImportValidationContext,
    seenKeys: Set<string>,
  ) {
    if (sourceType === 'client_unit_directory')
      return this.validateClientUnitDirectoryRow(raw, context.existingClientKeys, seenKeys);
    return this.validateLegacyBusinessRow(sourceType, raw, context);
  }

  private validateLegacyBusinessRow(
    sourceType: LegacyBusinessSourceType,
    raw: Record<string, unknown>,
    context: ImportValidationContext,
  ): LegacyBusinessImportValidation {
    const blockers: string[] = [];
    const warnings: string[] = [];
    const normalized = sourceType === 'asset_report_control'
      ? this.normalizeAssetReportControlRow(raw, context, blockers, warnings)
      : this.normalizeIntegrationValueAddedRow(raw, context, blockers, warnings);

    if (blockers.length)
      return { status: IMPORT_ROW_STATUS.ERROR, messages: [...blockers, ...warnings], normalized };
    if (warnings.length)
      return { status: IMPORT_ROW_STATUS.WARNING, messages: warnings, normalized };
    return { status: IMPORT_ROW_STATUS.VALID, messages: ['校验通过，当前仅进入旧业务预览暂存，不直接写正式订单'], normalized };
  }

  private normalizeAssetReportControlRow(
    raw: Record<string, unknown>,
    context: ImportValidationContext,
    blockers: string[],
    warnings: string[],
  ): NormalizedLegacyBusinessImportRow {
    const regionName = this.cleanRequired(raw['区县']);
    let unitCode = this.cleanRequired(raw['单位编码']);
    const unitName = this.cleanRequired(raw['单位名称']);
    const serviceProject = this.cleanRequired(raw['项目明细']);
    const receiverName = this.cleanOptionalValue(raw['接单人']);
    const performerName = this.cleanOptionalValue(raw['完成人']);
    const region = this.resolveImportedRegion(regionName, context.regions, blockers);
    const clientResolution = this.validateLegacyClient(region?.code || null, unitCode, unitName, context, blockers, warnings);
    unitCode = clientResolution.unitCode;
    const serviceResolution = this.resolveLegacyServices(serviceProject, context.services, blockers, warnings);
    const receiver = this.resolveEmployee(receiverName, context.employees, '接单人', blockers);
    const performer = this.resolveEmployee(performerName, context.employees, '完成人', blockers);
    const packageAmount = this.parseMoney(this.cleanOptionalValue(raw['报价']));
    if (!packageAmount)
      blockers.push('报价不能为空且必须是有效金额');

    const orderDate = this.parseDate(this.cleanOptionalValue(raw['接单日期']));
    const serviceYear = orderDate ? Number(orderDate.slice(0, 4)) : this.parseYearFromText(this.cleanRequired(raw['__sheetName']));
    if (!serviceYear)
      warnings.push('缺少接单日期，且无法从工作表名称识别服务年度');

    const credentials = this.buildCredentialRows([
      { systemName: '资产系统', username: this.cleanOptionalValue(raw['资产系统账号']), password: this.cleanOptionalValue(raw['资产系统密码']) },
      { systemName: '内控系统', username: this.cleanOptionalValue(raw['内控系统账号']), password: this.cleanOptionalValue(raw['内控系统密码']) },
    ], warnings);

    const paymentDate = this.parseDate(this.cleanOptionalValue(raw['收款日期']));
    const billableAmount = packageAmount;

    return {
      sourceType: 'asset_report_control',
      clientId: clientResolution.clientId,
      regionCode: region?.code || null,
      regionName: region?.name || regionName || null,
      unitCode,
      unitName: clientResolution.unitName,
      canonicalUnitName: clientResolution.canonicalUnitName,
      nameChanged: clientResolution.nameChanged,
      clientExists: clientResolution.clientExists,
      contactName: this.cleanOptionalValue(raw['联系人']),
      contactPhone: this.cleanOptionalValue(raw['联系电话']),
      otherContact: null,
      serviceProject,
      serviceNames: serviceResolution.serviceNames,
      splitRequired: serviceResolution.splitRequired,
      receiverName,
      receiverId: receiver?.id || null,
      performerName,
      performerId: performer?.id || null,
      serviceYear,
      orderDate,
      serviceStartDate: null,
      serviceEndDate: null,
      packageAmount,
      billableAmount,
      invoiceAmount: null,
      receivedAmount: this.statusMeansPaid(this.cleanOptionalValue(raw['是否付款'])) ? billableAmount : null,
      paymentDate,
      contractStatus: this.cleanOptionalValue(raw['是否签订合同']),
      invoiceStatus: this.cleanOptionalValue(raw['是否开票']),
      paymentStatus: this.cleanOptionalValue(raw['是否付款']),
      progressNote: this.cleanOptionalValue(raw['上报情况/存在问题']),
      financeReference: {
        contractStatus: this.cleanOptionalValue(raw['是否签订合同']),
        invoiceStatus: this.cleanOptionalValue(raw['是否开票']),
        paymentStatus: this.cleanOptionalValue(raw['是否付款']),
        paymentDate,
      },
      credentials,
    };
  }

  private normalizeIntegrationValueAddedRow(
    raw: Record<string, unknown>,
    context: ImportValidationContext,
    blockers: string[],
    warnings: string[],
  ): NormalizedLegacyBusinessImportRow {
    const regionName = this.cleanRequired(raw['区县']);
    let unitCode = this.cleanRequired(raw['单位编码']);
    const unitName = this.cleanRequired(raw['单位名称']);
    const serviceProject = this.cleanRequired(raw['服务项目']);
    const receiverName = this.cleanOptionalValue(raw['签单人']);
    const performerName = this.cleanOptionalValue(raw['完成人']);
    const region = this.resolveImportedRegion(regionName, context.regions, blockers);
    const clientResolution = this.validateLegacyClient(region?.code || null, unitCode, unitName, context, blockers, warnings);
    unitCode = clientResolution.unitCode;
    const serviceResolution = this.resolveLegacyServices(serviceProject, context.services, blockers, warnings);
    const receiver = this.resolveEmployee(receiverName, context.employees, '签单人', blockers);
    const performer = performerName ? this.resolveEmployee(performerName, context.employees, '完成人', blockers) : null;
    const serviceStartDate = this.parseDate(this.cleanOptionalValue(raw['合同情况签订时间']));
    const serviceEndDate = this.parseDate(this.cleanOptionalValue(raw['合同情况到期时间']));
    const serviceYear = serviceStartDate ? Number(serviceStartDate.slice(0, 4)) : null;
    const packageAmount = this.parseMoney(this.cleanOptionalValue(raw['收款情况应收金额']));
    const invoiceAmount = this.parseMoney(this.cleanOptionalValue(raw['收款情况开票金额']));
    const receivedAmount = this.parseMoney(this.cleanOptionalValue(raw['收款情况实收金额']));

    if (!serviceStartDate || !serviceEndDate)
      warnings.push('缺少签订时间或到期时间，无法生成完整服务期');
    if (!packageAmount)
      warnings.push('应收金额为空或不是有效金额');
    if (serviceResolution.minMonths && serviceStartDate && serviceEndDate)
      this.validateMinServicePeriod(serviceStartDate, serviceEndDate, serviceResolution.minMonths, blockers);
    if (!performerName)
      warnings.push('一体化表没有完成人列，确认迁移到正式订单前需要指定完成人');

    return {
      sourceType: 'integration_value_added',
      clientId: clientResolution.clientId,
      regionCode: region?.code || null,
      regionName: region?.name || regionName || null,
      unitCode,
      unitName: clientResolution.unitName,
      canonicalUnitName: clientResolution.canonicalUnitName,
      nameChanged: clientResolution.nameChanged,
      clientExists: clientResolution.clientExists,
      contactName: this.cleanOptionalValue(raw['单位联系人']),
      contactPhone: this.cleanOptionalValue(raw['单位联系方式']),
      otherContact: this.cleanOptionalValue(raw['其他联系人']),
      serviceProject,
      serviceNames: serviceResolution.serviceNames,
      splitRequired: serviceResolution.splitRequired,
      receiverName,
      receiverId: receiver?.id || null,
      performerName,
      performerId: performer?.id || null,
      serviceYear,
      orderDate: serviceStartDate,
      serviceStartDate,
      serviceEndDate,
      packageAmount,
      billableAmount: packageAmount,
      invoiceAmount,
      receivedAmount,
      paymentDate: null,
      contractStatus: this.cleanOptionalValue(raw['合同情况']),
      invoiceStatus: this.cleanOptionalValue(raw['收款情况是否开票']),
      paymentStatus: this.cleanOptionalValue(raw['收款情况付款情况']),
      progressNote: this.cleanOptionalValue(raw['跟单填写信息']),
      financeReference: {
        visitedStatus: this.cleanOptionalValue(raw['是否已上门']),
        balanceDiff: this.parseMoney(this.cleanOptionalValue(raw['收款情况实收差额'])),
        balanceRemark: this.cleanOptionalValue(raw['收款情况差额备注']),
        deliveryStatus: this.cleanOptionalValue(raw['收款情况送达情况']),
        expirationDays: this.parseNumber(this.cleanOptionalValue(raw['合同情况剩余到期天数'])),
      },
      credentials: [],
    };
  }

  private resolveImportedRegion(regionName: string, regions: DictionaryItem[], blockers: string[]) {
    if (!regionName) {
      blockers.push('区县不能为空');
      return null;
    }

    const normalizedImportedName = this.normalizeRegionName(regionName);
    const region = regions.find(item => this.normalizeRegionName(item.name) === normalizedImportedName);
    if (!region)
      blockers.push(`区县“${regionName}”未匹配到已启用的数据字典region`);
    return region || null;
  }

  private validateLegacyClient(
    regionCode: string | null,
    unitCode: string,
    unitName: string,
    context: ImportValidationContext,
    blockers: string[],
    warnings: string[],
  ) {
    let resolvedUnitCode = unitCode;
    let resolvedUnitName = unitName;
    if (!unitName)
      blockers.push('单位名称不能为空');

    if (!/^\d{6}$/.test(resolvedUnitCode)) {
      const matchedClient = regionCode && unitName ? context.existingClientByUnitName.get(this.clientNameKey(regionCode, unitName)) : null;
      if (matchedClient) {
        resolvedUnitCode = matchedClient.unitCode;
        warnings.push(`单位编码已按客户主数据回填为${matchedClient.unitCode}`);
      }
      else {
        blockers.push('单位编码必须是6位数字');
      }
    }

    if (!resolvedUnitCode || !unitName || !/^\d{6}$/.test(resolvedUnitCode) || !regionCode)
      return { unitCode: resolvedUnitCode, unitName: resolvedUnitName, canonicalUnitName: null, nameChanged: false, clientId: null, clientExists: false };

    const clientsByCode = context.existingClientsByRegionUnitCode.get(this.clientRegionUnitCodeKey(regionCode, resolvedUnitCode)) || [];
    const exactClient = clientsByCode.find(client => this.normalizeCompactName(client.unitName) === this.normalizeCompactName(unitName)) || null;
    const matchedClient = this.pickCanonicalClient(clientsByCode) || exactClient;
    if (!matchedClient) {
      if (clientsByCode.length > 1)
        blockers.push(`同一区划同单位编码存在多个客户主数据：${clientsByCode.map(client => client.unitName).join('、')}，需先合并或补录指定客户`);
      else
        warnings.push('客户主数据不存在，需先导入单位基础客户库或手工新建客户');
      return { unitCode: resolvedUnitCode, unitName: resolvedUnitName, canonicalUnitName: null, nameChanged: false, clientId: null, clientExists: false };
    }

    resolvedUnitName = matchedClient.unitName;
    if (matchedClient.unitName !== unitName)
      warnings.push(`单位名称已按客户主数据归并为“${matchedClient.unitName}”，原名称“${unitName}”作为历史名称参考`);
    if (clientsByCode.length > 1 && matchedClient.source !== 'import')
      warnings.push('同一区划同单位编码存在多个客户主数据，当前按单位名称精确匹配');

    return {
      unitCode: resolvedUnitCode,
      unitName: resolvedUnitName,
      canonicalUnitName: matchedClient.unitName === unitName ? null : matchedClient.unitName,
      nameChanged: matchedClient.unitName !== unitName,
      clientId: matchedClient.id,
      clientExists: true,
    };
  }

  private resolveLegacyServices(
    serviceProject: string,
    services: ServiceCatalog[],
    blockers: string[],
    warnings: string[],
  ) {
    if (!serviceProject) {
      blockers.push('服务项目不能为空');
      return { serviceNames: [], splitRequired: false, minMonths: 0 };
    }

    const exactService = this.findNamedItem(services, serviceProject);
    if (exactService)
      return { serviceNames: [exactService.name], splitRequired: false, minMonths: exactService.minMonths || 0 };

    const normalizedProject = this.normalizeCompactName(serviceProject);
    const splitSuggestion = LEGACY_SERVICE_SPLIT_SUGGESTIONS.get(normalizedProject) || this.splitCompositeLegacyService(normalizedProject);
    if (!splitSuggestion) {
      blockers.push(`服务项目“${serviceProject}”未匹配到已启用服务项`);
      return { serviceNames: [], splitRequired: false, minMonths: 0 };
    }

    const matchedServices: ServiceCatalog[] = [];
    const missingNames: string[] = [];
    for (const serviceName of splitSuggestion) {
      const service = this.findNamedItem(services, serviceName);
      if (service)
        matchedServices.push(service);
      else
        missingNames.push(serviceName);
    }
    if (missingNames.length)
      blockers.push(`组合服务“${serviceProject}”建议拆分为${splitSuggestion.join('、')}，但服务目录缺少：${missingNames.join('、')}`);
    else
      warnings.push(`组合服务“${serviceProject}”需人工确认拆分和金额分摊：${splitSuggestion.join('、')}`);

    return {
      serviceNames: matchedServices.map(service => service.name),
      splitRequired: true,
      minMonths: matchedServices.reduce((maxMonths, service) => Math.max(maxMonths, service.minMonths || 0), 0),
    };
  }

  private resolveEmployee(employeeName: string | null, employees: User[], label: string, blockers: string[]) {
    if (!employeeName) {
      blockers.push(`${label}不能为空`);
      return null;
    }
    const employee = employees.find(user => this.normalizeCompactName(this.resolveUserDisplayName(user)) === this.normalizeCompactName(employeeName));
    if (!employee)
      blockers.push(`${label}“${employeeName}”未匹配到启用员工账号`);
    return employee || null;
  }

  private findNamedItem<T extends { name: string }>(items: T[], name: string): T | null {
    const normalizedName = this.normalizeCompactName(name);
    return items.find(item => this.normalizeCompactName(item.name) === normalizedName) || null;
  }

  private splitCompositeLegacyService(serviceProject: string) {
    const services: string[] = [];
    let remaining = serviceProject;
    while (remaining) {
      const matchedService = LEGACY_SPLIT_SERVICE_NAMES.find(serviceName => remaining.startsWith(serviceName));
      if (!matchedService)
        return null;
      services.push(matchedService);
      remaining = remaining.slice(matchedService.length);
    }
    return services.length > 1 ? services : null;
  }

  private buildCredentialRows(
    rows: Array<{ systemName: string; username: string | null; password: string | null }>,
    warnings: string[],
  ) {
    const credentials: LegacyCredentialRow[] = [];
    for (const row of rows) {
      if (!row.username && !row.password)
        continue;
      if (!row.username || !row.password)
        warnings.push(`${row.systemName}账号或密码不完整，正式迁移前需补齐`);
      credentials.push({
        systemName: row.systemName,
        username: row.username || '',
        password: row.password,
      });
    }
    return credentials;
  }

  private validateMinServicePeriod(startDate: string, endDate: string, minMonths: number, blockers: string[]) {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    const minEnd = new Date(start);
    minEnd.setMonth(minEnd.getMonth() + minMonths);
    if (end < minEnd)
      blockers.push(`服务期不能少于${minMonths}个月`);
  }

  private parseMoney(value: string | null) {
    if (!value)
      return null;
    const normalized = value.replace(/[,\s￥¥]/g, '');
    if (!/^-?\d+(\.\d+)?$/.test(normalized))
      return null;
    return Number(normalized).toFixed(2);
  }

  private parseNumber(value: string | null) {
    if (!value)
      return null;
    const normalized = value.replace(/[,\s]/g, '');
    if (!/^-?\d+(\.\d+)?$/.test(normalized))
      return null;
    return Number(normalized);
  }

  private parseDate(value: string | null) {
    if (!value)
      return null;
    const text = value.trim();
    if (!text || /^1900[./-]0?1[./-]0?0$/.test(text))
      return null;

    const normalized = text.replace(/[年月]/g, '-').replace(/日/g, '').replace(/[./]/g, '-');
    const parts = normalized.split('-').map(part => part.trim()).filter(Boolean);
    if (parts.length !== 3)
      return null;

    const [first, second, third] = parts.map(Number);
    if ([first, second, third].some(part => Number.isNaN(part)))
      return null;

    const isYearFirst = first > 31;
    const year = isYearFirst
      ? first
      : third < 100 ? 2000 + third : third;
    const month = isYearFirst ? second : first;
    const day = isYearFirst ? third : second;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day)
      return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private parseYearFromText(value: string) {
    const matched = value.match(/20\d{2}/);
    return matched ? Number(matched[0]) : null;
  }

  private statusMeansPaid(value: string | null) {
    return value === '已付款' || value === '已收款' || value === '已收';
  }

  private async findOrCreateRegionByImportedName(regionName: string) {
    const regionRows = await this.dictionaryRepository
      .createQueryBuilder('region')
      .withDeleted()
      .where('region.dictionaryType = :dictionaryType', { dictionaryType: 'region' })
      .getMany();
    const normalizedImportedName = this.normalizeRegionName(regionName);
    const existingRegion = regionRows.find(region => this.normalizeRegionName(region.name) === normalizedImportedName);
    if (existingRegion) {
      if (existingRegion.deleteTime) {
        await this.dictionaryRepository.restore(existingRegion.id);
        existingRegion.deleteTime = null;
      }
      if (!existingRegion.enabled) {
        existingRegion.enabled = true;
        await this.dictionaryRepository.save(existingRegion);
      }
      return existingRegion;
    }

    const regionCode = await this.createAvailableRegionCode(normalizedImportedName);
    const nextSort = regionRows.length
      ? Math.max(...regionRows.map(region => Number(region.sort || 0))) + 1
      : 1;

    // 单位库导入可能先于人工维护区划，缺失区划按导入地区自动补入数据字典。
    return this.dictionaryRepository.save(this.dictionaryRepository.create({
      dictionaryType: 'region',
      code: regionCode,
      name: normalizedImportedName,
      enabled: true,
      sort: nextSort,
      remark: `单位库导入自动创建，来源地区：${regionName}`,
    }));
  }

  private async createAvailableRegionCode(regionName: string) {
    const baseCode = createDictionaryItemCode(regionName);
    if (!baseCode)
      throw new BadRequestException(`区划“${regionName}”无法生成字典编码`);

    let candidateCode = baseCode;
    let index = 1;
    while (await this.regionCodeExists(candidateCode)) {
      index += 1;
      candidateCode = baseCode.replace(/_Code$/, `${index}_Code`);
    }
    return candidateCode;
  }

  private async regionCodeExists(code: string) {
    return this.dictionaryRepository
      .createQueryBuilder('region')
      .withDeleted()
      .where('region.dictionaryType = :dictionaryType', { dictionaryType: 'region' })
      .andWhere('region.code = :code', { code })
      .getExists();
  }

  private normalizeRawRowKeys(row: Record<string, unknown>) {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row))
      normalized[this.normalizeHeader(key)] = value;
    return normalized;
  }

  private normalizeHeader(header: string) {
    return String(header).replace(/\s+/g, '').trim();
  }

  private hasAnyRequiredClientValue(row: Record<string, unknown>) {
    return ['*单位代码', '*单位名称', '*单位所在地区'].some(key => this.cleanOptionalValue(row[key]));
  }

  private hasAnyLegacyBusinessValue(row: Record<string, unknown>, serviceProjectKey: string) {
    return ['单位编码', '单位名称', serviceProjectKey].some(key => this.cleanOptionalValue(row[key]));
  }

  private parseFiscalRegion(value: string | null) {
    if (!value)
      return { code: null, name: null };
    const [code, ...nameParts] = value.split('-');
    if (!nameParts.length)
      return { code: null, name: value.trim() };
    return {
      code: code.trim() || null,
      name: nameParts.join('-').trim() || null,
    };
  }

  private normalizeRegionName(regionName: string) {
    const trimmedName = regionName.trim();
    const normalizedName = trimmedName.length > 3 ? trimmedName.replace(/^达州市/, '') : trimmedName;
    return normalizedName
      .replace(/开江县/g, '开江')
      .replace(/宣汉县/g, '宣汉')
      .replace(/渠县/g, '渠县')
      .replace(/通川区/g, '通川区')
      .replace(/达川区/g, '达川区')
      .replace(/大竹县/g, '大竹')
      .replace(/万源市/g, '万源')
      .replace(/高新区/g, '高新区')
      .replace(/经开区/g, '经开区');
  }

  private async loadExistingClientKeyMap(clientRepository: Repository<Client> = this.clientRepository) {
    const clients = await clientRepository.find({ select: ['id', 'regionCode', 'unitCode'] });
    return new Map(clients.map(client => [this.clientUniqueKey(client.regionCode, client.unitCode), { id: client.id }]));
  }

  private async loadExistingClientKeys() {
    const existingClientMap = await this.loadExistingClientKeyMap();
    return new Set(existingClientMap.keys());
  }

  private async loadImportValidationContext(): Promise<ImportValidationContext> {
    const [clients, dictionaryItems, services, employees] = await Promise.all([
      this.clientRepository.find({ select: ['id', 'regionCode', 'unitCode', 'unitName', 'source', 'remark'] }),
      this.dictionaryRepository.find({ where: { enabled: true } }),
      this.serviceCatalogRepository.find({ where: { enabled: true } }),
      this.userRepository.find({ where: { userKind: 'EMPLOYEE', enable: true }, relations: ['employeeProfile'] }),
    ]);
    return {
      existingClientKeys: new Set(clients.map(client => this.clientUniqueKey(client.regionCode, client.unitCode))),
      existingClientByUnitName: this.buildUniqueClientNameIndex(clients),
      existingClientsByRegionUnitCode: this.buildClientsByRegionUnitCode(clients),
      regions: dictionaryItems.filter(item => item.dictionaryType === 'region'),
      services,
      employees: employees.filter(user => user.employeeProfile?.active !== false),
    };
  }

  private buildUniqueClientNameIndex(clients: ExistingClientIdentity[]) {
    const index = new Map<string, ExistingClientIdentity | null>();
    for (const client of clients) {
      const key = this.clientNameKey(client.regionCode, client.unitName);
      if (!key)
        continue;
      index.set(key, index.has(key) ? null : client);
    }
    return index;
  }

  private buildClientsByRegionUnitCode(clients: ExistingClientIdentity[]) {
    const index = new Map<string, ExistingClientIdentity[]>();
    for (const client of clients) {
      const key = this.clientRegionUnitCodeKey(client.regionCode, client.unitCode);
      const group = index.get(key) || [];
      group.push(client);
      index.set(key, group);
    }
    return index;
  }

  private ensureImportSourceType(sourceType: string): ImportSourceType {
    if (!IMPORT_SOURCE_TYPES.includes(sourceType as ImportSourceType))
      throw new BadRequestException(`不支持的导入来源类型：${sourceType}`);
    return sourceType as ImportSourceType;
  }

  private normalizeImportRowStatus(status?: string | null) {
    const value = status?.trim();
    if (!value)
      return undefined;
    const statuses: readonly ImportRowStatus[] = IMPORT_ROW_STATUSES;
    if (!statuses.includes(value as ImportRowStatus))
      throw new BadRequestException(`不支持的导入明细状态：${value}`);
    return value as ImportRowStatus;
  }

  private getImportSourceRemark(sourceType: ImportSourceType) {
    const remarkMap: Record<ImportSourceType, string> = {
      client_unit_directory: '单位基础客户库导入',
      asset_report_control: '资产财报内控绩效旧业务预览',
      integration_value_added: '一体化增值旧业务预览',
    };
    return remarkMap[sourceType];
  }

  private async refreshImportBatchSummary(batchId: number) {
    const [batch, totalRows, validRows, warningRows, errorRows, importedRows] = await Promise.all([
      this.importBatchRepository.findOne({ where: { id: batchId } }),
      this.importRowRepository.count({ where: { batchId } }),
      this.importRowRepository.count({ where: { batchId, validationStatus: IMPORT_ROW_STATUS.VALID } }),
      this.importRowRepository.count({ where: { batchId, validationStatus: IMPORT_ROW_STATUS.WARNING } }),
      this.importRowRepository.count({ where: { batchId, validationStatus: IMPORT_ROW_STATUS.ERROR } }),
      this.importRowRepository.count({ where: { batchId, validationStatus: IMPORT_ROW_STATUS.IMPORTED } }),
    ]);
    if (!batch)
      return;
    batch.totalRows = totalRows;
    batch.validRows = validRows;
    batch.warningRows = warningRows;
    batch.errorRows = errorRows;
    batch.importedRows = importedRows;
    await this.importBatchRepository.save(batch);
  }

  private async toImportBatchDtoList(batches: ImportBatch[]) {
    const userIds = [...new Set(batches.map(batch => batch.importedBy).filter(Boolean))];
    const users = userIds.length
      ? await this.userRepository.find({ where: { id: In(userIds) }, relations: ['employeeProfile'] })
      : [];
    const userMap = new Map(users.map(user => [user.id, this.resolveUserDisplayName(user)]));
    return batches.map(batch => this.buildImportBatchDto(batch, userMap.get(batch.importedBy)));
  }

  private async loadImportBatchDto(batch: ImportBatch) {
    const user = await this.userRepository.findOne({ where: { id: batch.importedBy }, relations: ['employeeProfile'] });
    return this.buildImportBatchDto(batch, user ? this.resolveUserDisplayName(user) : undefined);
  }

  private buildImportBatchDto(batch: ImportBatch, importedByName?: string) {
    return {
      id: batch.id,
      sourceFileName: normalizeUploadFileName(batch.sourceFileName),
      sourceType: batch.sourceType,
      importedBy: batch.importedBy,
      importedByName: importedByName || batch.importedByName,
      importedAt: batch.importedAt,
      status: batch.status,
      totalRows: batch.totalRows,
      validRows: batch.validRows,
      warningRows: batch.warningRows,
      errorRows: batch.errorRows,
      importedRows: batch.importedRows,
      remark: batch.remark,
      createTime: batch.createTime,
      updateTime: batch.updateTime,
    };
  }

  private toImportRowDto(row: ImportRow) {
    return {
      id: row.id,
      batchId: row.batchId,
      sheetName: row.sheetName,
      rowNo: row.rowNo,
      rawJson: row.rawJson,
      normalizedJson: row.normalizedJson,
      validationStatus: row.validationStatus,
      validationMessage: row.validationMessage,
      clientId: row.clientId,
    };
  }

  private resolveUserDisplayName(user: User) {
    return user.employeeProfile?.name || user.nickName || user.username;
  }

  private clientUniqueKey(regionCode: string, unitCode: string) {
    return `${regionCode.trim()}::${unitCode.trim()}`;
  }

  private clientRegionUnitCodeKey(regionCode: string, unitCode: string) {
    return `${regionCode.trim()}::${unitCode.trim()}`;
  }

  private clientNameKey(regionCode: string, unitName: string) {
    return `${regionCode.trim()}::${unitName.trim()}`;
  }

  private pickCanonicalClient(clients: ExistingClientIdentity[]) {
    if (clients.length === 1)
      return clients[0];
    return clients.find(client => client.source === 'import' && !client.remark?.includes('旧业务导入补齐客户主数据')) || null;
  }

  private normalizeCompactName(value: string) {
    return value.replace(/\s+/g, '').trim();
  }

  private cleanRequired(value: unknown) {
    return String(value ?? '').trim();
  }

  private cleanOptionalValue(value: unknown) {
    const text = String(value ?? '').trim();
    return text || null;
  }
}
