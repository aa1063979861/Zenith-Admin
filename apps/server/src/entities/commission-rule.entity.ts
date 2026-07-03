import { Column, Entity } from 'typeorm';
import { BaseEntity } from './base.entity';

export type CommissionRoleType = 'receiver' | 'performer';
export type CommissionBaseType = 'received_amount' | 'billable_amount' | 'allocated_amount';

@Entity('commission_rules', { comment: '提成规则表' })
export class CommissionRule extends BaseEntity {
  @Column({ length: 120, comment: '规则名称' })
  title: string;

  @Column({ type: 'varchar', length: 30, comment: '提成角色：receiver接单人，performer完成人' })
  roleType: CommissionRoleType;

  @Column({ type: 'varchar', nullable: true, length: 120, comment: '适用服务项编码，空表示全部服务项' })
  serviceCode?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 160, comment: '适用服务项名称，空表示全部服务项' })
  serviceName?: string | null;

  @Column({ type: 'varchar', length: 40, default: 'received_amount', comment: '提成基数：received_amount已收金额，billable_amount应收金额，allocated_amount分摊金额' })
  baseType: CommissionBaseType;

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 0, comment: '提成比例，小数形式，例如0.064表示6.4%' })
  rate: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, comment: '固定提成金额' })
  fixedAmount: string;

  @Column({ type: 'date', nullable: true, comment: '生效开始日期' })
  effectiveFrom?: string | null;

  @Column({ type: 'date', nullable: true, comment: '生效结束日期' })
  effectiveTo?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 500, comment: '规则说明' })
  note?: string | null;

  @Column({ default: true, comment: '是否启用' })
  enabled: boolean;

  @Column({ default: 0, comment: '排序值' })
  sort: number;
}
