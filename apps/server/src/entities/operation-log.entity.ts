import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('operation_logs', { comment: '系统操作审计日志表' })
@Index(['module', 'action'])
@Index(['targetType', 'targetId'])
@Index(['userId'])
export class OperationLog extends BaseEntity {
  @Column({ length: 80, comment: '业务模块' })
  module: string;

  @Column({ length: 80, comment: '操作动作' })
  action: string;

  @Column({ length: 80, comment: '目标类型' })
  targetType: string;

  @Column({ type: 'varchar', nullable: true, length: 80, comment: '目标ID' })
  targetId?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 255, comment: '目标名称' })
  targetName?: string | null;

  @Column({ type: 'int', nullable: true, comment: '操作用户ID' })
  userId?: number | null;

  @Column({ type: 'varchar', nullable: true, length: 80, comment: '操作用户姓名' })
  username?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 120, comment: '操作用户显示名称' })
  userDisplayName?: string | null;

  @Column({ type: 'json', nullable: true, comment: '操作摘要JSON' })
  detailJson?: Record<string, unknown> | null;

  @Column({ type: 'varchar', nullable: true, length: 80, comment: 'IP地址' })
  ipAddress?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 500, comment: '用户代理' })
  userAgent?: string | null;
}
