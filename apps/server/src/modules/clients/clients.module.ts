import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpreadsheetModule } from '../../common/spreadsheet/spreadsheet.module';
import { ClientCredential } from '../../entities/client-credential.entity';
import { ClientContact } from '../../entities/client-contact.entity';
import { ClientIdentityHistory } from '../../entities/client-identity-history.entity';
import { ClientMergeLog } from '../../entities/client-merge-log.entity';
import { ClientSummary } from '../../entities/client-summary.entity';
import { Client } from '../../entities/client.entity';
import { CredentialAccessLog } from '../../entities/credential-access-log.entity';
import { DictionaryItem } from '../../entities/dictionary-item.entity';
import { FinanceInvoice } from '../../entities/finance-invoice.entity';
import { FinancePayment } from '../../entities/finance-payment.entity';
import { ImportBatch } from '../../entities/import-batch.entity';
import { ImportRow } from '../../entities/import-row.entity';
import { Order } from '../../entities/order.entity';
import { ServiceCatalog } from '../../entities/service-catalog.entity';
import { ServiceItem } from '../../entities/service-item.entity';
import { User } from '../../entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { DictionariesModule } from '../dictionaries/dictionaries.module';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { SystemParametersModule } from '../system-parameters/system-parameters.module';
import { ClientCredentialsService } from './client-credentials.service';
import { ClientImportService } from './client-import.service';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client, ClientContact, ClientCredential, ClientIdentityHistory, ClientMergeLog, ClientSummary, CredentialAccessLog, DictionaryItem, FinanceInvoice, FinancePayment, ImportBatch, ImportRow, Order, ServiceCatalog, ServiceItem, User]),
    AuthModule,
    DictionariesModule,
    OperationLogsModule,
    SpreadsheetModule,
    SystemParametersModule,
  ],
  controllers: [ClientsController],
  providers: [ClientsService, ClientCredentialsService, ClientImportService],
  exports: [ClientsService],
})
export class ClientsModule {}
