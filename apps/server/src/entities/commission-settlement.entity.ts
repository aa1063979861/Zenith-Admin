import { Column, Entity, Index, ManyToOne, OneToMany } from 'typeorm';
import { COMMISSION_SETTLEMENT_STATUS, CommissionSettlementStatus } from '../common/business.constants';
import { BaseEntity } from './base.entity';
import { CommissionLine } from './commission-line.entity';
import { User } from './user.entity';

export type { CommissionSettlementStatus } from '../common/business.constants';

@Entity('commission_settlements', { comment: '提成结算单表' })
@Index(['employeeId', 'periodStart', 'periodEnd'])
@Index(['status'])
export class CommissionSettlement extends BaseEntity {
  @Column({ comment: '员工用户ID' })
  employeeId: number;

  @ManyToOne(() => User)
  employee: User;

  @Column({ length: 80, comment: '员工姓名' })
  employeeName: string;

  @Column({ type: 'int', nullable: true, comment: '服务年度筛选，空表示全部年度' })
  serviceYear?: number | null;

  @Column({ type: 'varchar', nullable: true, length: 120, comment: '服务项编码筛选，空表示全部服务项' })
  serviceCode?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 160, comment: '服务项名称筛选，空表示全部服务项' })
  serviceName?: string | null;

  @Column({ type: 'date', comment: '结算开始日期' })
  periodStart: string;

  @Column({ type: 'date', comment: '结算结束日期' })
  periodEnd: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, comment: '提成合计金额' })
  totalAmount: string;

  @Column({ type: 'varchar', length: 30, default: COMMISSION_SETTLEMENT_STATUS.DRAFT, comment: '结算状态：draft草稿，confirmed已确认，paid已发放，cancelled已取消' })
  status: CommissionSettlementStatus;

  @Column({ type: 'int', nullable: true, comment: '确认人用户ID' })
  confirmedBy?: number | null;

  @Column({ type: 'datetime', nullable: true, comment: '确认时间' })
  confirmedAt?: Date | null;

  @Column({ type: 'datetime', nullable: true, comment: '发放时间' })
  paidAt?: Date | null;

  @Column({ type: 'datetime', nullable: true, comment: '取消时间' })
  cancelledAt?: Date | null;

  @OneToMany(() => CommissionLine, line => line.settlement)
  lines: CommissionLine[];
}
