import { Column, Entity, Index, ManyToOne, OneToMany } from 'typeorm';
import { CONTRACT_STATUS, ContractStatus } from '../common/business.constants';
import { BaseEntity } from './base.entity';
import { Client } from './client.entity';
import { FinanceContractLine } from './finance-contract-line.entity';

@Entity('finance_contracts', { comment: '财务合同表' })
@Index(['clientId', 'signedAt'])
@Index(['contractNo'], { unique: true })
@Index(['status', 'signedAt'])
export class FinanceContract extends BaseEntity {
  @Column({ length: 80, comment: '合同编号' })
  contractNo: string;

  @Column({ comment: '客户ID' })
  clientId: number;

  @ManyToOne(() => Client)
  client: Client;

  @Column({ length: 255, comment: '签订时客户单位名称快照' })
  clientName: string;

  @Column({ length: 255, comment: '合同名称' })
  title: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, comment: '合同金额' })
  totalAmount: string;

  @Column({ type: 'date', nullable: true, comment: '签订日期' })
  signedAt?: string | null;

  @Column({ type: 'date', nullable: true, comment: '合同服务开始日期' })
  startsAt?: string | null;

  @Column({ type: 'date', nullable: true, comment: '合同服务结束日期' })
  endsAt?: string | null;

  @Column({ length: 40, default: CONTRACT_STATUS.SIGNED, comment: '合同状态：草稿、已签订、已作废' })
  status: ContractStatus;

  @Column({ type: 'varchar', nullable: true, length: 500, comment: '合同备注' })
  remark?: string | null;

  @OneToMany(() => FinanceContractLine, line => line.contract)
  lines: FinanceContractLine[];
}
