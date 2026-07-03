import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { CommissionBaseType, CommissionRoleType } from './commission-rule.entity';
import { CommissionSettlement } from './commission-settlement.entity';
import { PaymentServiceAllocation } from './payment-service-allocation.entity';
import { ServiceItem } from './service-item.entity';

@Entity('commission_lines', { comment: '提成结算明细表' })
@Index(['settlementId'])
@Index(['orderServiceItemId', 'roleType'])
@Index(['employeeId'])
export class CommissionLine extends BaseEntity {
  @Column({ comment: '结算单ID' })
  settlementId: number;

  @ManyToOne(() => CommissionSettlement, settlement => settlement.lines)
  settlement: CommissionSettlement;

  @Column({ name: 'order_service_item_id', comment: '订单服务项ID' })
  orderServiceItemId: number;

  @ManyToOne(() => ServiceItem)
  @JoinColumn({ name: 'order_service_item_id' })
  serviceItem: ServiceItem;

  @Column({ type: 'int', nullable: true, comment: '收款服务项分摊ID，按已收金额结算时可关联' })
  paymentServiceAllocationId?: number | null;

  @ManyToOne(() => PaymentServiceAllocation, { nullable: true })
  @JoinColumn({ name: 'paymentServiceAllocationId' })
  paymentServiceAllocation?: PaymentServiceAllocation | null;

  @Column({ comment: '员工用户ID' })
  employeeId: number;

  @Column({ length: 80, comment: '员工姓名' })
  employeeName: string;

  @Column({ type: 'varchar', length: 30, comment: '提成角色：receiver接单人，performer完成人' })
  roleType: CommissionRoleType;

  @Column({ type: 'int', nullable: true, comment: '提成规则ID' })
  ruleId?: number | null;

  @Column({ type: 'varchar', nullable: true, length: 120, comment: '提成规则名称' })
  ruleTitle?: string | null;

  @Column({ type: 'varchar', length: 40, comment: '提成基数类型' })
  baseType: CommissionBaseType;

  @Column({ length: 40, comment: '订单号' })
  orderNo: string;

  @Column({ comment: '服务年度' })
  serviceYear: number;

  @Column({ length: 160, comment: '结算时服务项区划名称快照' })
  regionName: string;

  @Column({ length: 6, comment: '结算时服务项单位编码快照' })
  unitCode: string;

  @Column({ length: 255, comment: '结算时服务项单位名称快照' })
  clientName: string;

  @Column({ length: 120, comment: '服务项编码' })
  serviceCode: string;

  @Column({ length: 160, comment: '服务项名称' })
  serviceName: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, comment: '提成基数金额' })
  baseAmount: string;

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 0, comment: '提成比例' })
  rate: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, comment: '固定提成金额' })
  fixedAmount: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, comment: '提成金额' })
  commissionAmount: string;
}
