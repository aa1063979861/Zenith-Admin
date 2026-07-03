import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity('org_departments', { comment: '组织部门表' })
@Index(['parentId'])
@Index(['enabled'])
export class OrgDepartment extends BaseEntity {
  @Column({ type: 'int', nullable: true, comment: '上级部门ID，空表示顶级部门' })
  parentId?: number | null;

  @ManyToOne(() => OrgDepartment, department => department.children, { nullable: true })
  @JoinColumn({ name: 'parentId' })
  parent?: OrgDepartment | null;

  @OneToMany(() => OrgDepartment, department => department.parent)
  children?: OrgDepartment[];

  @Column({ unique: true, length: 80, comment: '部门编码，创建后保持稳定' })
  code: string;

  @Column({ length: 160, comment: '部门名称' })
  name: string;

  @Column({ type: 'int', nullable: true, comment: '部门负责人用户ID' })
  managerUserId?: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'managerUserId' })
  manager?: User | null;

  @Column({ default: true, comment: '是否启用' })
  enabled: boolean;

  @Column({ name: 'sort_order', default: 1, comment: '排序号' })
  sort: number;

  @Column({ type: 'varchar', nullable: true, length: 500, comment: '部门备注' })
  remark?: string | null;
}
