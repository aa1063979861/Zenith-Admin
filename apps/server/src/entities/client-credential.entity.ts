import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Client } from './client.entity';

@Entity('client_credentials', { comment: '客户系统账号资料表' })
@Index(['clientId'])
export class ClientCredential extends BaseEntity {
  @Column({ comment: '客户ID' })
  clientId: number;

  @ManyToOne(() => Client, client => client.credentials)
  client: Client;

  @Column({ length: 120, comment: '系统名称，如资产系统、内控系统' })
  systemName: string;

  @Column({ length: 160, comment: '登录账号' })
  username: string;

  @Column({ length: 255, comment: '登录密码，按业务要求不脱敏保存和展示' })
  password: string;

  @Column({ type: 'varchar', nullable: true, length: 500, comment: '登录地址' })
  loginUrl?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 500, comment: '备注' })
  remark?: string | null;
}
