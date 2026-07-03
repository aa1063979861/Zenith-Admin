import { Controller, Get, UseGuards } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { KdocsService } from './kdocs.service';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('kdocs')
export class KdocsController {
  constructor(private readonly kdocsService: KdocsService) {}

  @Get('history/links')
  @RequirePermissions('KingsoftDocs')
  historyLinks() {
    return this.kdocsService.historyLinks();
  }
}
