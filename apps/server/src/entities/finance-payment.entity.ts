import { Column, Entity, Index, ManyToOne, OneToMany } from 'typeorm';
import { PAYMENT_MATCH_STATUS, PaymentMatchStatus } from '../common/business.constants';
import { BaseEntity } from './base.entity';
import { Client } from './client.entity';
import { FinanceInvoice } from './finance-invoice.entity';
import { PaymentInvoiceMatch } from './payment-invoice-match.entity';

@Entity('finance_payments', { comment: '财务收款表' })
@Index(['clientId', 'paymentDate'])
@Index(['matchStatus', 'paymentDate'])
@Index(['bankSerialNo'])
export class FinancePayment extends BaseEntity {
  @Column({ type: 'date', comment: '收款日期' })
  paymentDate: string;

  @Column({ type: 'int', nullable: true, comment: '客户ID' })
  clientId?: number | null;

  @ManyToOne(() => Client, { nullable: true })
  client?: Client | null;

  @Column({ type: 'varchar', nullable: true, length: 255, comment: '客户单位名称' })
  clientName?: string | null;

  @Column({ length: 255, comment: '付款方名称' })
  payerName: string;

  @Column({ type: 'varchar', nullable: true, length: 500, comment: '银行备注' })
  bankRemark?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 120, comment: '收款账户' })
  bankAccount?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 120, comment: '银行流水号' })
  bankSerialNo?: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, comment: '收款金额' })
  amount: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, comment: '已匹配发票金额' })
  matchedAmount: string;

  @Column({ length: 40, default: PAYMENT_MATCH_STATUS.PENDING, comment: '匹配状态' })
  matchStatus: PaymentMatchStatus;

  @Column({ type: 'int', nullable: true, comment: '匹配发票ID' })
  matchedInvoiceId?: number | null;

  @ManyToOne(() => FinanceInvoice, { nullable: true })
  matchedInvoice?: FinanceInvoice | null;

  @Column({ type: 'varchar', nullable: true, length: 500, comment: '收款备注' })
  remark?: string | null;

  @OneToMany(() => PaymentInvoiceMatch, match => match.payment)
  invoiceMatches: PaymentInvoiceMatch[];
}
