import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RequirePermissionCheck, RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { CreateServiceCatalogDto } from './dto/create-service-catalog.dto';
import { UpdateServiceCatalogDto } from './dto/update-service-catalog.dto';
import { ServiceCatalogService } from './service-catalog.service';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('service-catalog')
export class ServiceCatalogController {
  constructor(private readonly serviceCatalogService: ServiceCatalogService) {}

  @RequirePermissions('OrderManagement', 'ClientManagement', 'CommissionRules', 'BusinessSettings')
  @Get()
  list(@Query() query: Record<string, string>) {
    return this.serviceCatalogService.list(query);
  }

  @RequirePermissions('AddServiceCatalog')
  @Post()
  create(@Body() dto: CreateServiceCatalogDto) {
    return this.serviceCatalogService.create(dto);
  }

  @RequirePermissionCheck('service-catalog:update')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateServiceCatalogDto) {
    return this.serviceCatalogService.update(id, dto);
  }

  @RequirePermissions('DeleteServiceCatalog')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.serviceCatalogService.remove(id);
  }
}
