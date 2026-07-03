import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { extname } from 'node:path';
import { EXCEL_IMPORT_UPLOAD } from '../../common/upload.constants';
import { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissionCheck, RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { ParameterizedFileInterceptor } from '../system-parameters/parameterized-file.interceptor';
import { ClientCredentialsService } from './client-credentials.service';
import { ClientImportService } from './client-import.service';
import { ClientsService } from './clients.service';
import { ChangeClientIdentityDto } from './dto/change-client-identity.dto';
import { ConfirmClientImportDto } from './dto/confirm-client-import.dto';
import { CreateClientContactDto } from './dto/create-client-contact.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { CreateCredentialDto } from './dto/create-credential.dto';
import { MergeClientDto } from './dto/merge-client.dto';
import { UpdateClientContactDto } from './dto/update-client-contact.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { UpdateCredentialDto } from './dto/update-credential.dto';

function ExcelFileInterceptor(errorMessage: string) {
  return ParameterizedFileInterceptor('file', {
    resolveMaxMb: parametersService => parametersService.getImportExcelUploadMaxMb(),
    multerOptions: {
      fileFilter: (_request, file, callback) => {
        const allowedExtensions = EXCEL_IMPORT_UPLOAD.ALLOWED_EXTENSIONS.includes(extname(file.originalname || '').toLowerCase() as typeof EXCEL_IMPORT_UPLOAD.ALLOWED_EXTENSIONS[number]);
        if (allowedExtensions)
          callback(null, true);
        else
          callback(new BadRequestException(errorMessage), false);
      },
    },
  });
}

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('clients')
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly clientCredentialsService: ClientCredentialsService,
    private readonly clientImportService: ClientImportService,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  @RequirePermissions('ClientManagement', 'OrderManagement')
  @Get()
  page(@Query() query: Record<string, string>) {
    return this.clientsService.page(query);
  }

  @RequirePermissions('ClientManagement', 'OrderManagement', 'ViewFinance')
  @Get('options')
  options(@Query('regionCode') regionCode?: string) {
    return this.clientsService.options(regionCode);
  }

  @Post()
  @RequirePermissions('AddClient')
  async create(@Body() dto: CreateClientDto, @CurrentUser() user: User) {
    const result = await this.clientsService.create(dto);
    await this.operationLogsService.record({
      module: '客户管理',
      action: '新增客户',
      targetType: 'client',
      targetId: result.id,
      targetName: result.unitName,
      user,
      detailJson: { unitCode: result.unitCode, regionCode: result.regionCode },
    });
    return result;
  }

  @Patch(':id')
  @RequirePermissionCheck('client:update')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateClientDto, @CurrentUser() user: User) {
    const result = await this.clientsService.update(id, dto);
    await this.operationLogsService.record({
      module: '客户管理',
      action: '更新客户',
      targetType: 'client',
      targetId: result.id,
      targetName: result.unitName,
      user,
      detailJson: { unitCode: result.unitCode, changedFields: Object.keys(dto) },
    });
    return result;
  }

  @Patch(':id/identity')
  @RequirePermissionCheck('client:update')
  async changeIdentity(@Param('id', ParseIntPipe) id: number, @Body() dto: ChangeClientIdentityDto, @CurrentUser() user: User) {
    const result = await this.clientsService.changeIdentity(id, dto, user);
    await this.operationLogsService.record({
      module: '客户管理',
      action: '变更单位信息',
      targetType: 'client',
      targetId: result.id,
      targetName: result.unitName,
      user,
      detailJson: { regionCode: result.regionCode, unitCode: result.unitCode, reason: dto.reason },
    });
    return result;
  }

  @Post('imports/unit-directory')
  @RequirePermissions('ImportClient')
  @UseInterceptors(ExcelFileInterceptor('只能上传 xls/xlsx 格式的单位基础库文件'))
  async importUnitDirectory(@UploadedFile() file: { originalname: string; mimetype: string; buffer: Buffer }, @CurrentUser() user: User) {
    const result = await this.clientImportService.importUnitDirectory(file, user);
    await this.operationLogsService.record({
      module: '客户管理',
      action: '导入客户暂存',
      targetType: 'client-import-batch',
      targetId: result.id,
      targetName: result.sourceFileName,
      user,
      detailJson: { totalRows: result.totalRows, validRows: result.validRows, warningRows: result.warningRows, errorRows: result.errorRows },
    });
    return result;
  }

  @Post('imports/asset-report-control')
  @RequirePermissions('ImportClient')
  @UseInterceptors(ExcelFileInterceptor('只能上传 xls/xlsx 格式的资产财报内控绩效旧业务表'))
  async importAssetReportControl(@UploadedFile() file: { originalname: string; mimetype: string; buffer: Buffer }, @CurrentUser() user: User) {
    const result = await this.clientImportService.importAssetReportControl(file, user);
    await this.operationLogsService.record({
      module: '客户管理',
      action: '导入资产财报内控绩效旧业务预览',
      targetType: 'client-import-batch',
      targetId: result.id,
      targetName: result.sourceFileName,
      user,
      detailJson: { totalRows: result.totalRows, validRows: result.validRows, warningRows: result.warningRows, errorRows: result.errorRows },
    });
    return result;
  }

  @Post('imports/integration-value-added')
  @RequirePermissions('ImportClient')
  @UseInterceptors(ExcelFileInterceptor('只能上传 xls/xlsx 格式的一体化增值旧业务表'))
  async importIntegrationValueAdded(@UploadedFile() file: { originalname: string; mimetype: string; buffer: Buffer }, @CurrentUser() user: User) {
    const result = await this.clientImportService.importIntegrationValueAdded(file, user);
    await this.operationLogsService.record({
      module: '客户管理',
      action: '导入一体化增值旧业务预览',
      targetType: 'client-import-batch',
      targetId: result.id,
      targetName: result.sourceFileName,
      user,
      detailJson: { totalRows: result.totalRows, validRows: result.validRows, warningRows: result.warningRows, errorRows: result.errorRows },
    });
    return result;
  }

  @RequirePermissions('ViewClientImport', 'ImportClient')
  @Get('imports')
  importBatches(@Query() query: Record<string, string>) {
    return this.clientImportService.importBatches(query);
  }

  @RequirePermissions('ViewClientImport', 'ImportClient')
  @Get('imports/:batchId')
  importBatchDetail(@Param('batchId', ParseIntPipe) batchId: number, @Query() query: Record<string, string>) {
    return this.clientImportService.importBatchDetail(batchId, undefined, query);
  }

  @RequirePermissions('ViewClientImport', 'ImportClient')
  @Get('imports/:batchId/importable-row-ids')
  importableImportRowIds(@Param('batchId', ParseIntPipe) batchId: number) {
    return this.clientImportService.importableImportRowIds(batchId);
  }

  @Post('imports/:batchId/revalidate')
  @RequirePermissions('ImportClient')
  async revalidateImportBatch(@Param('batchId', ParseIntPipe) batchId: number, @CurrentUser() user: User) {
    const result = await this.clientImportService.revalidateImportBatch(batchId);
    await this.operationLogsService.record({
      module: '客户管理',
      action: '重新校验导入批次',
      targetType: 'client-import-batch',
      targetId: result.id,
      targetName: result.sourceFileName,
      user,
      detailJson: { totalRows: result.totalRows, validRows: result.validRows, warningRows: result.warningRows, errorRows: result.errorRows },
    });
    return result;
  }

  @Post('imports/:batchId/confirm')
  @RequirePermissions('ConfirmClientImport')
  async confirmImportBatch(@Param('batchId', ParseIntPipe) batchId: number, @Body() dto: ConfirmClientImportDto, @CurrentUser() user: User) {
    const result = await this.clientImportService.confirmImportBatch(batchId, dto);
    await this.operationLogsService.record({
      module: '客户管理',
      action: '确认客户导入',
      targetType: 'client-import-batch',
      targetId: result.batch.id,
      targetName: result.batch.sourceFileName,
      user,
      detailJson: { rowCount: dto.rowIds.length, created: result.created, skipped: result.skipped },
    });
    return result;
  }

  @Delete('imports/:batchId')
  @RequirePermissions('DeleteClientImport')
  async removeImportBatch(@Param('batchId', ParseIntPipe) batchId: number, @CurrentUser() user: User) {
    const batch = await this.clientImportService.importBatchDetail(batchId);
    const result = await this.clientImportService.removeImportBatch(batchId);
    await this.operationLogsService.record({
      module: '客户管理',
      action: '删除导入暂存',
      targetType: 'client-import-batch',
      targetId: batch.id,
      targetName: batch.sourceFileName,
      user,
      detailJson: { totalRows: batch.totalRows },
    });
    return result;
  }

  @Get('credential-system-options')
  @RequirePermissions('ViewClientCredential')
  credentialSystemOptions() {
    return this.clientCredentialsService.credentialSystemOptions();
  }

  @Get(':clientId/credentials')
  @RequirePermissions('ViewClientCredential')
  credentials(@Param('clientId', ParseIntPipe) clientId: number, @CurrentUser() user: User) {
    return this.clientCredentialsService.list(clientId, user);
  }

  @Get(':clientId/contacts')
  @RequirePermissions('ClientManagement', 'OrderManagement')
  contacts(@Param('clientId', ParseIntPipe) clientId: number) {
    return this.clientsService.contacts(clientId);
  }

  @Post(':clientId/contacts')
  @RequirePermissions('EditClient')
  async createContact(@Param('clientId', ParseIntPipe) clientId: number, @Body() dto: CreateClientContactDto, @CurrentUser() user: User) {
    const result = await this.clientsService.createContact(clientId, dto);
    await this.operationLogsService.record({
      module: '客户管理',
      action: '新增联系人',
      targetType: 'client-contact',
      targetId: result.id,
      targetName: result.name,
      user,
      detailJson: { clientId, role: result.role },
    });
    return result;
  }

  @Patch(':clientId/contacts/:contactId')
  @RequirePermissions('EditClient')
  async updateContact(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('contactId', ParseIntPipe) contactId: number,
    @Body() dto: UpdateClientContactDto,
    @CurrentUser() user: User,
  ) {
    const result = await this.clientsService.updateContact(clientId, contactId, dto);
    await this.operationLogsService.record({
      module: '客户管理',
      action: '更新联系人',
      targetType: 'client-contact',
      targetId: result.id,
      targetName: result.name,
      user,
      detailJson: { clientId, changedFields: Object.keys(dto) },
    });
    return result;
  }

  @Get(':clientId/identity-histories')
  @RequirePermissions('ClientManagement', 'OrderManagement')
  identityHistories(@Param('clientId', ParseIntPipe) clientId: number) {
    return this.clientsService.identityHistories(clientId);
  }

  @Get(':clientId/merge-logs')
  @RequirePermissions('ClientManagement', 'OrderManagement')
  mergeLogs(@Param('clientId', ParseIntPipe) clientId: number) {
    return this.clientsService.mergeLogs(clientId);
  }

  @Post(':clientId/merge')
  @RequirePermissions('DeleteClient')
  async mergeClient(@Param('clientId', ParseIntPipe) clientId: number, @Body() dto: MergeClientDto, @CurrentUser() user: User) {
    const result = await this.clientsService.merge(clientId, dto, user);
    await this.operationLogsService.record({
      module: '客户管理',
      action: '合并客户',
      targetType: 'client',
      targetId: clientId,
      targetName: String(dto.targetClientId),
      user,
      detailJson: result,
    });
    return result;
  }

  @Post(':clientId/merge-logs/:logId/revert')
  @RequirePermissions('DeleteClient')
  async revertMerge(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('logId', ParseIntPipe) logId: number,
    @CurrentUser() user: User,
  ) {
    const result = await this.clientsService.revertMerge(clientId, logId, user);
    await this.operationLogsService.record({
      module: '客户管理',
      action: '撤销客户合并',
      targetType: 'client-merge-log',
      targetId: logId,
      targetName: String(clientId),
      user,
      detailJson: result,
    });
    return result;
  }

  @Post(':clientId/credentials')
  @RequirePermissions('EditClientCredential')
  async createCredential(@Param('clientId', ParseIntPipe) clientId: number, @Body() dto: CreateCredentialDto, @CurrentUser() user: User) {
    const result = await this.clientCredentialsService.create(clientId, dto);
    await this.operationLogsService.record({
      module: '客户管理',
      action: '新增客户账号资料',
      targetType: 'client-credential',
      targetId: result.id,
      targetName: result.systemName,
      user,
      detailJson: { clientId: result.clientId, username: result.username },
    });
    await this.clientsService.refreshClientSummary(clientId);
    return result;
  }

  @Patch(':clientId/credentials/:credentialId')
  @RequirePermissions('EditClientCredential')
  async updateCredential(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('credentialId', ParseIntPipe) credentialId: number,
    @Body() dto: UpdateCredentialDto,
    @CurrentUser() user: User,
  ) {
    const result = await this.clientCredentialsService.update(clientId, credentialId, dto, user);
    await this.operationLogsService.record({
      module: '客户管理',
      action: '修改客户账号资料',
      targetType: 'client-credential',
      targetId: result.id,
      targetName: result.systemName,
      user,
      detailJson: { clientId, username: result.username, changedFields: Object.keys(dto) },
    });
    await this.clientsService.refreshClientSummary(clientId);
    return result;
  }

  @Delete(':clientId/credentials/:credentialId')
  @RequirePermissions('EditClientCredential')
  async removeCredential(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('credentialId', ParseIntPipe) credentialId: number,
    @CurrentUser() user: User,
  ) {
    const result = await this.clientCredentialsService.remove(clientId, credentialId, user);
    await this.operationLogsService.record({
      module: '客户管理',
      action: '删除客户账号资料',
      targetType: 'client-credential',
      targetId: credentialId,
      targetName: String(clientId),
      user,
      detailJson: { clientId },
    });
    await this.clientsService.refreshClientSummary(clientId);
    return result;
  }

  @Post(':clientId/credentials/:credentialId/copy-log')
  @RequirePermissions('ViewClientCredential')
  recordCredentialCopy(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('credentialId', ParseIntPipe) credentialId: number,
    @Body('field') field: string | undefined,
    @CurrentUser() user: User,
  ) {
    return this.clientCredentialsService.recordCopy(clientId, credentialId, user, field);
  }

  @RequirePermissions('ClientManagement', 'OrderManagement')
  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.clientsService.detail(id);
  }

  @Delete(':id')
  @RequirePermissions('DeleteClient')
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    const client = await this.clientsService.findOne(id);
    const result = await this.clientsService.remove(id);
    await this.operationLogsService.record({
      module: '客户管理',
      action: '删除客户',
      targetType: 'client',
      targetId: client.id,
      targetName: client.unitName,
      user,
      detailJson: { unitCode: client.unitCode, regionCode: client.regionCode },
    });
    return result;
  }
}
