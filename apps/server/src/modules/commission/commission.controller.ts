import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { CreateCommissionRuleDto } from './dto/create-commission-rule.dto';
import { GenerateCommissionDraftDto } from './dto/generate-commission-draft.dto';
import { UpdateCommissionRuleDto } from './dto/update-commission-rule.dto';
import { CommissionService } from './commission.service';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('commission')
export class CommissionController {
  constructor(private readonly commissionService: CommissionService) {}

  @RequirePermissions('CommissionRules')
  @Get('rules')
  rules(@Query() query: Record<string, string>) {
    return this.commissionService.rules(query);
  }

  @RequirePermissions('AddCommissionRule')
  @Post('rules')
  createRule(@Body() dto: CreateCommissionRuleDto) {
    return this.commissionService.createRule(dto);
  }

  @RequirePermissions('EditCommissionRule')
  @Patch('rules/:id')
  updateRule(@Param('id') id: string, @Body() dto: UpdateCommissionRuleDto) {
    return this.commissionService.updateRule(Number(id), dto);
  }

  @RequirePermissions('DeleteCommissionRule')
  @Delete('rules/:id')
  deleteRule(@Param('id') id: string) {
    return this.commissionService.deleteRule(Number(id));
  }

  @RequirePermissions('CommissionRules')
  @Get('settlement-items')
  settlementItems(@Query() query: Record<string, string>) {
    return this.commissionService.settlementItems(query);
  }

  @RequirePermissions('CommissionRules')
  @Get('settlements')
  settlements(@Query() query: Record<string, string>) {
    return this.commissionService.settlements(query);
  }

  @RequirePermissions('CommissionRules')
  @Get('settlements/:id')
  settlementDetail(@Param('id') id: string) {
    return this.commissionService.settlementDetail(Number(id));
  }

  @RequirePermissions('CommissionRules')
  @Get('lines')
  lines(@Query() query: Record<string, string>) {
    return this.commissionService.lines(query);
  }

  @RequirePermissions('GenerateCommissionSettlement')
  @Post('settlements/generate-draft')
  generateDraft(@Body() dto: GenerateCommissionDraftDto) {
    return this.commissionService.generateDraft(dto);
  }

  @RequirePermissions('GenerateCommissionSettlement')
  @Post('settlements/:id/recalculate')
  recalculate(@Param('id') id: string) {
    return this.commissionService.recalculateSettlement(Number(id));
  }

  @RequirePermissions('ConfirmCommissionSettlement')
  @Post('settlements/:id/confirm')
  confirm(@Param('id') id: string, @CurrentUser() user: User) {
    return this.commissionService.confirmSettlement(Number(id), user.id);
  }

  @RequirePermissions('PayCommissionSettlement')
  @Post('settlements/:id/mark-paid')
  markPaid(@Param('id') id: string) {
    return this.commissionService.markPaid(Number(id));
  }

  @RequirePermissions('CancelCommissionSettlement')
  @Post('settlements/:id/cancel')
  cancel(@Param('id') id: string) {
    return this.commissionService.cancelSettlement(Number(id));
  }
}
