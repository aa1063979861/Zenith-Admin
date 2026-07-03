import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Order } from './order.entity';
import { User } from './user.entity';

@Entity('service_items', { comment: '订单服务项表' })
@Index(['orderId'])
@Index(['clientId'])
@Index(['unitCode', 'unitName'])
@Index(['regionCode', 'serviceYear'])
@Index(['receiverId'])
@Index(['performerId'])
@Index(['status'])
@Index(['serviceEndDate'])
@Index(['renewalStatus'])
@Index(['renewalReminderDate'])
export class ServiceItem extends BaseEntity {
  @Column({ comment: '订单ID' })
  orderId: number;

  @ManyToOne(() => Order, order => order.serviceItems)
  order: Order;

  @Column({ comment: '关联客户ID' })
  clientId: number;

  @Column({ length: 40, comment: '订单号' })
  orderNo: string;

  @Column({ length: 120, comment: '订单创建时区划编码快照' })
  regionCode: string;

  @Column({ length: 160, comment: '订单创建时区划名称快照' })
  regionName: string;

  @Column({ length: 6, comment: '订单创建时单位编码快照' })
  unitCode: string;

  @Column({ length: 255, comment: '订单创建时单位名称快照' })
  unitName: string;

  @Column({ length: 120, comment: '服务项编码，来源于服务目录' })
  serviceCode: string;

  @Column({ length: 160, comment: '服务项名称' })
  serviceName: string;

  @Column({ comment: '服务年度' })
  serviceYear: number;

  @Column({ comment: '接单人用户ID' })
  receiverId: number;

  @ManyToOne(() => User)
  receiver: User;

  @Column({ length: 80, comment: '接单人姓名' })
  receiverName: string;

  @Column({ comment: '完成人用户ID' })
  performerId: number;

  @ManyToOne(() => User)
  performer: User;

  @Column({ length: 80, comment: '完成人姓名' })
  performerName: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, comment: '订单打包价手动分摊金额' })
  allocatedAmount: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, comment: '服务项应收金额' })
  billableAmount: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, comment: '服务项已收金额' })
  receivedAmount: string;

  @Column({ length: 40, default: '进行中', comment: '服务项状态' })
  status: string;

  @Column({ type: 'datetime', nullable: true, comment: '服务项状态更新时间' })
  statusUpdatedAt?: Date | null;

  @Column({ type: 'date', nullable: true, comment: '服务开始日期' })
  serviceStartDate?: string | null;

  @Column({ type: 'date', nullable: true, comment: '服务到期日期' })
  serviceEndDate?: string | null;

  @Column({ type: 'date', nullable: true, comment: '服务完成日期' })
  completedAt?: string | null;

  @Column({ length: 40, default: '无需续签', comment: '续签状态：无需续签、未到期、待续签、已续签、不续签、已终止' })
  renewalStatus: string;

  @Column({ type: 'int', nullable: true, comment: '续签来源服务项ID' })
  renewalOfServiceItemId?: number | null;

  @Column({ type: 'int', nullable: true, comment: '已续签生成的服务项ID' })
  renewedByServiceItemId?: number | null;

  @Column({ type: 'date', nullable: true, comment: '续签提醒日期' })
  renewalReminderDate?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 500, comment: '续签备注' })
  renewalRemark?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 1000, comment: '上报情况说明' })
  reportSummary?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 1000, comment: '存在问题说明' })
  problemDescription?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 1000, comment: '完成证明链接或归档路径' })
  proofUrl?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 500, comment: '服务项备注' })
  remark?: string | null;
}
