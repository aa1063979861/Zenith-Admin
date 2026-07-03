import { Column, Entity, Index, JoinTable, ManyToMany, OneToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { EmployeeProfile } from './employee-profile.entity';
import { Role } from './role.entity';

export type UserKind = 'SYSTEM_ADMIN' | 'EMPLOYEE';

@Entity('sys_users', { comment: '系统用户表' })
@Index(['userKind', 'enable'])
@Index(['gender'])
export class User extends BaseEntity {
  @Column({ unique: true, length: 80, comment: '登录账号' })
  username: string;

  @Column({ length: 255, comment: '密码哈希' })
  passwordHash: string;

  @Column({ default: true, comment: '是否启用' })
  enable: boolean;

  @Column({ default: false, comment: '是否内置用户' })
  builtIn: boolean;

  @Column({ type: 'varchar', length: 30, default: 'EMPLOYEE', comment: '用户类型：SYSTEM_ADMIN超级管理员，EMPLOYEE员工' })
  userKind: UserKind;

  @Column({ type: 'varchar', nullable: true, length: 255, comment: '头像地址' })
  avatar?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 80, comment: '显示名称' })
  nickName?: string | null;

  @Column({ type: 'tinyint', default: 0, comment: '性别：0未知，1男，2女' })
  gender: number;

  @Column({ type: 'varchar', nullable: true, length: 255, comment: '联系地址' })
  address?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 120, comment: '电子邮箱' })
  email?: string | null;

  @OneToOne(() => EmployeeProfile, profile => profile.user, { cascade: true, nullable: true })
  employeeProfile?: EmployeeProfile | null;

  @ManyToMany(() => Role, role => role.users, { cascade: false })
  @JoinTable({
    name: 'sys_user_roles',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles: Role[];
}
