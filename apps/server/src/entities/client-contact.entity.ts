import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { ClientContactRole } from '../common/business.constants';
import { BaseEntity } from './base.entity';
import { Client } from './client.entity';

export type { ClientContactRole } from '../common/business.constants';

@Entity('client_contacts', { comment: '客户联系人表' })
@Index(['clientId', 'isPrimary'])
@Index(['clientId', 'role'])
export class ClientContact extends BaseEntity {
  @Column({ comment: '客户ID' })
  clientId: number;

  @ManyToOne(() => Client, client => client.contacts)
  client: Client;

  @Column({ length: 40, comment: '联系人角色' })
  role: ClientContactRole;

  @Column({ length: 80, comment: '联系人姓名' })
  name: string;

  @Column({ type: 'varchar', nullable: true, length: 80, comment: '联系人部门' })
  department?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 40, comment: '联系电话' })
  phone?: string | null;

  @Column({ default: false, comment: '是否主要联系人' })
  isPrimary: boolean;

  @Column({ type: 'varchar', nullable: true, length: 500, comment: '备注' })
  remark?: string | null;
}
