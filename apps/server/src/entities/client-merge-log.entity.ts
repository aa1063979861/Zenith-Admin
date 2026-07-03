import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('client_merge_logs', { comment: '客户合并日志表' })
@Index(['sourceClientId'])
@Index(['targetClientId'])
export class ClientMergeLog extends BaseEntity {
  @Column({ comment: '被合并客户ID' })
  sourceClientId: number;

  @Column({ comment: '合并后单位ID' })
  targetClientId: number;

  @Column({ length: 255, comment: '被合并客户名称' })
  sourceClientName: string;

  @Column({ length: 255, comment: '合并后单位名称' })
  targetClientName: string;

  @Column({ type: 'varchar', nullable: true, length: 500, comment: '合并原因' })
  reason?: string | null;

  @Column({ type: 'json', nullable: true, comment: '合并影响数据摘要JSON' })
  movedSummary?: Record<string, number> | null;

  @Column({ type: 'json', nullable: true, comment: '合并迁移数据明细JSON，用于安全撤销' })
  movedDetails?: Record<string, unknown> | null;

  @Column({ type: 'datetime', nullable: true, comment: '撤销时间' })
  revertedAt?: Date | null;

  @Column({ type: 'int', nullable: true, comment: '撤销用户ID' })
  revertedById?: number | null;

  @Column({ type: 'varchar', nullable: true, length: 80, comment: '撤销用户姓名' })
  revertedByName?: string | null;

  @Column({ type: 'int', nullable: true, comment: '操作用户ID' })
  operatorId?: number | null;

  @Column({ type: 'varchar', nullable: true, length: 80, comment: '操作用户姓名' })
  operatorName?: string | null;
}
