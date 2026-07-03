import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { EmployeeProfile } from '../../entities/employee-profile.entity';
import { OrgDepartment } from '../../entities/org-department.entity';
import { User } from '../../entities/user.entity';
import { createDictionaryItemCode } from '../dictionaries/dictionary-code';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

export type DepartmentDto = {
  id: number;
  parentId: number | null;
  code: string;
  name: string;
  managerUserId: number | null;
  managerName: string;
  enabled: boolean;
  sort: number;
  remark?: string | null;
  employeeCount: number;
  activeEmployeeCount: number;
  inactiveEmployeeCount: number;
  children: DepartmentDto[];
};

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(OrgDepartment) private readonly departmentRepository: Repository<OrgDepartment>,
    @InjectRepository(EmployeeProfile) private readonly employeeRepository: Repository<EmployeeProfile>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  async listDepartments() {
    const departments = await this.departmentRepository.find({
      relations: ['manager', 'manager.employeeProfile'],
      order: { sort: 'ASC', id: 'ASC' },
    });
    const employeeCounts = await this.countEmployeesByDepartment(departments);
    const rows = departments.map(department => this.toDepartmentDto(department, employeeCounts.get(department.id)));
    return this.buildDepartmentTree(rows);
  }

  async departmentOptions() {
    const departments = await this.departmentRepository.find({
      where: { enabled: true },
      order: { sort: 'ASC', id: 'ASC' },
    });
    return departments.map(department => this.toDepartmentDto(department));
  }

  async summary() {
    const [departments, employees] = await Promise.all([
      this.departmentRepository.find({
        relations: ['manager', 'manager.employeeProfile'],
        order: { sort: 'ASC', id: 'ASC' },
      }),
      this.employeeRepository.find(),
    ]);
    const employeeCounts = await this.countEmployeesByDepartment(departments);
    const rows = departments.map(department => this.toDepartmentDto(department, employeeCounts.get(department.id)));
    const activeEmployees = employees.filter(employee => employee.active);
    const inactiveEmployees = employees.length - activeEmployees.length;
    const unassignedDepartmentCount = activeEmployees.filter(employee => !employee.departmentId && !employee.departmentCode).length;
    const unassignedPositionCount = activeEmployees.filter(employee => !employee.positionCode).length;
    const disabledDepartmentCodes = new Set(departments.filter(department => !department.enabled).map(department => department.code));
    const disabledDepartmentEmployeeCount = activeEmployees.filter(employee => employee.departmentCode && disabledDepartmentCodes.has(employee.departmentCode)).length;

    return {
      activeEmployees: activeEmployees.length,
      inactiveEmployees,
      departments: departments.length,
      enabledDepartments: departments.filter(department => department.enabled).length,
      disabledDepartments: departments.filter(department => !department.enabled).length,
      positions: new Set(activeEmployees.map(employee => employee.positionCode).filter(Boolean)).size,
      unassignedDepartmentCount,
      unassignedPositionCount,
      missingManagerCount: departments.filter(department => department.enabled && !department.managerUserId).length,
      disabledDepartmentEmployeeCount,
      departmentStats: rows,
      departmentTree: this.buildDepartmentTree(rows),
    };
  }

  async createDepartment(dto: CreateDepartmentDto) {
    const name = this.requiredName(dto.name);
    await this.ensureNameAvailable(name);
    const parent = await this.resolveParent(dto.parentId);
    const manager = await this.resolveManager(dto.managerUserId);
    const department = this.departmentRepository.create({
      parentId: parent?.id || null,
      code: await this.createAvailableDepartmentCode(name),
      name,
      managerUserId: manager?.id || null,
      enabled: dto.enabled ?? true,
      sort: this.normalizeSort(dto.sort),
      remark: this.optionalText(dto.remark),
    });
    return this.toDepartmentDto(await this.departmentRepository.save(department));
  }

  async updateDepartment(id: number, dto: UpdateDepartmentDto) {
    const department = await this.findDepartment(id);
    const oldName = department.name;
    const name = dto.name !== undefined ? this.requiredName(dto.name) : department.name;
    await this.ensureNameAvailable(name, id);

    if (dto.parentId !== undefined) {
      const parent = await this.resolveParent(dto.parentId);
      if (parent?.id === id)
        throw new BadRequestException('上级部门不能选择自身');
      if (parent)
        await this.assertNotDescendant(id, parent.id);
      department.parentId = parent?.id || null;
    }

    if (dto.managerUserId !== undefined) {
      const manager = await this.resolveManager(dto.managerUserId);
      department.managerUserId = manager?.id || null;
    }
    if (dto.name !== undefined)
      department.name = name;
    if (dto.sort !== undefined)
      department.sort = this.normalizeSort(dto.sort);
    if (dto.enabled !== undefined)
      department.enabled = dto.enabled;
    if (dto.remark !== undefined)
      department.remark = this.optionalText(dto.remark);

    const saved = await this.departmentRepository.save(department);
    if (saved.name !== oldName)
      await this.syncEmployeeDepartmentSnapshots(saved);
    return this.toDepartmentDto(saved);
  }

  async removeDepartment(id: number) {
    const department = await this.findDepartment(id);
    const childCount = await this.departmentRepository.count({ where: { parentId: id } });
    if (childCount > 0)
      throw new BadRequestException('部门存在下级部门，不能删除');

    const employeeCount = await this.countEmployeesForDepartment(department);
    if (employeeCount > 0)
      throw new BadRequestException('部门已关联员工，不能删除；如暂不使用请停用部门');

    await this.departmentRepository.softRemove(department);
    return true;
  }

  private async findDepartment(id: number) {
    const department = await this.departmentRepository.findOne({
      where: { id },
      relations: ['manager', 'manager.employeeProfile'],
    });
    if (!department)
      throw new NotFoundException('部门不存在');
    return department;
  }

  private toDepartmentDto(department: OrgDepartment, counts = { total: 0, active: 0, inactive: 0 }) {
    return {
      id: department.id,
      parentId: department.parentId || null,
      code: department.code,
      name: department.name,
      managerUserId: department.managerUserId || null,
      managerName: department.manager?.employeeProfile?.name || department.manager?.nickName || '',
      enabled: department.enabled,
      sort: department.sort,
      remark: department.remark,
      employeeCount: counts.total,
      activeEmployeeCount: counts.active,
      inactiveEmployeeCount: counts.inactive,
      children: [] as DepartmentDto[],
    };
  }

  private buildDepartmentTree(rows: DepartmentDto[]) {
    const nodeMap = new Map(rows.map(row => [row.id, { ...row, children: [] as DepartmentDto[] }]));
    const roots: DepartmentDto[] = [];
    for (const row of nodeMap.values()) {
      if (row.parentId && nodeMap.has(row.parentId)) {
        nodeMap.get(row.parentId)?.children.push(row);
        continue;
      }
      roots.push(row);
    }
    const sortNodes = (nodes: DepartmentDto[]) => {
      nodes.sort((a, b) => a.sort - b.sort || a.id - b.id);
      for (const node of nodes)
        sortNodes(node.children);
    };
    sortNodes(roots);
    return roots;
  }

  private async countEmployeesByDepartment(departments: OrgDepartment[]) {
    const result = new Map<number, { total: number; active: number; inactive: number }>();
    for (const department of departments) {
      const employees = await this.employeeRepository
        .createQueryBuilder('employee')
        .where('employee.departmentId = :departmentId', { departmentId: department.id })
        .orWhere('employee.departmentId IS NULL AND employee.departmentCode = :departmentCode', { departmentCode: department.code })
        .getMany();
      const active = employees.filter(employee => employee.active).length;
      result.set(department.id, {
        total: employees.length,
        active,
        inactive: employees.length - active,
      });
    }
    return result;
  }

  private async countEmployeesForDepartment(department: OrgDepartment) {
    return this.employeeRepository
      .createQueryBuilder('employee')
      .where('employee.departmentId = :departmentId', { departmentId: department.id })
      .orWhere('employee.departmentId IS NULL AND employee.departmentCode = :departmentCode', { departmentCode: department.code })
      .getCount();
  }

  private async syncEmployeeDepartmentSnapshots(department: OrgDepartment) {
    await this.employeeRepository
      .createQueryBuilder()
      .update(EmployeeProfile)
      .set({
        departmentId: department.id,
        departmentCode: department.code,
        departmentName: department.name,
      })
      .where('departmentId = :departmentId', { departmentId: department.id })
      .orWhere('departmentId IS NULL AND departmentCode = :departmentCode', { departmentCode: department.code })
      .execute();
  }

  private requiredName(value: string) {
    const name = value.trim();
    if (!name)
      throw new BadRequestException('部门名称不能为空');
    return name;
  }

  private optionalText(value?: string | null) {
    const text = value?.trim();
    return text || null;
  }

  private normalizeSort(value?: number) {
    if (value === undefined || value === null)
      return 1;
    if (!Number.isInteger(value) || value < 1)
      throw new BadRequestException('排序必须为正整数');
    return value;
  }

  private async resolveParent(parentId?: number | null) {
    if (!parentId)
      return null;
    const parent = await this.departmentRepository.findOne({ where: { id: parentId } });
    if (!parent)
      throw new BadRequestException('上级部门不存在');
    if (!parent.enabled)
      throw new BadRequestException('不能选择已停用部门作为上级部门');
    return parent;
  }

  private async resolveManager(managerUserId?: number | null) {
    if (!managerUserId)
      return null;
    const user = await this.userRepository.findOne({
      where: { id: managerUserId },
      relations: ['employeeProfile'],
    });
    if (!user || user.userKind !== 'EMPLOYEE' || !user.employeeProfile?.active)
      throw new BadRequestException('部门负责人必须是在职员工');
    return user;
  }

  private async ensureNameAvailable(name: string, currentId?: number) {
    const where = currentId ? { name, id: Not(currentId) } : { name };
    if (await this.departmentRepository.exists({ where }))
      throw new BadRequestException('部门名称已存在');
  }

  private async createAvailableDepartmentCode(name: string) {
    const baseCode = createDictionaryItemCode(name);
    if (!baseCode)
      throw new BadRequestException('部门编码生成失败，请检查部门名称');
    const stem = baseCode.replace(/_Code$/, '');
    let code = baseCode;
    let suffix = 2;
    while (await this.departmentRepository.exists({ where: { code } })) {
      code = `${stem}_${suffix}_Code`;
      suffix += 1;
    }
    return code;
  }

  private async assertNotDescendant(departmentId: number, parentId: number) {
    let currentParentId: number | null | undefined = parentId;
    while (currentParentId) {
      if (currentParentId === departmentId)
        throw new BadRequestException('不能把部门移动到自己的下级部门下');
      const parent = await this.departmentRepository.findOne({ where: { id: currentParentId } });
      currentParentId = parent?.parentId;
    }
  }
}
