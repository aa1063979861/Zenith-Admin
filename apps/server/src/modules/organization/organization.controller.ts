import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { OrganizationService } from './organization.service';

type DepartmentNode = {
  id: number;
  code?: string;
  name?: string;
  children?: DepartmentNode[];
};

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('organization')
export class OrganizationController {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  @RequirePermissions('TeamManagement')
  @Get('summary')
  summary() {
    return this.organizationService.summary();
  }

  @RequirePermissions('TeamManagement', 'UserMgt')
  @Get('departments/options')
  departmentOptions() {
    return this.organizationService.departmentOptions();
  }

  @RequirePermissions('TeamManagement')
  @Get('departments')
  departments() {
    return this.organizationService.listDepartments();
  }

  @Post('departments')
  @RequirePermissions('AddDepartment')
  async createDepartment(@Body() dto: CreateDepartmentDto, @CurrentUser() user: User) {
    const result = await this.organizationService.createDepartment(dto);
    await this.operationLogsService.record({
      module: '组织管理',
      action: '新增部门',
      targetType: 'org-department',
      targetId: result.id,
      targetName: result.name,
      user,
      detailJson: { code: result.code, parentId: result.parentId },
    });
    return result;
  }

  @Patch('departments/:id')
  @RequirePermissions('EditDepartment')
  async updateDepartment(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDepartmentDto, @CurrentUser() user: User) {
    const result = await this.organizationService.updateDepartment(id, dto);
    await this.operationLogsService.record({
      module: '组织管理',
      action: '更新部门',
      targetType: 'org-department',
      targetId: result.id,
      targetName: result.name,
      user,
      detailJson: { changedFields: Object.keys(dto) },
    });
    return result;
  }

  @Delete('departments/:id')
  @RequirePermissions('DeleteDepartment')
  async removeDepartment(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    const departments = await this.organizationService.listDepartments();
    const target = this.findDepartmentNode(departments, id);
    const result = await this.organizationService.removeDepartment(id);
    await this.operationLogsService.record({
      module: '组织管理',
      action: '删除部门',
      targetType: 'org-department',
      targetId: id,
      targetName: target?.name || String(id),
      user,
      detailJson: { code: target?.code },
    });
    return result;
  }

  private findDepartmentNode(nodes: DepartmentNode[], id: number): DepartmentNode | null {
    for (const node of nodes) {
      if (node.id === id)
        return node;
      const found = this.findDepartmentNode(node.children || [], id);
      if (found)
        return found;
    }
    return null;
  }
}
