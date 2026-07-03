import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @RequirePermissions('BusinessSettings')
  @Get()
  page(@Query() query: Record<string, string>) {
    return this.announcementsService.page(query);
  }

  @Get('active')
  active(@Query('limit') limit?: string) {
    return this.announcementsService.active(Number(limit || 5));
  }

  @RequirePermissions('BusinessSettings')
  @Post()
  create(@Body() dto: CreateAnnouncementDto, @CurrentUser() user: User) {
    return this.announcementsService.create(dto, user);
  }

  @RequirePermissions('BusinessSettings')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAnnouncementDto) {
    return this.announcementsService.update(id, dto);
  }

  @RequirePermissions('BusinessSettings')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.announcementsService.remove(id);
  }
}
