import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Permission } from './permission.entity';
import { User } from './user.entity';

@Entity('sys_roles', { comment: '系统角色表' })
export class Role extends BaseEntity {
  @Column({ length: 80, comment: '角色名称' })
  name: string;

  @Column({ unique: true, length: 80, comment: '角色编码' })
  code: string;

  @Column({ default: true, comment: '是否启用' })
  enable: boolean;

  @Column({ default: false, comment: '是否内置角色' })
  builtIn: boolean;

  @ManyToMany(() => Permission, permission => permission.roles, { cascade: false })
  @JoinTable({
    name: 'sys_role_permissions',
    joinColumn: { name: 'role_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permission_id', referencedColumnName: 'id' },
  })
  permissions: Permission[];

  @ManyToMany(() => User, user => user.roles)
  users: User[];
}
