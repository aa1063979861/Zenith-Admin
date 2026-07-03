import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export type AnnouncementType = '通知' | '公告' | '提醒';

@Entity('announcements', { comment: '通知公告表' })
@Index(['enabled', 'pinned', 'sort'])
@Index(['publishAt'])
@Index(['expireAt'])
export class Announcement extends BaseEntity {
  @Column({ length: 120, comment: '公告标题' })
  title: string;

  @Column({ type: 'text', comment: '公告内容' })
  content: string;

  @Column({ type: 'varchar', length: 20, default: '通知', comment: '公告类型：通知、公告、提醒' })
  type: AnnouncementType;

  @Column({ default: true, comment: '是否启用' })
  enabled: boolean;

  @Column({ default: false, comment: '是否置顶' })
  pinned: boolean;

  @Column({ default: 1, comment: '排序值' })
  sort: number;

  @Column({ type: 'datetime', nullable: true, comment: '发布时间' })
  publishAt?: Date | null;

  @Column({ type: 'datetime', nullable: true, comment: '过期时间' })
  expireAt?: Date | null;

  @Column({ type: 'int', nullable: true, comment: '创建用户ID' })
  creatorId?: number | null;

  @Column({ type: 'varchar', nullable: true, length: 120, comment: '创建用户名称' })
  creatorName?: string | null;
}
