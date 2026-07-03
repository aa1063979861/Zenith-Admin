import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @RequirePermissions('BusinessDashboard')
  @Get('overview')
  overview(@Query() query: Record<string, string>) {
    return this.dashboardService.overview(query);
  }

  @Get('workbench')
  workbench(@Query() query: Record<string, string>, @CurrentUser() user: User) {
    return this.dashboardService.workbench(user, query);
  }
}
