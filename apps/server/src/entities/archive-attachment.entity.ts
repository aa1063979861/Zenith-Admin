import { Column, Entity, Index, ManyToOne, OneToMany } from 'typeorm';
import { ArchiveAttachmentLink } from './archive-attachment-link.entity';
import { BaseEntity } from './base.entity';
import { Client } from './client.entity';

@Entity('archive_attachments', { comment: '资料中心文件表' })
@Index(['clientId', 'tag'])
@Index(['linkedType', 'linkedId', 'tag'])
@Index(['sha256'])
@Index(['uploadedAt'])
export class ArchiveAttachment extends BaseEntity {
  @Column({ length: 255, comment: '文件名称' })
  name: string;

  @Column({ type: 'varchar', nullable: true, length: 255, comment: '原始文件名' })
  originalName?: string | null;

  @Column({ length: 80, comment: '附件标签' })
  tag: string;

  @Column({ type: 'varchar', nullable: true, length: 40, comment: '文件类型：文档、图片、表格、视频、其他' })
  fileKind?: string | null;

  @Column({ type: 'int', nullable: true, comment: '客户ID' })
  clientId?: number | null;

  @ManyToOne(() => Client, { nullable: true })
  client?: Client | null;

  @Column({ type: 'varchar', nullable: true, length: 255, comment: '关联对象名称' })
  linkedName?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 80, comment: '关联对象类型' })
  linkedType?: string | null;

  @Column({ type: 'int', nullable: true, comment: '关联对象ID' })
  linkedId?: number | null;

  @Column({ type: 'varchar', nullable: true, length: 1000, comment: '附件访问地址或存储路径' })
  fileUrl?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 1000, comment: '相对存储Key' })
  storageKey?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 30, comment: '文件扩展名' })
  fileExt?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 120, comment: 'MIME类型' })
  mimeType?: string | null;

  @Column({ type: 'bigint', default: 0, comment: '文件大小字节数' })
  sizeBytes: string;

  @Column({ type: 'char', nullable: true, length: 64, comment: '文件SHA256哈希' })
  sha256?: string | null;

  @Column({ type: 'int', nullable: true, comment: '上传人用户ID' })
  uploadedById?: number | null;

  @Column({ type: 'varchar', nullable: true, length: 80, comment: '上传人姓名' })
  uploadedByName?: string | null;

  @Column({ type: 'datetime', comment: '上传时间' })
  uploadedAt: Date;

  @Column({ type: 'varchar', nullable: true, length: 500, comment: '附件备注' })
  remark?: string | null;

  @OneToMany(() => ArchiveAttachmentLink, link => link.attachment)
  links: ArchiveAttachmentLink[];
}
