import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { FinanceInvoice } from './finance-invoice.entity';
import { ServiceItem } from './service-item.entity';

@Entity('finance_invoice_lines', { comment: '财务发票服务项明细表' })
@Index(['invoiceId'])
@Index(['orderServiceItemId'])
export class FinanceInvoiceLine extends BaseEntity {
  @Column({ comment: '发票ID' })
  invoiceId: number;

  @ManyToOne(() => FinanceInvoice, invoice => invoice.lines)
  invoice: FinanceInvoice;

  @Column({ name: 'order_service_item_id', comment: '订单服务项ID' })
  orderServiceItemId: number;

  @ManyToOne(() => ServiceItem)
  @JoinColumn({ name: 'order_service_item_id' })
  serviceItem: ServiceItem;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, comment: '发票分摊金额' })
  amount: string;

  @Column({ type: 'varchar', nullable: true, length: 255, comment: '发票明细说明' })
  description?: string | null;
}
