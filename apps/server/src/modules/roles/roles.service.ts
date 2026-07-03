import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { normalizePage, pageResult } from '../../common/page';
import { AuthSession } from '../../entities/auth-session.entity';
import { Permission } from '../../entities/permission.entity';
import { Role } from '../../entities/role.entity';
import { User } from '../../entities/user.entity';
import { createDictionaryItemCode } from '../dictionaries/dictionary-code';
import { CreateRoleDto } from './dto/create-role.dto';
import { RoleUsersDto } from './dto/role-users.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

const ROLE_SORT_COLUMNS: Record<string, string> = {
  name: 'role.name',
  code: 'role.code',
  builtIn: 'role.builtIn',
  createTime: 'role.createTime',
  enable: 'role.enable',
};

const IMPLIED_PERMISSION_CODES: Record<string, string[]> = {
  MaintainFinanceContract: ['ViewFinance'],
  MaintainFinanceInvoice: ['ViewFinance'],
  MaintainFinancePayment: ['ViewFinance'],
  MatchFinancePayment: ['ViewFinance'],
  ImportFinancePayment: ['ViewFinance'],
};

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission) private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(AuthSession) private readonly sessionRepository: Repository<AuthSession>,
  ) {}

  async list(query: { enable?: string | number }) {
    const where: Record<string, unknown> = {};
    if (query.enable !== undefined && query.enable !== null && query.enable !== '')
      where.enable = Number(query.enable) === 1;
    return this.roleRepository.find({ where, order: { builtIn: 'DESC', id: 'ASC' } });
  }

  async page(query: { pageNo?: number; pageSize?: number; keyword?: string; name?: string; enable?: string | number; sortKey?: string; sortOrder?: string }) {
    const { pageSize, skip } = normalizePage(query);
    const builder = this.roleRepository
      .createQueryBuilder('role')
      .loadRelationIdAndMap('role.permissionIds', 'role.permissions')
      .loadRelationCountAndMap('role.permissionCount', 'role.permissions')
      .loadRelationCountAndMap('role.userCount', 'role.users', 'users', qb =>
        qb.where('users.userKind = :userKind', { userKind: 'EMPLOYEE' }),
      );

    const keyword = query.keyword?.trim() || query.name?.trim();
    if (keyword) {
      builder.andWhere(new Brackets((qb) => {
        qb.where('role.name LIKE :keyword', { keyword: `%${keyword}%` })
          .orWhere('role.code LIKE :keyword', { keyword: `%${keyword}%` });
      }));
    }
    if (query.enable !== undefined && query.enable !== null && query.enable !== '')
      builder.andWhere('role.enable = :enable', { enable: Number(query.enable) === 1 });

    const sort = this.resolveRoleSort(query.sortKey, query.sortOrder);
    if (sort) {
      builder
        .orderBy(sort.column, sort.direction)
        .addOrderBy('role.id', 'ASC');
    }
    else {
      builder
        .orderBy('role.builtIn', 'DESC')
        .addOrderBy('role.id', 'ASC');
    }

    const [roles, total] = await builder
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    return pageResult(roles.map(role => this.toRoleListItem(role)), total);
  }

  async create(dto: CreateRoleDto) {
    const name = this.requiredText(dto.name, '角色名称不能为空');
    const code = this.resolveRoleCode(name);
    await this.ensureCodeAvailable(code);
    const permissions = await this.resolvePermissions(dto.permissionIds || []);
    const role = this.roleRepository.create({
      name,
      code,
      enable: dto.enable ?? true,
      permissions,
    });
    return this.roleRepository.save(role);
  }

  async update(id: number, dto: UpdateRoleDto) {
    const role = await this.findOne(id);
    if (role.builtIn && dto.enable === false)
      throw new BadRequestException('系统内置角色不可停用');
    if (role.builtIn && this.hasOwn(dto, 'permissionIds'))
      throw new BadRequestException('系统内置角色不可修改权限');
    const oldCode = role.code;
    if (dto.name !== undefined) {
      role.name = this.requiredText(dto.name, '角色名称不能为空');
      role.code = this.resolveRoleCode(role.name);
      await this.ensureCodeAvailable(role.code, role.id);
    }
    if (dto.enable !== undefined)
      role.enable = dto.enable;
    if (this.hasOwn(dto, 'permissionIds'))
      role.permissions = await this.resolvePermissions(dto.permissionIds || []);
    const saved = await this.roleRepository.save(role);
    if (saved.code !== oldCode)
      await this.syncCurrentRoleCode(oldCode, saved.code);
    return saved;
  }

  async remove(id: number) {
    const role = await this.findOne(id);
    if (role.builtIn)
      throw new BadRequestException('系统内置角色不可删除');
    const userCount = await this.countEmployeeUsers(role.id);
    if (userCount > 0)
      throw new BadRequestException('角色已分配给员工，请先取消授权后再删除');
    await this.roleRepository.softRemove(role);
    return true;
  }

  async addUsers(roleId: number, dto: RoleUsersDto) {
    const role = await this.findOne(roleId);
    if (role.builtIn)
      throw new BadRequestException('系统内置角色不可授权给员工');
    if (!role.enable)
      throw new BadRequestException('停用角色不能授权给员工');
    const users = await this.loadEmployeeUsers(dto.userIds, true);
    for (const user of users) {
      user.roles = user.roles || [];
      if (!user.roles.some(item => item.id === role.id))
        user.roles.push(role);
    }
    await this.userRepository.save(users);
    return true;
  }

  async removeUsers(roleId: number, dto: RoleUsersDto) {
    const role = await this.findOne(roleId);
    if (role.builtIn)
      throw new BadRequestException('系统内置角色不可取消授权');
    const users = await this.loadEmployeeUsers(dto.userIds, false);
    for (const user of users) {
      user.roles = (user.roles || []).filter(item => item.id !== role.id);
    }
    await this.userRepository.save(users);
    return true;
  }

  async userPermissionsTree(userId: number, currentRoleCode?: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });
    if (!user)
      throw new NotFoundException('用户不存在');

    const permissions = new Map<number, Permission>();
    const enabledRoles = (user.roles || []).filter(role => role.enable);
    const currentRole = currentRoleCode
      ? enabledRoles.find(role => role.code === currentRoleCode)
      : undefined;
    const roles = currentRole ? [currentRole] : enabledRoles.slice(0, 1);
    for (const role of roles) {
      for (const permission of role.permissions || []) {
        if (permission.enable)
          permissions.set(permission.id, permission);
      }
    }
    await this.completeActiveMenuPermissions(permissions);
    return this.buildTree([...permissions.values()]);
  }

  async systemPermissionsTree() {
    const permissions = await this.permissionRepository.find({
      where: { enable: true },
      order: { order: 'ASC', id: 'ASC' },
    });
    return this.buildTree(permissions);
  }

  async findOne(id: number) {
    const role = await this.roleRepository.findOne({ where: { id }, relations: ['permissions'] });
    if (!role)
      throw new NotFoundException('角色不存在');
    return role;
  }

  private async ensureCodeAvailable(code: string, currentId?: number) {
    const existed = await this.roleRepository.findOne({ where: { code }, withDeleted: true });
    if (existed && existed.id !== currentId)
      throw new BadRequestException('角色编码已存在');
  }

  private resolveRoleCode(name: string) {
    const code = createDictionaryItemCode(name);
    if (!code)
      throw new BadRequestException('角色编码生成失败，请检查角色名称');
    return code;
  }

  private async syncCurrentRoleCode(oldCode: string, newCode: string) {
    await this.sessionRepository.update(
      { currentRoleCode: oldCode },
      { currentRoleCode: newCode },
    );
  }

  private async resolvePermissions(permissionIds: number[]) {
    const ids = this.uniqueIds(permissionIds);
    if (!ids.length)
      return [];

    const selectedPermissions = await this.permissionRepository.findBy({ id: In(ids) });
    if (selectedPermissions.length !== ids.length)
      throw new BadRequestException('存在无效的菜单权限');

    const permissionMap = new Map<number, Permission>();
    selectedPermissions.forEach(permission => permissionMap.set(permission.id, permission));
    await this.completeImpliedPermissions(permissionMap);

    // 角色勾选按钮或子菜单时，必须自动补齐父级菜单，否则普通用户无法进入对应菜单。
    let parentIds = [...permissionMap.values()]
      .filter(permission => this.shouldCompleteParentPermission(permission))
      .map(permission => permission.parentId)
      .filter((id): id is number => !!id && !permissionMap.has(id));

    while (parentIds.length) {
      const uniqueParentIds = this.uniqueIds(parentIds);
      const parents = await this.permissionRepository.findBy({ id: In(uniqueParentIds) });
      if (parents.length !== uniqueParentIds.length)
        throw new BadRequestException('菜单父级链路异常，请先检查菜单管理');

      parents.forEach(permission => permissionMap.set(permission.id, permission));
      parentIds = parents
        .filter(permission => this.shouldCompleteParentPermission(permission))
        .map(permission => permission.parentId)
        .filter((id): id is number => !!id && !permissionMap.has(id));
    }

    return [...permissionMap.values()];
  }

  private async completeImpliedPermissions(permissionMap: Map<number, Permission>) {
    const impliedCodes = this.uniqueTexts([...permissionMap.values()]
      .flatMap(permission => IMPLIED_PERMISSION_CODES[permission.code] || []));
    if (!impliedCodes.length)
      return;

    const existedCodes = new Set([...permissionMap.values()].map(permission => permission.code));
    const missingCodes = impliedCodes.filter(code => !existedCodes.has(code));
    if (!missingCodes.length)
      return;

    const impliedPermissions = await this.permissionRepository.find({
      where: { code: In(missingCodes), enable: true },
    });
    if (impliedPermissions.length !== missingCodes.length)
      throw new BadRequestException('隐含权限链路异常，请先检查菜单管理');

    impliedPermissions.forEach(permission => permissionMap.set(permission.id, permission));
  }

  private shouldCompleteParentPermission(permission: Permission) {
    return !(permission.type === 'MENU' && !permission.show && !!permission.path);
  }

  private async completeActiveMenuPermissions(permissionMap: Map<number, Permission>) {
    const activeMenuCodes = this.uniqueTexts([...permissionMap.values()]
      .map(permission => permission.activeMenuCode)
      .filter((code): code is string => !!code));
    if (!activeMenuCodes.length)
      return;

    const activeMenus = await this.permissionRepository.find({
      where: { code: In(activeMenuCodes), type: 'MENU', enable: true, show: true },
    });
    if (activeMenus.length !== activeMenuCodes.length)
      throw new BadRequestException('隐藏路由高亮菜单链路异常，请先检查菜单管理');

    activeMenus.forEach(permission => permissionMap.set(permission.id, permission));
    await this.completeVisibleParentPermissions(permissionMap, activeMenus);
  }

  private async completeVisibleParentPermissions(permissionMap: Map<number, Permission>, seedPermissions: Permission[]) {
    let parentIds = seedPermissions
      .map(permission => permission.parentId)
      .filter((id): id is number => !!id && !permissionMap.has(id));

    while (parentIds.length) {
      const uniqueParentIds = this.uniqueIds(parentIds);
      const parents = await this.permissionRepository.findBy({ id: In(uniqueParentIds) });
      const visibleParents = parents.filter(permission => permission.type === 'MENU' && permission.enable && permission.show);
      if (visibleParents.length !== uniqueParentIds.length)
        throw new BadRequestException('隐藏路由高亮菜单父级链路异常，请先检查菜单管理');

      visibleParents.forEach(permission => permissionMap.set(permission.id, permission));
      parentIds = visibleParents
        .map(permission => permission.parentId)
        .filter((id): id is number => !!id && !permissionMap.has(id));
    }
  }

  private async loadEmployeeUsers(userIds: number[], requireEnabled: boolean) {
    const ids = this.uniqueIds(userIds);
    if (!ids.length)
      throw new BadRequestException('请选择员工');

    const users = await this.userRepository.find({ where: { id: In(ids) }, relations: ['roles'] });
    if (users.length !== ids.length)
      throw new BadRequestException('存在无效的员工账号');
    if (users.some(user => user.builtIn || user.userKind !== 'EMPLOYEE'))
      throw new BadRequestException('超级管理员不能参与角色授权');
    if (requireEnabled && users.some(user => !user.enable))
      throw new BadRequestException('停用员工不能新增角色授权');
    return users;
  }

  private uniqueIds(ids: number[]) {
    return [...new Set((ids || []).map(id => Number(id)).filter(id => Number.isInteger(id) && id > 0))];
  }

  private uniqueTexts(values: string[]) {
    return [...new Set(values.map(value => value.trim()).filter(Boolean))];
  }

  private requiredText(value: string, message: string) {
    const text = value?.trim();
    if (!text)
      throw new BadRequestException(message);
    return text;
  }

  private hasOwn<T extends object>(target: T, key: keyof T) {
    return Object.prototype.hasOwnProperty.call(target, key);
  }

  private async countEmployeeUsers(roleId: number) {
    return this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.roles', 'role', 'role.id = :roleId', { roleId })
      .where('user.userKind = :userKind', { userKind: 'EMPLOYEE' })
      .getCount();
  }

  private toRoleListItem(role: Role) {
    const roleWithCounts = role as Role & { permissionIds?: number[]; permissionCount?: number; userCount?: number };
    const permissionIds = roleWithCounts.permissionIds || role.permissions?.map(permission => permission.id) || [];
    return {
      ...role,
      permissionIds,
      permissionCount: roleWithCounts.permissionCount ?? permissionIds.length,
      userCount: roleWithCounts.userCount ?? 0,
    };
  }

  private resolveRoleSort(sortKey?: string, sortOrder?: string) {
    const key = sortKey?.trim();
    if (!key || !sortOrder)
      return null;
    const column = ROLE_SORT_COLUMNS[key];
    if (!column)
      return null;
    if (sortOrder === 'ascend')
      return { column, direction: 'ASC' as const };
    if (sortOrder === 'descend')
      return { column, direction: 'DESC' as const };
    return null;
  }

  private buildTree(rows: Permission[]) {
    const nodeMap = new Map<number, Permission & { children?: Permission[] }>();
    rows
      .sort((a, b) => a.order - b.order || a.id - b.id)
      .forEach(row => nodeMap.set(row.id, { ...row, children: [] }));

    const roots: Array<Permission & { children?: Permission[] }> = [];
    nodeMap.forEach((node) => {
      if (node.parentId && nodeMap.has(node.parentId)) {
        nodeMap.get(node.parentId)?.children?.push(node);
      }
      else {
        roots.push(node);
      }
    });
    return roots;
  }
}
