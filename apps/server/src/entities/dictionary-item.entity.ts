import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export type DictionaryType = 'region' | 'position';

@Entity('dictionary_items', { comment: '数据字典项表' })
@Index(['dictionaryType', 'code'], { unique: true })
export class DictionaryItem extends BaseEntity {
  @Column({ type: 'varchar', length: 40, comment: '字典类型：region区划，position职位' })
  dictionaryType: DictionaryType;

  @Column({ length: 120, comment: '字典编码' })
  code: string;

  @Column({ length: 160, comment: '字典名称' })
  name: string;

  @Column({ default: true, comment: '是否启用' })
  enabled: boolean;

  @Column({ name: 'sort_order', default: 1, comment: '排序号' })
  sort: number;

  @Column({ type: 'varchar', nullable: true, length: 500, comment: '备注' })
  remark?: string | null;
}
