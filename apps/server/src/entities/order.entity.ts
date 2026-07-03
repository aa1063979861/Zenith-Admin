import { Column, Entity, Index, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Client } from './client.entity';
import { ServiceItem } from './service-item.entity';

@Entity('orders', { comment: '订单管理表' })
@Index(['clientId', 'serviceYear'])
@Index(['regionCode', 'serviceYear'])
@Index(['orderDate'])
@Index(['status'])
export class Order extends BaseEntity {
  @Column({ unique: true, length: 40, comment: '订单号' })
  orderNo: string;

  @Column({ comment: '关联客户ID' })
  clientId: number;

  @ManyToOne(() => Client, client => client.orders)
  client: Client;

  @Column({ length: 120, comment: '下单时区划编码快照' })
  regionCode: string;

  @Column({ length: 160, comment: '下单时区划名称快照' })
  regionName: string;

  @Column({ length: 6, comment: '下单时单位编码快照' })
  unitCode: string;

  @Column({ length: 255, comment: '下单时单位名称快照' })
  unitName: string;

  @Column({ comment: '服务年度' })
  serviceYear: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, comment: '打包价金额' })
  packageAmount: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, comment: '订单应收金额' })
  billableAmount: string;

  @Column({ type: 'date', comment: '接单日期' })
  orderDate: string;

  @Column({ length: 40, default: '履约中', comment: '订单状态' })
  status: string;

  @Column({ type: 'datetime', nullable: true, comment: '订单完成时间' })
  completedAt?: Date | null;

  @Column({ type: 'datetime', nullable: true, comment: '订单取消时间' })
  canceledAt?: Date | null;

  @Column({ type: 'varchar', nullable: true, length: 500, comment: '订单取消原因' })
  cancelReason?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 500, comment: '订单备注' })
  remark?: string | null;

  @OneToMany(() => ServiceItem, serviceItem => serviceItem.order)
  serviceItems: ServiceItem[];
}
