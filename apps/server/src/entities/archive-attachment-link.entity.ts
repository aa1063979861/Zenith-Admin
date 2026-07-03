import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { ArchiveAttachment } from './archive-attachment.entity';
import { BaseEntity } from './base.entity';
import { Client } from './client.entity';

@Entity('archive_attachment_links', { comment: '资料文件业务关联表' })
@Index(['attachmentId'])
@Index(['entityType', 'entityId', 'tag'])
@Index(['clientId', 'tag'])
@Index(['serviceYear'])
export class ArchiveAttachmentLink extends BaseEntity {
  @Column({ comment: '资料文件ID' })
  attachmentId: number;

  @ManyToOne(() => ArchiveAttachment, attachment => attachment.links)
  attachment: ArchiveAttachment;

  @Column({ length: 40, comment: '关联对象类型：客户、订单、服务项、合同、发票、收款' })
  entityType: string;

  @Column({ comment: '关联对象ID' })
  entityId: number;

  @Column({ length: 255, comment: '关联对象名称快照' })
  entityName: string;

  @Column({ type: 'int', nullable: true, comment: '客户ID' })
  clientId?: number | null;

  @ManyToOne(() => Client, { nullable: true })
  client?: Client | null;

  @Column({ type: 'varchar', nullable: true, length: 255, comment: '客户单位名称快照' })
  clientName?: string | null;

  @Column({ type: 'int', nullable: true, comment: '服务年度' })
  serviceYear?: number | null;

  @Column({ length: 80, comment: '资料标签' })
  tag: string;

  @Column({ type: 'varchar', nullable: true, length: 500, comment: '关联备注' })
  remark?: string | null;
}
