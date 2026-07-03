import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export type SystemParameterValueType = 'string' | 'number' | 'boolean' | 'password';

@Entity('sys_parameters', { comment: '系统参数表' })
@Index(['paramKey'], { unique: true })
@Index(['groupName', 'sort'])
@Index(['enabled', 'sort'])
@Index(['valueType'])
@Index(['builtIn'])
export class SystemParameter extends BaseEntity {
  @Column({ length: 120, comment: '参数键' })
  paramKey: string;

  @Column({ length: 120, comment: '参数名称' })
  paramName: string;

  @Column({ type: 'varchar', length: 30, default: 'string', comment: '参数值类型' })
  valueType: SystemParameterValueType;

  @Column({ type: 'text', comment: '参数值' })
  paramValue: string;

  @Column({ type: 'varchar', nullable: true, length: 80, comment: '参数分组' })
  groupName?: string | null;

  @Column({ default: true, comment: '是否启用' })
  enabled: boolean;

  @Column({ default: false, comment: '是否内置参数' })
  builtIn: boolean;

  @Column({ name: 'sort_order', default: 1, comment: '排序号' })
  sort: number;

  @Column({ type: 'varchar', nullable: true, length: 500, comment: '备注' })
  remark?: string | null;
}
