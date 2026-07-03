import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResolveTablePreferenceDto } from './dto/resolve-table-preference.dto';
import { SaveUserTablePreferenceDto } from './dto/save-user-table-preference.dto';
import { TablePreferencesService } from './table-preferences.service';

@UseGuards(JwtAuthGuard)
@Controller('table-preferences')
export class TablePreferencesController {
  constructor(private readonly tablePreferencesService: TablePreferencesService) {}

  @Post(':tableKey/resolve')
  resolve(@Param('tableKey') tableKey: string, @Body() dto: ResolveTablePreferenceDto, @CurrentUser() user: User) {
    return this.tablePreferencesService.resolveForUser(tableKey, user.id, dto.defaultConfig);
  }

  @Patch(':tableKey/user')
  saveUser(@Param('tableKey') tableKey: string, @Body() dto: SaveUserTablePreferenceDto, @CurrentUser() user: User) {
    return this.tablePreferencesService.saveUserConfig(tableKey, user.id, dto.settings);
  }

  @Delete(':tableKey/user')
  resetUser(@Param('tableKey') tableKey: string, @CurrentUser() user: User) {
    return this.tablePreferencesService.resetUserConfig(tableKey, user.id);
  }
}
