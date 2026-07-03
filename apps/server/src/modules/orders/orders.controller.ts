import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrdersService } from './orders.service';
import { ServiceItemsService } from './service-items.service';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller()
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly serviceItemsService: ServiceItemsService,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  @RequirePermissions('OrderManagement', 'ClientManagement')
  @Get('orders')
  page(@Query() query: Record<string, string>) {
    return this.ordersService.page(query);
  }

  @RequirePermissions('OrderManagement', 'ClientManagement')
  @Get('orders/:id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.detail(id);
  }

  @Post('orders')
  @RequirePermissions('AddOrder')
  async create(@Body() dto: CreateOrderDto, @CurrentUser() user: User) {
    const result = await this.ordersService.create(dto);
    await this.operationLogsService.record({
      module: '订单管理',
      action: '创建订单',
      targetType: 'order',
      targetId: result.id,
      targetName: result.orderNo,
      user,
      detailJson: { clientId: result.clientId, unitName: result.unitName, serviceYear: result.serviceYear, serviceItemCount: result.serviceItemCount },
    });
    return result;
  }

  @Patch('orders/:id')
  @RequirePermissions('EditOrder')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOrderDto, @CurrentUser() user: User) {
    const result = await this.ordersService.update(id, dto);
    await this.operationLogsService.record({
      module: '订单管理',
      action: '更新订单',
      targetType: 'order',
      targetId: result.id,
      targetName: result.orderNo,
      user,
      detailJson: { changedFields: Object.keys(dto), status: result.status },
    });
    return result;
  }

  @Delete('orders/:id')
  @RequirePermissions('DeleteOrder')
  async remove(@Param('id', ParseIntPipe) id: number, @Body('reason') reason: string | undefined, @CurrentUser() user: User) {
    const result = await this.ordersService.remove(id, reason);
    await this.operationLogsService.record({
      module: '订单管理',
      action: '删除订单',
      targetType: 'order',
      targetId: result.id,
      targetName: result.orderNo,
      user,
      detailJson: {
        clientId: result.clientId,
        unitName: result.unitName,
        serviceYear: result.serviceYear,
        status: result.status,
        serviceItemCount: result.serviceItemCount,
        reason: result.reason,
      },
    });
    return result;
  }

  @Post('orders/:id/service-items/:itemId/renew')
  @RequirePermissions('AddOrder')
  async renewServiceItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @CurrentUser() user: User,
  ) {
    const result = await this.ordersService.renewServiceItem(id, itemId);
    await this.operationLogsService.record({
      module: '订单管理',
      action: '续签服务项',
      targetType: 'order',
      targetId: result.id,
      targetName: result.orderNo,
      user,
      detailJson: { sourceOrderId: id, sourceServiceItemId: itemId, newOrderNo: result.orderNo },
    });
    return result;
  }

  @RequirePermissions('OrderManagement', 'ClientManagement', 'ViewFinance')
  @Get('service-items')
  serviceItems(@Query() query: Record<string, string>) {
    return this.serviceItemsService.page(query);
  }
}
