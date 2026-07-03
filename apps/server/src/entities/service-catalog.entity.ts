import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('service_catalog', { comment: '服务目录表' })
@Index(['code'], { unique: true })
@Index(['name'], { unique: true })
export class ServiceCatalog extends BaseEntity {
  @Column({ length: 120, comment: '服务编码' })
  code: string;

  @Column({ length: 160, comment: '服务名称' })
  name: string;

  @Column({ type: 'varchar', nullable: true, length: 120, comment: '服务分类' })
  category?: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, comment: '默认价格' })
  defaultPrice: string;

  @Column({ default: 0, comment: '最低服务月数，0表示不限制' })
  minMonths: number;

  @Column({ default: false, comment: '是否需要到期提醒' })
  reminderEnabled: boolean;

  @Column({ default: true, comment: '是否启用' })
  enabled: boolean;

  @Column({ default: 1, comment: '排序值' })
  sort: number;

  @Column({ type: 'varchar', nullable: true, length: 500, comment: '备注' })
  remark?: string | null;
}
