import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../../entities/client.entity';
import { FinanceInvoiceLine } from '../../entities/finance-invoice-line.entity';
import { FinanceInvoice } from '../../entities/finance-invoice.entity';
import { FinancePayment } from '../../entities/finance-payment.entity';
import { Order } from '../../entities/order.entity';
import { PaymentServiceAllocation } from '../../entities/payment-service-allocation.entity';
import { ServiceItem } from '../../entities/service-item.entity';
import { AuthModule } from '../auth/auth.module';
import { SystemParametersModule } from '../system-parameters/system-parameters.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client, Order, ServiceItem, FinanceInvoice, FinanceInvoiceLine, FinancePayment, PaymentServiceAllocation]),
    AuthModule,
    SystemParametersModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
