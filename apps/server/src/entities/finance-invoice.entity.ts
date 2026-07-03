import { Column, Entity, Index, ManyToOne, OneToMany } from 'typeorm';
import { INVOICE_DELIVERY_STATUSES, INVOICE_PAYMENT_STATUS, INVOICE_STATUS, InvoiceDeliveryStatus, InvoicePaymentStatus, InvoiceStatus } from '../common/business.constants';
import { BaseEntity } from './base.entity';
import { Client } from './client.entity';
import { FinanceContract } from './finance-contract.entity';
import { FinanceInvoiceLine } from './finance-invoice-line.entity';
import { PaymentInvoiceMatch } from './payment-invoice-match.entity';

@Entity('finance_invoices', { comment: '财务发票表' })
@Index(['clientId', 'invoiceDate'])
@Index(['status', 'invoiceDate'])
@Index(['paymentStatus', 'invoiceDate'])
@Index(['deliveryStatus', 'invoiceDate'])
export class FinanceInvoice extends BaseEntity {
  @Column({ unique: true, length: 80, comment: '发票号码' })
  invoiceNo: string;

  @Column({ comment: '客户ID' })
  clientId: number;

  @ManyToOne(() => Client)
  client: Client;

  @Column({ type: 'int', nullable: true, comment: '关联合同ID，可为空' })
  contractId?: number | null;

  @ManyToOne(() => FinanceContract, { nullable: true })
  contract?: FinanceContract | null;

  @Column({ length: 255, comment: '客户单位名称' })
  clientName: string;

  @Column({ type: 'varchar', nullable: true, length: 255, comment: '购买方名称' })
  buyerName?: string | null;

  @Column({ type: 'date', comment: '开票日期' })
  invoiceDate: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, comment: '发票金额' })
  invoiceAmount: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, comment: '已匹配收款金额' })
  matchedAmount: string;

  @Column({ length: 40, default: INVOICE_DELIVERY_STATUSES[0], comment: '送达状态' })
  deliveryStatus: InvoiceDeliveryStatus;

  @Column({ length: 40, default: INVOICE_PAYMENT_STATUS.PENDING, comment: '付款状态' })
  paymentStatus: InvoicePaymentStatus;

  @Column({ length: 40, default: INVOICE_STATUS.ISSUED, comment: '发票状态：已开具、已作废' })
  status: InvoiceStatus;

  @Column({ type: 'varchar', nullable: true, length: 500, comment: '发票备注' })
  remark?: string | null;

  @OneToMany(() => FinanceInvoiceLine, line => line.invoice)
  lines: FinanceInvoiceLine[];

  @OneToMany(() => PaymentInvoiceMatch, match => match.invoice)
  paymentMatches: PaymentInvoiceMatch[];
}
