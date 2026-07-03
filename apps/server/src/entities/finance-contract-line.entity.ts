import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { FinanceContract } from './finance-contract.entity';
import { ServiceItem } from './service-item.entity';

@Entity('finance_contract_lines', { comment: '财务合同服务项明细表' })
@Index(['contractId'])
@Index(['orderServiceItemId'])
export class FinanceContractLine extends BaseEntity {
  @Column({ comment: '合同ID' })
  contractId: number;

  @ManyToOne(() => FinanceContract, contract => contract.lines)
  contract: FinanceContract;

  @Column({ name: 'order_service_item_id', comment: '订单服务项ID' })
  orderServiceItemId: number;

  @ManyToOne(() => ServiceItem)
  @JoinColumn({ name: 'order_service_item_id' })
  serviceItem: ServiceItem;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, comment: '合同分摊金额' })
  amount: string;

  @Column({ type: 'varchar', nullable: true, length: 255, comment: '合同明细说明' })
  description?: string | null;
}
