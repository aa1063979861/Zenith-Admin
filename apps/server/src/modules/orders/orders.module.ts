import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArchiveAttachmentLink } from '../../entities/archive-attachment-link.entity';
import { Client } from '../../entities/client.entity';
import { ArchiveAttachment } from '../../entities/archive-attachment.entity';
import { FinanceContractLine } from '../../entities/finance-contract-line.entity';
import { FinanceInvoiceLine } from '../../entities/finance-invoice-line.entity';
import { Order } from '../../entities/order.entity';
import { ServiceItem } from '../../entities/service-item.entity';
import { User } from '../../entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { ClientsModule } from '../clients/clients.module';
import { DictionariesModule } from '../dictionaries/dictionaries.module';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { ServiceCatalogModule } from '../service-catalog/service-catalog.module';
import { SystemParametersModule } from '../system-parameters/system-parameters.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ServiceItemsService } from './service-items.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, ServiceItem, Client, User, ArchiveAttachment, ArchiveAttachmentLink, FinanceContractLine, FinanceInvoiceLine]),
    AuthModule,
    ClientsModule,
    DictionariesModule,
    OperationLogsModule,
    ServiceCatalogModule,
    SystemParametersModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, ServiceItemsService],
})
export class OrdersModule {}
