import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export interface TablePreferenceConfig {
  order: string[];
  hidden: string[];
  widths: Record<string, number>;
  defaultOrderKeys: string[];
  defaultHiddenKeys: string[];
  orderCustomized: boolean;
  hiddenCustomized: boolean;
}

@Entity('sys_table_default_preferences', { comment: '系统表格默认配置表' })
@Index(['tableKey'], { unique: true })
export class TableDefaultPreference extends BaseEntity {
  @Column({ type: 'varchar', length: 160, comment: '表格唯一标识' })
  tableKey: string;

  @Column({ type: 'json', comment: '默认列配置JSON' })
  defaultConfig: TablePreferenceConfig;
}
