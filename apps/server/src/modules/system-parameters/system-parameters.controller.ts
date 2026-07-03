import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { CreateSystemParameterDto } from './dto/create-system-parameter.dto';
import { UpdateSystemParameterDto } from './dto/update-system-parameter.dto';
import { SystemParametersService } from './system-parameters.service';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('system-parameters')
export class SystemParametersController {
  constructor(
    private readonly parametersService: SystemParametersService,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  @RequirePermissions('SystemParameters')
  @Get()
  page(@Query() query: Record<string, string>) {
    return this.parametersService.page(query);
  }

  @RequirePermissions('SystemParameters')
  @Get('groups')
  groups() {
    return this.parametersService.groups();
  }

  @Get('runtime')
  runtimeConfig() {
    return this.parametersService.runtimeConfig();
  }

  @Post()
  @RequirePermissions('AddSystemParameter')
  async create(@Body() dto: CreateSystemParameterDto, @CurrentUser() user: User) {
    const result = await this.parametersService.create(dto);
    await this.operationLogsService.record({
      module: '系统参数',
      action: '新增参数',
      targetType: 'system-parameter',
      targetId: result.id,
      targetName: result.paramName,
      user,
      detailJson: { paramKey: result.paramKey },
    });
    return result;
  }

  @Patch(':id')
  @RequirePermissions('EditSystemParameter')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSystemParameterDto, @CurrentUser() user: User) {
    const result = await this.parametersService.update(id, dto);
    await this.operationLogsService.record({
      module: '系统参数',
      action: '更新参数',
      targetType: 'system-parameter',
      targetId: result.id,
      targetName: result.paramName,
      user,
      detailJson: { paramKey: result.paramKey, changedFields: Object.keys(dto) },
    });
    return result;
  }

  @Delete(':id')
  @RequirePermissions('DeleteSystemParameter')
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    const parameter = await this.parametersService.findOne(id);
    const result = await this.parametersService.remove(id);
    await this.operationLogsService.record({
      module: '系统参数',
      action: '删除参数',
      targetType: 'system-parameter',
      targetId: parameter.id,
      targetName: parameter.paramName,
      user,
      detailJson: { paramKey: parameter.paramKey },
    });
    return result;
  }
}
