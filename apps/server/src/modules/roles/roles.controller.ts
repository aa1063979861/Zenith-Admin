import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissionCheck, RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { RoleUsersDto } from './dto/role-users.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('role')
export class RolesController {
  constructor(
    private readonly rolesService: RolesService,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  @RequirePermissions('RoleMgt', 'UserMgt')
  @Get()
  list(@Query() query: Record<string, string>) {
    return this.rolesService.list(query);
  }

  @RequirePermissions('RoleMgt')
  @Get('page')
  page(@Query() query: Record<string, string>) {
    return this.rolesService.page(query);
  }

  @Get('permissions/tree')
  rolePermissions(@CurrentUser() user: User) {
    if (user.builtIn)
      return this.rolesService.systemPermissionsTree();
    return this.rolesService.userPermissionsTree(
      user.id,
      (user as User & { currentRoleCode?: string }).currentRoleCode,
    );
  }

  @Post()
  @RequirePermissions('AddRole')
  async create(@Body() dto: CreateRoleDto, @CurrentUser() user: User) {
    const result = await this.rolesService.create(dto);
    await this.operationLogsService.record({
      module: '角色管理',
      action: '新增角色',
      targetType: 'role',
      targetId: result.id,
      targetName: result.name,
      user,
      detailJson: { code: result.code, permissionIds: result.permissions?.map(permission => permission.id) || [] },
    });
    return result;
  }

  @Patch('users/add/:roleId')
  @RequirePermissions('AddRoleUser')
  async addUsers(@Param('roleId') roleId: string, @Body() dto: RoleUsersDto, @CurrentUser() user: User) {
    const role = await this.rolesService.findOne(Number(roleId));
    const result = await this.rolesService.addUsers(Number(roleId), dto);
    await this.operationLogsService.record({
      module: '角色管理',
      action: '授权用户',
      targetType: 'role',
      targetId: role.id,
      targetName: role.name,
      user,
      detailJson: { userIds: dto.userIds },
    });
    return result;
  }

  @Patch('users/remove/:roleId')
  @RequirePermissions('RemoveRoleUser')
  async removeUsers(@Param('roleId') roleId: string, @Body() dto: RoleUsersDto, @CurrentUser() user: User) {
    const role = await this.rolesService.findOne(Number(roleId));
    const result = await this.rolesService.removeUsers(Number(roleId), dto);
    await this.operationLogsService.record({
      module: '角色管理',
      action: '取消授权用户',
      targetType: 'role',
      targetId: role.id,
      targetName: role.name,
      user,
      detailJson: { userIds: dto.userIds },
    });
    return result;
  }

  @Patch(':id')
  @RequirePermissionCheck('role:update')
  async update(@Param('id') id: string, @Body() dto: UpdateRoleDto, @CurrentUser() user: User) {
    const result = await this.rolesService.update(Number(id), dto);
    await this.operationLogsService.record({
      module: '角色管理',
      action: '更新角色',
      targetType: 'role',
      targetId: result.id,
      targetName: result.name,
      user,
      detailJson: { code: result.code, changedFields: Object.keys(dto) },
    });
    return result;
  }

  @Delete(':id')
  @RequirePermissions('DeleteRole')
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    const role = await this.rolesService.findOne(Number(id));
    const result = await this.rolesService.remove(Number(id));
    await this.operationLogsService.record({
      module: '角色管理',
      action: '删除角色',
      targetType: 'role',
      targetId: role.id,
      targetName: role.name,
      user,
      detailJson: { code: role.code },
    });
    return result;
  }
}
