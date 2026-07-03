import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('credential_access_logs', { comment: '客户账号资料访问日志表' })
@Index(['clientId', 'createTime'])
@Index(['userId', 'createTime'])
export class CredentialAccessLog extends BaseEntity {
  @Column({ comment: '客户ID' })
  clientId: number;

  @Column({ comment: '访问用户ID' })
  userId: number;

  @Column({ length: 80, comment: '访问用户姓名' })
  username: string;

  @Column({ length: 40, default: 'VIEW', comment: '访问动作：VIEW查看，COPY复制，UPDATE修改，DELETE删除' })
  action: string;

  @Column({ type: 'varchar', nullable: true, length: 500, comment: '日志备注' })
  remark?: string | null;
}
