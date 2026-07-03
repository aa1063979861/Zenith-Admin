import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../../entities/client.entity';
import { CommissionLine } from '../../entities/commission-line.entity';
import { FinanceContractLine } from '../../entities/finance-contract-line.entity';
import { FinanceContract } from '../../entities/finance-contract.entity';
import { FinanceInvoiceLine } from '../../entities/finance-invoice-line.entity';
import { FinanceInvoice } from '../../entities/finance-invoice.entity';
import { FinancePaymentImportRow } from '../../entities/finance-payment-import-row.entity';
import { FinancePaymentImport } from '../../entities/finance-payment-import.entity';
import { FinancePayment } from '../../entities/finance-payment.entity';
import { PaymentInvoiceMatch } from '../../entities/payment-invoice-match.entity';
import { PaymentServiceAllocation } from '../../entities/payment-service-allocation.entity';
import { ServiceItem } from '../../entities/service-item.entity';
import { SpreadsheetModule } from '../../common/spreadsheet/spreadsheet.module';
import { AuthModule } from '../auth/auth.module';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { SystemParametersModule } from '../system-parameters/system-parameters.module';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Client,
      CommissionLine,
      FinanceContract,
      FinanceContractLine,
      FinanceInvoice,
      FinanceInvoiceLine,
      FinancePayment,
      FinancePaymentImport,
      FinancePaymentImportRow,
      PaymentInvoiceMatch,
      PaymentServiceAllocation,
      ServiceItem,
    ]),
    AuthModule,
    OperationLogsModule,
    SpreadsheetModule,
    SystemParametersModule,
  ],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
