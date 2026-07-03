import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissionCheck, RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { CreateDictionaryItemDto } from './dto/create-dictionary-item.dto';
import { UpdateDictionaryItemDto } from './dto/update-dictionary-item.dto';
import { DictionariesService } from './dictionaries.service';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('dictionary-items')
export class DictionariesController {
  constructor(
    private readonly dictionariesService: DictionariesService,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  @RequirePermissions('BusinessSettings', 'ClientManagement', 'OrderManagement', 'TeamManagement', 'CommissionRules')
  @Get()
  list(@Query() query: Record<string, string>) {
    return this.dictionariesService.list(query);
  }

  @RequirePermissions('BusinessSettings')
  @Get('definitions')
  listDefinitions() {
    return this.dictionariesService.listDefinitions();
  }

  @Post()
  @RequirePermissions('AddDictionaryItem')
  async create(@Body() dto: CreateDictionaryItemDto, @CurrentUser() user: User) {
    const result = await this.dictionariesService.create(dto);
    await this.operationLogsService.record({
      module: '数据字典',
      action: '新增字典项',
      targetType: 'dictionary-item',
      targetId: result.id,
      targetName: result.name,
      user,
      detailJson: { dictionaryType: result.dictionaryType, code: result.code },
    });
    return result;
  }

  @Patch(':id')
  @RequirePermissionCheck('dictionary:update')
  async update(@Param('id') id: string, @Body() dto: UpdateDictionaryItemDto, @CurrentUser() user: User) {
    const result = await this.dictionariesService.update(Number(id), dto);
    await this.operationLogsService.record({
      module: '数据字典',
      action: '更新字典项',
      targetType: 'dictionary-item',
      targetId: result.id,
      targetName: result.name,
      user,
      detailJson: { dictionaryType: result.dictionaryType, code: result.code, changedFields: Object.keys(dto) },
    });
    return result;
  }

  @Delete(':id')
  @RequirePermissions('DeleteDictionaryItem')
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    const item = await this.dictionariesService.findOne(Number(id));
    const result = await this.dictionariesService.remove(Number(id));
    await this.operationLogsService.record({
      module: '数据字典',
      action: '删除字典项',
      targetType: 'dictionary-item',
      targetId: item.id,
      targetName: item.name,
      user,
      detailJson: { dictionaryType: item.dictionaryType, code: item.code },
    });
    return result;
  }
}
