import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { pageResult } from '../../common/page';
import { Permission, PermissionType } from '../../entities/permission.entity';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { matchesPermissionPath } from './permission-path';
import { UpdatePermissionDto } from './dto/update-permission.dto';

const MENU_LAYOUTS = new Set(['simple', 'normal', 'full', 'empty']);

@Injectable()
export class PermissionsService {
  constructor(@InjectRepository(Permission) private readonly permissionRepository: Repository<Permission>) {}

  async tree(type?: 'MENU' | 'BUTTON') {
    const permissions = await this.permissionRepository.find({
      where: type ? { type } : {},
      order: { order: 'ASC', id: 'ASC' },
    });
    const tree = this.buildTree(permissions);
    if (type === 'MENU') {
      const directChildCounts = await this.getDirectChildCounts();
      this.attachDirectChildCount(tree, directChildCounts);
    }
    return tree;
  }

  async buttons(parentId: number) {
    const buttons = await this.permissionRepository.find({
      where: { parentId, type: 'BUTTON' },
      order: { order: 'ASC', id: 'ASC' },
    });
    return pageResult(buttons, buttons.length);
  }

  async validateMenu(path: string) {
    if (!path)
      return false;
    const menus = await this.permissionRepository.find({
      where: { type: 'MENU', enable: true },
      select: ['path', 'code'],
    });
    return menus.some(menu => matchesPermissionPath(menu.path, path, menu.code));
  }

  async create(dto: CreatePermissionDto) {
    const code = this.requiredText(dto.code, '菜单编码不能为空');
    const name = this.requiredText(dto.name, '菜单名称不能为空');
    const parentId = dto.parentId ?? null;

    await this.ensureCodeAvailable(code);
    await this.assertParent(dto.type, parentId);
    const path = dto.type === 'MENU' ? this.normalizeMenuPath(dto.path) : null;
    const show = dto.type === 'MENU' ? dto.show ?? true : true;
    const activeMenuCode = await this.normalizeActiveMenuCode(dto.type, show, path, dto.activeMenuCode, code);
    this.assertHiddenRoutePlacement(dto.type, show, path, parentId);

    const permission = this.permissionRepository.create({
      code,
      name,
      type: dto.type,
      parentId,
      path,
      component: dto.type === 'MENU' ? this.normalizeComponent(dto.component) : null,
      icon: dto.type === 'MENU' ? this.optionalText(dto.icon) : null,
      layout: dto.type === 'MENU' ? this.normalizeLayout(dto.layout) : null,
      activeMenuCode,
      show,
      enable: dto.enable ?? true,
      keepAlive: dto.type === 'MENU' ? dto.keepAlive ?? false : false,
      order: this.normalizeOrder(dto.order),
    });
    return this.permissionRepository.save(permission);
  }

  async update(id: number, dto: UpdatePermissionDto) {
    const permission = await this.findOne(id);
    const nextType = dto.type ?? permission.type;
    const nextParentId = this.hasOwn(dto, 'parentId') ? dto.parentId ?? null : permission.parentId ?? null;
    const nextCode = dto.code !== undefined ? this.requiredText(dto.code, '菜单编码不能为空') : permission.code;
    const nextPath = nextType === 'MENU'
      ? this.hasOwn(dto, 'path') ? this.normalizeMenuPath(dto.path) : permission.path ?? null
      : null;
    const nextShow = nextType === 'MENU' ? dto.show ?? permission.show : true;
    const nextActiveMenuCode = nextType === 'MENU'
      ? this.hasOwn(dto, 'activeMenuCode') ? dto.activeMenuCode : permission.activeMenuCode
      : null;

    if (dto.type === 'BUTTON' && permission.type === 'MENU') {
      const childCount = await this.permissionRepository.count({ where: { parentId: id } });
      if (childCount > 0)
        throw new BadRequestException('存在下级菜单或按钮，不能改为按钮');
    }
    await this.assertParent(nextType, nextParentId, id);
    this.assertHiddenRoutePlacement(nextType, nextShow, nextPath, nextParentId);
    const activeMenuCode = await this.normalizeActiveMenuCode(nextType, nextShow, nextPath, nextActiveMenuCode, nextCode);

    if (dto.code !== undefined) {
      await this.ensureCodeAvailable(nextCode, id);
      permission.code = nextCode;
    }
    if (dto.name !== undefined)
      permission.name = this.requiredText(dto.name, '菜单名称不能为空');
    if (dto.type !== undefined)
      permission.type = dto.type;
    if (this.hasOwn(dto, 'parentId'))
      permission.parentId = dto.parentId ?? null;
    if (nextType === 'BUTTON') {
      permission.path = null;
      permission.component = null;
      permission.icon = null;
      permission.layout = null;
      permission.activeMenuCode = null;
      permission.show = true;
      permission.keepAlive = false;
    }
    else {
      if (this.hasOwn(dto, 'path'))
        permission.path = nextPath;
      if (this.hasOwn(dto, 'component'))
        permission.component = this.normalizeComponent(dto.component);
      if (this.hasOwn(dto, 'icon'))
        permission.icon = this.optionalText(dto.icon);
      if (this.hasOwn(dto, 'layout'))
        permission.layout = this.normalizeLayout(dto.layout);
      permission.activeMenuCode = activeMenuCode;
      if (dto.show !== undefined)
        permission.show = dto.show;
      if (dto.keepAlive !== undefined)
        permission.keepAlive = dto.keepAlive;
    }
    if (dto.enable !== undefined)
      permission.enable = dto.enable;
    if (dto.order !== undefined)
      permission.order = this.normalizeOrder(dto.order);

    return this.permissionRepository.save(permission);
  }

  async remove(id: number) {
    const permission = await this.findOne(id);
    const childCount = await this.permissionRepository.count({ where: { parentId: id } });
    if (childCount > 0)
      throw new BadRequestException('存在下级菜单或按钮，不能直接删除');
    const roleCount = await this.countAssignedRoles(id);
    if (roleCount > 0)
      throw new BadRequestException('菜单已分配给角色，请先在角色管理中取消授权后再删除');
    await this.permissionRepository.softRemove(permission);
    return true;
  }

  async findOne(id: number) {
    const permission = await this.permissionRepository.findOne({ where: { id } });
    if (!permission)
      throw new NotFoundException('菜单不存在');
    return permission;
  }

  private async ensureCodeAvailable(code: string, currentId?: number) {
    const existed = await this.permissionRepository.findOne({
      where: { code },
      withDeleted: true,
    });
    if (existed && existed.id !== currentId)
      throw new BadRequestException('菜单编码已存在');
  }

  private async assertParent(type: PermissionType, parentId: number | null, currentId?: number) {
    if (!parentId) {
      if (type === 'BUTTON')
        throw new BadRequestException('按钮必须选择所属菜单');
      return;
    }

    const parent = await this.permissionRepository.findOne({ where: { id: parentId } });
    if (!parent)
      throw new BadRequestException('父级菜单不存在');
    if (parent.type !== 'MENU')
      throw new BadRequestException('父级必须是菜单');

    let cursor: Permission | null = parent;
    while (cursor) {
      if (currentId && cursor.id === currentId)
        throw new BadRequestException('菜单不能归属到自身或下级菜单');
      if (!cursor.parentId)
        break;
      cursor = await this.permissionRepository.findOne({ where: { id: cursor.parentId } });
      if (!cursor)
        throw new BadRequestException('父级菜单链路异常');
    }
  }

  private requiredText(value: string, message: string) {
    const text = value.trim();
    if (!text)
      throw new BadRequestException(message);
    return text;
  }

  private optionalText(value?: string | null) {
    const text = value?.trim();
    return text || null;
  }

  private normalizeMenuPath(value?: string | null) {
    const path = this.optionalText(value);
    if (!path)
      return null;
    if (!path.startsWith('/') && !path.startsWith('http://') && !path.startsWith('https://'))
      throw new BadRequestException('菜单路由地址格式错误');
    return path;
  }

  private normalizeComponent(value?: string | null) {
    const component = this.optionalText(value);
    if (!component)
      return null;
    if (!component.startsWith('/src/'))
      throw new BadRequestException('菜单组件路径必须以 /src/ 开头');
    return component;
  }

  private normalizeLayout(value?: string | null) {
    const layout = this.optionalText(value);
    if (!layout)
      return null;
    if (!MENU_LAYOUTS.has(layout))
      throw new BadRequestException('菜单布局类型不支持');
    return layout;
  }

  private async normalizeActiveMenuCode(type: PermissionType, show: boolean, path: string | null, value?: string | null, currentCode?: string) {
    if (type === 'BUTTON')
      return null;
    const activeMenuCode = this.optionalText(value);
    if (show)
      return null;
    if (!path)
      return null;
    if (!activeMenuCode)
      throw new BadRequestException('隐藏路由必须设置高亮菜单');
    if (activeMenuCode === currentCode)
      throw new BadRequestException('隐藏路由不能高亮自身');
    const activeMenu = await this.permissionRepository.findOne({ where: { code: activeMenuCode, type: 'MENU' } });
    if (!activeMenu || !activeMenu.show || !activeMenu.enable)
      throw new BadRequestException('高亮菜单必须是已启用且显示的菜单');
    return activeMenuCode;
  }

  private assertHiddenRoutePlacement(type: PermissionType, show: boolean, path: string | null, parentId: number | null) {
    if (type === 'MENU' && !show && path && parentId)
      throw new BadRequestException('隐藏路由不能设置上级菜单，请通过高亮菜单归属侧边栏');
  }

  private normalizeOrder(value?: number) {
    const order = value ?? 1;
    if (!Number.isInteger(order) || order < 1)
      throw new BadRequestException('排序必须是正整数');
    return order;
  }

  private hasOwn<T extends object>(target: T, key: keyof T) {
    return Object.prototype.hasOwnProperty.call(target, key);
  }

  private async countAssignedRoles(permissionId: number) {
    return this.permissionRepository
      .createQueryBuilder('permission')
      .innerJoin('permission.roles', 'role')
      .where('permission.id = :permissionId', { permissionId })
      .getCount();
  }

  private buildTree(rows: Permission[]) {
    const nodeMap = new Map<number, Permission & { children?: Permission[] }>();
    rows.forEach(row => nodeMap.set(row.id, { ...row, children: [] }));
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

  private async getDirectChildCounts() {
    const rows = await this.permissionRepository
      .createQueryBuilder('permission')
      .select('permission.parentId', 'parentId')
      .addSelect('COUNT(permission.id)', 'count')
      .where('permission.parentId IS NOT NULL')
      .groupBy('permission.parentId')
      .getRawMany<{ parentId: number; count: string }>();
    return new Map(rows.map(row => [Number(row.parentId), Number(row.count)]));
  }

  private attachDirectChildCount(nodes: Array<Permission & { children?: Permission[] }>, directChildCounts: Map<number, number>) {
    for (const node of nodes) {
      Object.assign(node, { directChildCount: directChildCounts.get(node.id) || 0 });
      if (node.children?.length)
        this.attachDirectChildCount(node.children, directChildCounts);
    }
  }
}
