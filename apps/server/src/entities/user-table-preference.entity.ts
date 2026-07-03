import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { TablePreferenceConfig } from './table-default-preference.entity';

@Entity('sys_user_table_preferences', { comment: '用户表格列配置表' })
@Index(['userId', 'tableKey'], { unique: true })
@Index(['userId'])
export class UserTablePreference extends BaseEntity {
  @Column({ comment: '用户ID' })
  userId: number;

  @Column({ type: 'varchar', length: 160, comment: '表格唯一标识' })
  tableKey: string;

  @Column({ type: 'json', comment: '用户列配置JSON' })
  settings: TablePreferenceConfig;
}
