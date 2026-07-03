import { Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Client } from './client.entity';

@Entity('client_summaries', { comment: '客户列表摘要读模型表' })
@Index(['clientId'], { unique: true })
export class ClientSummary extends BaseEntity {
  @Column({ comment: '客户ID' })
  clientId: number;

  @OneToOne(() => Client, client => client.summary)
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column({ default: 0, comment: '订单数量' })
  orderCount: number;

  @Column({ default: 0, comment: '服务项数量' })
  serviceItemCount: number;

  @Column({ default: 0, comment: '联系人数量' })
  contactCount: number;

  @Column({ default: 0, comment: '账号资料数量' })
  credentialCount: number;

  @Column({ type: 'date', nullable: true, comment: '最近订单日期' })
  latestOrderDate?: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, comment: '累计应收金额' })
  receivableAmount: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, comment: '累计已收金额' })
  receivedAmount: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, comment: '未收金额' })
  unpaidAmount: string;
}
