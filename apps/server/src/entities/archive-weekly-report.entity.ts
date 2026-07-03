import { Column, Entity, Index } from 'typeorm';
import { ARCHIVE_WEEKLY_REPORT_SOURCE_TYPE, ARCHIVE_WEEKLY_REPORT_STATUS } from '../common/business.constants';
import { BaseEntity } from './base.entity';

export type WeeklyDayWork = {
  date: string;
  weekday: string;
  content: string;
};

@Entity('archive_weekly_reports', { comment: '周报汇总表' })
@Index('IDX_archive_weekly_week_owner_unique', ['weekStart', 'ownerUserId'], { unique: true })
@Index('IDX_archive_weekly_status_week', ['status', 'weekStart'])
@Index('IDX_archive_weekly_owner_week', ['ownerUserId', 'weekStart'])
export class ArchiveWeeklyReport extends BaseEntity {
  @Column({ comment: '周报所属用户ID' })
  ownerUserId: number;

  @Column({ length: 80, comment: '周报所属员工姓名' })
  ownerName: string;

  @Column({ type: 'varchar', nullable: true, length: 120, comment: '所属部门名称快照' })
  departmentName?: string | null;

  @Column({ type: 'date', comment: '周开始日期' })
  weekStart: string;

  @Column({ type: 'date', comment: '周结束日期' })
  weekEnd: string;

  @Column({ length: 255, comment: '周报标题' })
  title: string;

  @Column({ type: 'longtext', nullable: true, comment: '本周完成事项' })
  completedWork?: string | null;

  @Column({ type: 'json', nullable: true, comment: '每日工作内容JSON，含日期、星期和内容' })
  dailyWork?: WeeklyDayWork[] | null;

  @Column({ type: 'longtext', nullable: true, comment: '本周总结' })
  weeklySummary?: string | null;

  @Column({ type: 'longtext', nullable: true, comment: '问题和风险' })
  blockers?: string | null;

  @Column({ type: 'longtext', nullable: true, comment: '下周计划' })
  nextPlan?: string | null;

  @Column({ type: 'json', nullable: true, comment: '系统生成依据JSON' })
  generatedJson?: Record<string, unknown> | null;

  @Column({ length: 40, default: ARCHIVE_WEEKLY_REPORT_SOURCE_TYPE.MANUAL, comment: '来源类型：手工填写、系统生成' })
  sourceType: string;

  @Column({ length: 40, default: ARCHIVE_WEEKLY_REPORT_STATUS.DRAFT, comment: '周报状态：草稿、已提交' })
  status: string;

  @Column({ type: 'datetime', nullable: true, comment: '提交时间' })
  submittedAt?: Date | null;
}
