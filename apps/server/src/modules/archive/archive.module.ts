import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArchiveAttachmentLink } from '../../entities/archive-attachment-link.entity';
import { ArchiveMaterial } from '../../entities/archive-material.entity';
import { ArchiveAttachment } from '../../entities/archive-attachment.entity';
import { ArchiveWeeklyReport } from '../../entities/archive-weekly-report.entity';
import { Client } from '../../entities/client.entity';
import { FinanceContractLine } from '../../entities/finance-contract-line.entity';
import { FinanceContract } from '../../entities/finance-contract.entity';
import { FinanceInvoiceLine } from '../../entities/finance-invoice-line.entity';
import { FinanceInvoice } from '../../entities/finance-invoice.entity';
import { FinancePayment } from '../../entities/finance-payment.entity';
import { Order } from '../../entities/order.entity';
import { ServiceItem } from '../../entities/service-item.entity';
import { AuthModule } from '../auth/auth.module';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { SystemParametersModule } from '../system-parameters/system-parameters.module';
import { ArchiveController } from './archive.controller';
import { ArchiveService } from './archive.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ArchiveAttachment,
      ArchiveAttachmentLink,
      ArchiveMaterial,
      ArchiveWeeklyReport,
      Client,
      Order,
      ServiceItem,
      FinanceContract,
      FinanceContractLine,
      FinanceInvoice,
      FinanceInvoiceLine,
      FinancePayment,
    ]),
    AuthModule,
    OperationLogsModule,
    SystemParametersModule,
  ],
  controllers: [ArchiveController],
  providers: [ArchiveService],
  exports: [ArchiveService],
})
export class ArchiveModule {}
