import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissionCheck, RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PermissionsService } from './permissions.service';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('permission')
export class PermissionsController {
  constructor(
    private readonly permissionsService: PermissionsService,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  @RequirePermissions('ResourceMgt', 'RoleMgt')
  @Get('tree')
  tree() {
    return this.permissionsService.tree();
  }

  @RequirePermissions('ResourceMgt')
  @Get('menu/tree')
  menuTree() {
    return this.permissionsService.tree('MENU');
  }

  @RequirePermissions('ResourceMgt')
  @Get('button/:parentId')
  buttons(@Param('parentId') parentId: string) {
    return this.permissionsService.buttons(Number(parentId));
  }

  @Get('menu/validate')
  validate(@Query('path') path: string) {
    return this.permissionsService.validateMenu(path);
  }

  @Post()
  @RequirePermissionCheck('permission:create')
  async create(@Body() dto: CreatePermissionDto, @CurrentUser() user: User) {
    const result = await this.permissionsService.create(dto);
    await this.operationLogsService.record({
      module: '菜单管理',
      action: permissionAction('新增', result.type),
      targetType: 'permission',
      targetId: result.id,
      targetName: result.name,
      user,
      detailJson: { code: result.code, type: result.type, parentId: result.parentId },
    });
    return result;
  }

  @Patch(':id')
  @RequirePermissionCheck('permission:update')
  async update(@Param('id') id: string, @Body() dto: UpdatePermissionDto, @CurrentUser() user: User) {
    const result = await this.permissionsService.update(Number(id), dto);
    await this.operationLogsService.record({
      module: '菜单管理',
      action: permissionAction('更新', result.type),
      targetType: 'permission',
      targetId: result.id,
      targetName: result.name,
      user,
      detailJson: { code: result.code, type: result.type, changedFields: Object.keys(dto) },
    });
    return result;
  }

  @Delete(':id')
  @RequirePermissionCheck('permission:delete')
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    const permission = await this.permissionsService.findOne(Number(id));
    const result = await this.permissionsService.remove(Number(id));
    await this.operationLogsService.record({
      module: '菜单管理',
      action: permissionAction('删除', permission.type),
      targetType: 'permission',
      targetId: permission.id,
      targetName: permission.name,
      user,
      detailJson: { code: permission.code, type: permission.type },
    });
    return result;
  }
}

function permissionAction(verb: string, type: string) {
  return `${verb}${type === 'BUTTON' ? '按钮' : '菜单'}`;
}
