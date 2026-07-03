import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../../../entities/permission.entity';
import { User } from '../../../entities/user.entity';
import {
  PermissionCheck,
  REQUIRED_PERMISSION_CHECK_KEY,
  REQUIRED_PERMISSION_MODE_KEY,
  REQUIRED_PERMISSIONS_KEY,
} from '../decorators/require-permissions.decorator';

type RequestUser = User & {
  currentRoleCode?: string;
};

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Permission) private readonly permissionRepository: Repository<Permission>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredCodes = await this.resolveRequiredCodes(context);
    if (!requiredCodes.length)
      return true;

    const user = context.switchToHttp().getRequest().user as RequestUser | undefined;
    if (!user)
      throw new ForbiddenException('无权访问');
    if (user.builtIn)
      return true;

    const permissionCodes = await this.loadCurrentRolePermissionCodes(user.id, user.currentRoleCode);
    const shouldRequireEveryCode = this.shouldRequireEveryCode(context);
    const allowed = shouldRequireEveryCode
      ? requiredCodes.every(code => permissionCodes.has(code))
      : requiredCodes.some(code => permissionCodes.has(code));
    if (!allowed)
      throw new ForbiddenException('当前角色没有该功能权限');

    return true;
  }

  private async resolveRequiredCodes(context: ExecutionContext) {
    const staticCodes = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) || [];
    if (staticCodes.length)
      return staticCodes;

    const permissionCheck = this.reflector.getAllAndOverride<PermissionCheck>(REQUIRED_PERMISSION_CHECK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permissionCheck)
      return [];

    return this.resolveDynamicRequiredCodes(context, permissionCheck);
  }

  private async resolveDynamicRequiredCodes(context: ExecutionContext, permissionCheck: PermissionCheck) {
    if (permissionCheck === 'dictionary:update')
      return this.resolveDictionaryUpdateCodes(context);
    if (permissionCheck === 'service-catalog:update')
      return this.resolveServiceCatalogUpdateCodes(context);
    if (permissionCheck === 'client:update')
      return this.resolveClientUpdateCodes(context);
    if (permissionCheck === 'role:update')
      return this.resolveRoleUpdateCodes(context);
    if (permissionCheck === 'user:update')
      return this.resolveUserUpdateCodes(context);
    return this.resolvePermissionResourceCodes(context, permissionCheck);
  }

  private async resolvePermissionResourceCodes(context: ExecutionContext, permissionCheck: PermissionCheck) {
    const request = context.switchToHttp().getRequest<{ params: Record<string, string>; body: { type?: string } }>();
    if (permissionCheck === 'permission:create')
      return request.body?.type === 'BUTTON' ? ['AddButton'] : ['AddMenu'];

    const permissionId = Number(request.params?.id);
    if (!Number.isInteger(permissionId))
      throw new ForbiddenException('菜单权限参数异常');

    const permission = await this.permissionRepository.findOne({ where: { id: permissionId } });
    if (!permission)
      throw new ForbiddenException('菜单不存在');

    if (permissionCheck === 'permission:update')
      return this.resolvePermissionUpdateCodes(context, permission);
    if (permissionCheck === 'permission:delete')
      return permission.type === 'BUTTON' ? ['DeleteButton'] : ['DeleteMenu'];

    return [];
  }

  private resolveRoleUpdateCodes(context: ExecutionContext) {
    const body = context.switchToHttp().getRequest<{ body: Record<string, unknown> }>().body || {};
    const codes = new Set<string>();
    if (Object.prototype.hasOwnProperty.call(body, 'name') || Object.prototype.hasOwnProperty.call(body, 'permissionIds'))
      codes.add('EditRole');
    if (Object.prototype.hasOwnProperty.call(body, 'enable'))
      codes.add('ToggleRole');
    return [...codes];
  }

  private resolvePermissionUpdateCodes(context: ExecutionContext, permission: Permission) {
    const body = context.switchToHttp().getRequest<{ body: Record<string, unknown> }>().body || {};
    const codes = new Set<string>();
    if (Object.prototype.hasOwnProperty.call(body, 'enable')) {
      if (permission.type === 'BUTTON')
        codes.add('ToggleButton');
      else
        codes.add('EditMenu');
    }

    const editableFields = [
      'code',
      'name',
      'type',
      'parentId',
      'path',
      'component',
      'icon',
      'layout',
      'activeMenuCode',
      'show',
      'keepAlive',
      'order',
    ];
    if (editableFields.some(field => Object.prototype.hasOwnProperty.call(body, field))) {
      if (permission.type === 'BUTTON')
        codes.add('EditButton');
      else
        codes.add('EditMenu');
    }

    return [...codes];
  }

  private resolveDictionaryUpdateCodes(context: ExecutionContext) {
    const body = context.switchToHttp().getRequest<{ body: Record<string, unknown> }>().body || {};
    const codes = new Set<string>();
    if (Object.prototype.hasOwnProperty.call(body, 'enabled'))
      codes.add('ToggleDictionaryItem');

    const editableFields = [
      'name',
      'sort',
      'remark',
    ];
    if (editableFields.some(field => Object.prototype.hasOwnProperty.call(body, field)))
      codes.add('EditDictionaryItem');

    return [...codes];
  }

  private resolveServiceCatalogUpdateCodes(context: ExecutionContext) {
    const body = context.switchToHttp().getRequest<{ body: Record<string, unknown> }>().body || {};
    const codes = new Set<string>();
    if (Object.prototype.hasOwnProperty.call(body, 'enabled'))
      codes.add('ToggleServiceCatalog');

    const editableFields = [
      'name',
      'category',
      'defaultPrice',
      'minMonths',
      'reminderEnabled',
      'sort',
      'remark',
    ];
    if (editableFields.some(field => Object.prototype.hasOwnProperty.call(body, field)))
      codes.add('EditServiceCatalog');

    return [...codes];
  }

  private resolveClientUpdateCodes(context: ExecutionContext) {
    const body = context.switchToHttp().getRequest<{ body: Record<string, unknown> }>().body || {};
    const codes = new Set<string>();
    const restrictedFields = ['customerLevel', 'unitStatus'];
    if (restrictedFields.some(field => Object.prototype.hasOwnProperty.call(body, field)))
      codes.add('MaintainClientLevel');

    const editableFields = [
      'regionCode',
      'unitCode',
      'unitName',
      'unifiedSocialCreditCode',
      'legalPerson',
      'financeStaff',
      'financeManager',
      'address',
      'contactPhone',
      'remark',
      'reason',
    ];
    if (editableFields.some(field => Object.prototype.hasOwnProperty.call(body, field)))
      codes.add('EditClient');
    return [...codes];
  }

  private resolveUserUpdateCodes(context: ExecutionContext) {
    const body = context.switchToHttp().getRequest<{ body: Record<string, unknown> }>().body || {};
    const codes = new Set<string>();
    if (Object.prototype.hasOwnProperty.call(body, 'roleIds'))
      codes.add('AssignUserRoles');
    if (Object.prototype.hasOwnProperty.call(body, 'enable'))
      codes.add('ToggleUser');

    const profileFields = [
      'nickName',
      'gender',
      'address',
      'email',
      'employeeName',
      'positionCode',
      'departmentCode',
      'employeeNo',
      'phone',
      'entryDate',
      'birthday',
      'emergencyContact',
      'emergencyPhone',
      'profileRemark',
    ];
    if (profileFields.some(field => Object.prototype.hasOwnProperty.call(body, field)))
      codes.add('EditTeamProfile');

    return [...codes];
  }

  private shouldRequireEveryCode(context: ExecutionContext) {
    const staticMode = this.reflector.getAllAndOverride<'any' | 'all'>(REQUIRED_PERMISSION_MODE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (staticMode)
      return staticMode === 'all';

    const permissionCheck = this.reflector.getAllAndOverride<PermissionCheck>(REQUIRED_PERMISSION_CHECK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    return ['dictionary:update', 'service-catalog:update', 'client:update', 'permission:update', 'role:update', 'user:update'].includes(permissionCheck || '');
  }

  private async loadCurrentRolePermissionCodes(userId: number, currentRoleCode?: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId, enable: true },
      relations: ['roles', 'roles.permissions'],
    });
    if (!user)
      throw new ForbiddenException('当前账号不可用');

    const enabledRoles = (user.roles || []).filter(role => role.enable);
    const currentRole = currentRoleCode
      ? enabledRoles.find(role => role.code === currentRoleCode)
      : undefined;
    const roles = currentRole ? [currentRole] : enabledRoles.slice(0, 1);

    const permissionCodes = new Set<string>();
    for (const role of roles) {
      for (const permission of role.permissions || []) {
        if (permission.enable)
          permissionCodes.add(permission.code);
      }
    }
    return permissionCodes;
  }
}
