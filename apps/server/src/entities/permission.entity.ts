import { Column, Entity, Index, ManyToMany, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Role } from './role.entity';

export type PermissionType = 'MENU' | 'BUTTON';

@Entity('sys_permissions', { comment: '系统资源权限表' })
@Index(['type', 'enable'])
@Index(['parentId', 'type', 'order'])
export class Permission extends BaseEntity {
  @Column({ unique: true, length: 120, comment: '资源编码' })
  code: string;

  @Column({ length: 120, comment: '资源名称' })
  name: string;

  @Column({ type: 'varchar', length: 20, comment: '资源类型：MENU菜单，BUTTON按钮' })
  type: PermissionType;

  @Column({ type: 'int', nullable: true, comment: '上级资源ID' })
  parentId?: number | null;

  @ManyToOne(() => Permission, permission => permission.children, { nullable: true })
  parent?: Permission | null;

  @OneToMany(() => Permission, permission => permission.parent)
  children: Permission[];

  @Column({ type: 'varchar', nullable: true, length: 255, comment: '前端路由路径' })
  path?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 255, comment: '前端组件路径' })
  component?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 120, comment: '菜单图标' })
  icon?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 40, comment: '布局类型' })
  layout?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 120, comment: '隐藏路由激活菜单编码' })
  activeMenuCode?: string | null;

  @Column({ default: true, comment: '是否显示' })
  show: boolean;

  @Column({ default: true, comment: '是否启用' })
  enable: boolean;

  @Column({ default: false, comment: '是否缓存页面' })
  keepAlive: boolean;

  @Column({ name: 'sort_order', default: 1, comment: '排序号' })
  order: number;

  @ManyToMany(() => Role, role => role.permissions)
  roles: Role[];
}
