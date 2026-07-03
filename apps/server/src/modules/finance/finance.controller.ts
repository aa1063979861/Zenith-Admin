import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { extname } from 'node:path';
import { EXCEL_IMPORT_UPLOAD } from '../../common/upload.constants';
import { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequireAllPermissions, RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { ParameterizedFileInterceptor } from '../system-parameters/parameterized-file.interceptor';
import { ConfirmPaymentImportDto } from './dto/confirm-payment-import.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { MatchPaymentDto } from './dto/match-payment.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { FinanceService } from './finance.service';

function BankStatementFileInterceptor() {
  return ParameterizedFileInterceptor('file', {
    resolveMaxMb: parametersService => parametersService.getImportExcelUploadMaxMb(),
    multerOptions: {
      fileFilter: (_request, file, callback) => {
        const allowedExtensions = EXCEL_IMPORT_UPLOAD.BANK_STATEMENT_EXTENSIONS.includes(extname(file.originalname || '').toLowerCase() as typeof EXCEL_IMPORT_UPLOAD.BANK_STATEMENT_EXTENSIONS[number]);
        if (allowedExtensions)
          callback(null, true);
        else
          callback(new BadRequestException('只能上传 xlsx 格式的银行流水文件'), false);
      },
    },
  });
}

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('finance')
export class FinanceController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  @RequirePermissions('ViewFinance')
  @Get('summary')
  summary() {
    return this.financeService.summary();
  }

  @RequirePermissions('ViewFinance')
  @Get('contracts')
  contracts(@Query() query: Record<string, string>) {
    return this.financeService.contracts(query);
  }

  @RequirePermissions('ViewFinance')
  @Get('contracts/:id')
  contractDetail(@Param('id', ParseIntPipe) id: number) {
    return this.financeService.contractDetail(id);
  }

  @Post('contracts')
  @RequireAllPermissions('ViewFinance', 'MaintainFinanceContract')
  async createContract(@Body() dto: CreateContractDto, @CurrentUser() user: User) {
    const result = await this.financeService.createContract(dto);
    await this.operationLogsService.record({
      module: '财务管理',
      action: '创建合同',
      targetType: 'finance-contract',
      targetId: result.id,
      targetName: result.contractNo,
      user,
      detailJson: { clientId: result.clientId, totalAmount: result.totalAmount, lineCount: result.lineCount },
    });
    return result;
  }

  @Patch('contracts/:id')
  @RequireAllPermissions('ViewFinance', 'MaintainFinanceContract')
  async updateContract(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateContractDto, @CurrentUser() user: User) {
    const result = await this.financeService.updateContract(id, dto);
    await this.operationLogsService.record({
      module: '财务管理',
      action: '更新合同',
      targetType: 'finance-contract',
      targetId: result.id,
      targetName: result.contractNo,
      user,
      detailJson: { changedFields: Object.keys(dto), totalAmount: result.totalAmount },
    });
    return result;
  }

  @RequirePermissions('ViewFinance', 'ClientManagement')
  @Get('invoices')
  invoices(@Query() query: Record<string, string>) {
    return this.financeService.invoices(query);
  }

  @RequirePermissions('ViewFinance', 'ClientManagement')
  @Get('invoices/:id')
  invoiceDetail(@Param('id', ParseIntPipe) id: number) {
    return this.financeService.invoiceDetail(id);
  }

  @Post('invoices')
  @RequireAllPermissions('ViewFinance', 'MaintainFinanceInvoice')
  async createInvoice(@Body() dto: CreateInvoiceDto, @CurrentUser() user: User) {
    const result = await this.financeService.createInvoice(dto);
    await this.operationLogsService.record({
      module: '财务管理',
      action: '创建发票',
      targetType: 'finance-invoice',
      targetId: result.id,
      targetName: result.invoiceNo,
      user,
      detailJson: { clientId: result.clientId, invoiceAmount: result.invoiceAmount, lineCount: result.lineCount },
    });
    return result;
  }

  @Patch('invoices/:id')
  @RequireAllPermissions('ViewFinance', 'MaintainFinanceInvoice')
  async updateInvoice(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateInvoiceDto, @CurrentUser() user: User) {
    const result = await this.financeService.updateInvoice(id, dto);
    await this.operationLogsService.record({
      module: '财务管理',
      action: '更新发票',
      targetType: 'finance-invoice',
      targetId: result.id,
      targetName: result.invoiceNo,
      user,
      detailJson: { changedFields: Object.keys(dto), invoiceAmount: result.invoiceAmount, status: result.status },
    });
    return result;
  }

  @RequirePermissions('ViewFinance', 'ClientManagement')
  @Get('payments')
  payments(@Query() query: Record<string, string>) {
    return this.financeService.payments(query);
  }

  @Post('payments/imports/bank-statement')
  @RequireAllPermissions('ViewFinance', 'ImportFinancePayment')
  @UseInterceptors(BankStatementFileInterceptor())
  async importBankStatement(@UploadedFile() file: { originalname: string; buffer: Buffer }, @CurrentUser() user: User) {
    const result = await this.financeService.importBankStatement(file, user);
    await this.operationLogsService.record({
      module: '财务管理',
      action: '导入银行流水预览',
      targetType: 'finance-payment-import',
      targetId: result.id,
      targetName: result.sourceFileName,
      user,
      detailJson: { totalRows: result.totalRows, validRows: result.validRows, warningRows: result.warningRows, errorRows: result.errorRows },
    });
    return result;
  }

  @RequirePermissions('ViewFinance')
  @Get('payments/imports')
  paymentImportBatches(@Query() query: Record<string, string>) {
    return this.financeService.paymentImportBatches(query);
  }

  @RequirePermissions('ViewFinance')
  @Get('payments/imports/:batchId')
  paymentImportDetail(@Param('batchId', ParseIntPipe) batchId: number, @Query() query: Record<string, string>) {
    return this.financeService.paymentImportDetail(batchId, undefined, query);
  }

  @Post('payments/imports/:batchId/confirm')
  @RequireAllPermissions('ViewFinance', 'ImportFinancePayment')
  async confirmPaymentImport(@Param('batchId', ParseIntPipe) batchId: number, @Body() dto: ConfirmPaymentImportDto, @CurrentUser() user: User) {
    const result = await this.financeService.confirmPaymentImport(batchId, dto);
    await this.operationLogsService.record({
      module: '财务管理',
      action: '确认银行流水入库',
      targetType: 'finance-payment-import',
      targetId: result.id,
      targetName: result.sourceFileName,
      user,
      detailJson: { importedRows: result.importedRows, rowIds: dto.rowIds || [], rows: dto.rows || [] },
    });
    return result;
  }

  @RequirePermissions('ViewFinance', 'ClientManagement')
  @Get('payments/:id')
  paymentDetail(@Param('id', ParseIntPipe) id: number) {
    return this.financeService.paymentDetail(id);
  }

  @Post('payments')
  @RequireAllPermissions('ViewFinance', 'MaintainFinancePayment')
  async createPayment(@Body() dto: CreatePaymentDto, @CurrentUser() user: User) {
    const result = await this.financeService.createPayment(dto);
    await this.operationLogsService.record({
      module: '财务管理',
      action: '创建收款',
      targetType: 'finance-payment',
      targetId: result.id,
      targetName: result.payerName,
      user,
      detailJson: { clientId: result.clientId, amount: result.amount },
    });
    return result;
  }

  @Patch('payments/:id')
  @RequireAllPermissions('ViewFinance', 'MaintainFinancePayment')
  async updatePayment(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePaymentDto, @CurrentUser() user: User) {
    const result = await this.financeService.updatePayment(id, dto);
    await this.operationLogsService.record({
      module: '财务管理',
      action: '更新收款',
      targetType: 'finance-payment',
      targetId: result.id,
      targetName: result.payerName,
      user,
      detailJson: { changedFields: Object.keys(dto), amount: result.amount },
    });
    return result;
  }

  @Post('payments/:id/matches')
  @RequireAllPermissions('ViewFinance', 'MatchFinancePayment')
  async matchPayment(@Param('id', ParseIntPipe) id: number, @Body() dto: MatchPaymentDto, @CurrentUser() user: User) {
    const result = await this.financeService.matchPayment(id, dto, user.id);
    await this.operationLogsService.record({
      module: '财务管理',
      action: '匹配收款发票',
      targetType: 'finance-payment',
      targetId: result.id,
      targetName: result.payerName,
      user,
      detailJson: { amount: result.amount, matchedAmount: result.matchedAmount, matchCount: result.matchCount },
    });
    return result;
  }
}
