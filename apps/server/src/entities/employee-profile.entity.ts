import { Column, Entity, Index, JoinColumn, ManyToOne, OneToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { OrgDepartment } from './org-department.entity';
import { User } from './user.entity';

@Entity('employee_profiles', { comment: '员工个人信息表' })
@Index(['departmentId'])
@Index(['departmentCode'])
@Index(['positionCode'])
@Index(['active'])
export class EmployeeProfile extends BaseEntity {
  @Column({ unique: true, comment: '关联用户ID' })
  userId: number;

  @OneToOne(() => User, user => user.employeeProfile)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ length: 80, comment: '员工姓名' })
  name: string;

  @Column({ type: 'varchar', nullable: true, length: 120, comment: '职位编码，来源于数据字典position' })
  positionCode?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 160, comment: '职位名称' })
  positionName?: string | null;

  @Column({ type: 'int', nullable: true, comment: '当前部门ID，关联组织部门表' })
  departmentId?: number | null;

  @ManyToOne(() => OrgDepartment, { nullable: true })
  @JoinColumn({ name: 'departmentId' })
  department?: OrgDepartment | null;

  @Column({ type: 'varchar', nullable: true, length: 120, comment: '部门编码快照，来源于组织部门表' })
  departmentCode?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 160, comment: '部门名称快照' })
  departmentName?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 40, comment: '工号' })
  employeeNo?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 40, comment: '手机号' })
  phone?: string | null;

  @Column({ type: 'date', nullable: true, comment: '入职日期' })
  entryDate?: string | null;

  @Column({ type: 'date', nullable: true, comment: '出生日期' })
  birthday?: string | null;

  @Column({ type: 'date', nullable: true, comment: '离职日期' })
  leaveDate?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 80, comment: '紧急联系人' })
  emergencyContact?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 40, comment: '紧急联系电话' })
  emergencyPhone?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 500, comment: '员工档案备注' })
  remark?: string | null;

  @Column({ default: true, comment: '是否在职，离职员工不参与业务人员口径' })
  active: boolean;
}
