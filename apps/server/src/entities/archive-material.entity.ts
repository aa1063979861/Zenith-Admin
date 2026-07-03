import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { ArchiveAttachment } from './archive-attachment.entity';
import { BaseEntity } from './base.entity';

@Entity('archive_materials', { comment: '公司资料条目表' })
@Index(['category', 'status'])
@Index(['documentType', 'status'])
@Index(['pinned', 'publishedAt'])
export class ArchiveMaterial extends BaseEntity {
  @Column({ comment: '资料文件ID' })
  attachmentId: number;

  @ManyToOne(() => ArchiveAttachment)
  attachment: ArchiveAttachment;

  @Column({ length: 255, comment: '资料标题' })
  title: string;

  @Column({ length: 80, comment: '资料分类' })
  category: string;

  @Column({ length: 80, comment: '资料类型：制度文件、操作说明、政策文件、培训资料、视频、其他' })
  documentType: string;

  @Column({ length: 40, default: 'V1', comment: '资料版本号' })
  version: string;

  @Column({ length: 40, default: '已发布', comment: '发布状态：已发布、已废止' })
  status: string;

  @Column({ type: 'boolean', default: false, comment: '是否置顶' })
  pinned: boolean;

  @Column({ type: 'date', nullable: true, comment: '生效日期' })
  effectiveDate?: string | null;

  @Column({ type: 'date', nullable: true, comment: '废止日期' })
  expiredDate?: string | null;

  @Column({ type: 'datetime', comment: '发布时间' })
  publishedAt: Date;

  @Column({ type: 'int', nullable: true, comment: '发布人用户ID' })
  publishedById?: number | null;

  @Column({ type: 'varchar', nullable: true, length: 80, comment: '发布人姓名' })
  publishedByName?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 1000, comment: '资料说明' })
  description?: string | null;
}
