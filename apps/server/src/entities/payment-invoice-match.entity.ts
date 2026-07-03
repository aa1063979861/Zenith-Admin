import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { FinanceInvoice } from './finance-invoice.entity';
import { FinancePayment } from './finance-payment.entity';
import { PaymentServiceAllocation } from './payment-service-allocation.entity';
import { User } from './user.entity';

@Entity('payment_invoice_matches', { comment: '收款发票匹配表' })
@Index(['paymentId'])
@Index(['invoiceId'])
export class PaymentInvoiceMatch extends BaseEntity {
  @Column({ comment: '收款ID' })
  paymentId: number;

  @ManyToOne(() => FinancePayment, payment => payment.invoiceMatches)
  payment: FinancePayment;

  @Column({ comment: '发票ID' })
  invoiceId: number;

  @ManyToOne(() => FinanceInvoice, invoice => invoice.paymentMatches)
  invoice: FinanceInvoice;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, comment: '本次匹配金额' })
  matchedAmount: string;

  @Column({ type: 'int', nullable: true, comment: '匹配人用户ID' })
  matchedBy?: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'matchedBy' })
  matchedUser?: User | null;

  @Column({ type: 'datetime', comment: '匹配时间' })
  matchedAt: Date;

  @Column({ type: 'varchar', nullable: true, length: 500, comment: '匹配备注' })
  remark?: string | null;

  @OneToMany(() => PaymentServiceAllocation, allocation => allocation.paymentInvoiceMatch)
  allocations: PaymentServiceAllocation[];
}
