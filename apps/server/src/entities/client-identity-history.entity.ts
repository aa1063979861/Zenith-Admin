import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Client } from './client.entity';

@Entity('client_identity_histories', { comment: '客户单位身份变更历史表' })
@Index(['clientId', 'createTime'])
export class ClientIdentityHistory extends BaseEntity {
  @Column({ comment: '客户ID' })
  clientId: number;

  @ManyToOne(() => Client, client => client.identityHistories)
  client: Client;

  @Column({ length: 120, comment: '变更前区划编码' })
  oldRegionCode: string;

  @Column({ length: 160, comment: '变更前区划名称' })
  oldRegionName: string;

  @Column({ length: 6, comment: '变更前单位编码' })
  oldUnitCode: string;

  @Column({ length: 255, comment: '变更前单位名称' })
  oldUnitName: string;

  @Column({ length: 120, comment: '变更后区划编码' })
  newRegionCode: string;

  @Column({ length: 160, comment: '变更后区划名称' })
  newRegionName: string;

  @Column({ length: 6, comment: '变更后单位编码' })
  newUnitCode: string;

  @Column({ length: 255, comment: '变更后单位名称' })
  newUnitName: string;

  @Column({ length: 500, comment: '变更原因' })
  reason: string;

  @Column({ type: 'int', nullable: true, comment: '操作用户ID' })
  operatorId?: number | null;

  @Column({ type: 'varchar', nullable: true, length: 80, comment: '操作用户姓名' })
  operatorName?: string | null;
}
