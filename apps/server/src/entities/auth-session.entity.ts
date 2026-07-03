import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity('sys_auth_sessions', { comment: '用户登录会话表' })
@Index(['userId'])
@Index(['refreshTokenHash'], { unique: true })
export class AuthSession extends BaseEntity {
  @Column({ comment: '用户ID' })
  userId: number;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'char', length: 64, comment: '刷新令牌哈希' })
  refreshTokenHash: string;

  @Column({ type: 'datetime', comment: '过期时间' })
  expiresAt: Date;

  @Column({ type: 'datetime', nullable: true, comment: '撤销时间' })
  revokedAt?: Date | null;

  @Column({ type: 'datetime', nullable: true, comment: '最后使用时间' })
  lastUsedAt?: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true, comment: '当前角色编码' })
  currentRoleCode?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: '用户代理' })
  userAgent?: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true, comment: 'IP地址' })
  ipAddress?: string | null;
}
