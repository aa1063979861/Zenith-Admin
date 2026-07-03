import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { FinanceInvoiceLine } from './finance-invoice-line.entity';
import { PaymentInvoiceMatch } from './payment-invoice-match.entity';
import { ServiceItem } from './service-item.entity';

@Entity('payment_service_allocations', { comment: '收款服务项分摊表' })
@Index(['paymentInvoiceMatchId'])
@Index(['invoiceLineId'])
@Index(['orderServiceItemId'])
export class PaymentServiceAllocation extends BaseEntity {
  @Column({ comment: '收款发票匹配ID' })
  paymentInvoiceMatchId: number;

  @ManyToOne(() => PaymentInvoiceMatch, match => match.allocations)
  paymentInvoiceMatch: PaymentInvoiceMatch;

  @Column({ comment: '发票明细ID' })
  invoiceLineId: number;

  @ManyToOne(() => FinanceInvoiceLine)
  invoiceLine: FinanceInvoiceLine;

  @Column({ name: 'order_service_item_id', comment: '订单服务项ID' })
  orderServiceItemId: number;

  @ManyToOne(() => ServiceItem)
  @JoinColumn({ name: 'order_service_item_id' })
  serviceItem: ServiceItem;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, comment: '收款分摊金额' })
  allocatedAmount: string;
}
