import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { OperationLogsService } from './operation-logs.service';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('operation-logs')
export class OperationLogsController {
  constructor(private readonly operationLogsService: OperationLogsService) {}

  @RequirePermissions('OperationLogs')
  @Get('options')
  options() {
    return this.operationLogsService.options();
  }

  @RequirePermissions('OperationLogs')
  @Get()
  page(@Query() query: Record<string, string>) {
    return this.operationLogsService.page(query);
  }
}
