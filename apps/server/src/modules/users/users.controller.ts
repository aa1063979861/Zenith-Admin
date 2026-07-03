import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, ParseIntPipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { PROFILE_AVATAR_UPLOAD, UPLOAD_ROOT_DIR } from '../../common/upload.constants';
import { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissionCheck, RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { ParameterizedFileInterceptor } from '../system-parameters/parameterized-file.interceptor';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateTeamProfileDto } from './dto/update-team-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { TeamService } from './team.service';
import { UploadedProfileAvatarFile, UsersService } from './users.service';

function profileAvatarIncomingDir() {
  const dir = join(process.cwd(), UPLOAD_ROOT_DIR, ...PROFILE_AVATAR_UPLOAD.INCOMING_DIR);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function ProfileAvatarInterceptor() {
  return ParameterizedFileInterceptor('file', {
    resolveMaxMb: parametersService => parametersService.getAvatarUploadMaxMb(),
    multerOptions: {
      dest: profileAvatarIncomingDir(),
      fileFilter: (_request, file, callback) => {
        const allowed = PROFILE_AVATAR_UPLOAD.ALLOWED_EXTENSIONS.includes(extname(file.originalname || '').toLowerCase() as typeof PROFILE_AVATAR_UPLOAD.ALLOWED_EXTENSIONS[number]);
        callback(allowed ? null : new BadRequestException('只能上传 png、jpg、jpeg、webp 或 gif 图片'), allowed);
      },
    },
  });
}

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly teamService: TeamService,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  @RequirePermissions('UserMgt', 'RoleMgt')
  @Get('user')
  page(@Query() query: Record<string, string>) {
    return this.usersService.page(query);
  }

  @RequirePermissions('TeamManagement', 'OrderManagement', 'CommissionRules')
  @Get('employees')
  employees() {
    return this.teamService.employees();
  }

  @RequirePermissions('TeamManagement')
  @Get('team')
  team(@Query() query: Record<string, string>) {
    return this.teamService.page(query);
  }

  @RequirePermissions('TeamManagement')
  @Get('team/summary')
  teamSummary() {
    return this.teamService.summary();
  }

  @Patch('team/:id/profile')
  @RequirePermissions('EditTeamProfile')
  async updateTeamProfile(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTeamProfileDto, @CurrentUser() user: User) {
    const result = await this.teamService.updateProfile(id, dto);
    await this.operationLogsService.record({
      module: '组织管理',
      action: '更新员工档案',
      targetType: 'employee-profile',
      targetId: result.id,
      targetName: result.employeeName || result.username,
      user,
      detailJson: { changedFields: Object.keys(dto) },
    });
    return result;
  }

  @Get('user/detail')
  detail(@CurrentUser() user: User) {
    return this.usersService.detail(user.id, (user as User & { currentRoleCode?: string }).currentRoleCode);
  }

  @Post('user')
  @RequirePermissions('AddUser')
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: User) {
    const result = await this.usersService.create(dto);
    await this.operationLogsService.record({
      module: '用户管理',
      action: '新增用户',
      targetType: 'user',
      targetId: result.id,
      targetName: result.employeeProfile?.name || result.nickName || result.username,
      user,
      detailJson: { username: result.username, roleIds: result.roles?.map(role => role.id) || [] },
    });
    return result;
  }

  @Patch('user/profile/:id')
  async updateProfile(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProfileDto, @CurrentUser() user: User) {
    if (id !== user.id)
      throw new ForbiddenException('只能修改自己的个人资料');

    const result = await this.usersService.updateProfile(id, dto);
    await this.operationLogsService.record({
      module: '个人资料',
      action: '更新个人资料',
      targetType: 'user',
      targetId: result.id,
      targetName: result.employeeProfile?.name || result.nickName || result.username,
      user,
      detailJson: { username: result.username, changedFields: Object.keys(dto) },
    });
    return result;
  }

  @Post('user/profile/:id/avatar')
  @UseInterceptors(ProfileAvatarInterceptor())
  async uploadProfileAvatar(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: UploadedProfileAvatarFile,
    @CurrentUser() user: User,
  ) {
    if (id !== user.id)
      throw new ForbiddenException('只能上传自己的头像');
    return this.usersService.saveProfileAvatarFile(file);
  }

  @Patch('user/password/reset/:id')
  @RequirePermissions('ResetUserPassword')
  async resetPassword(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    const target = await this.usersService.findOne(id);
    const result = await this.usersService.resetPassword(id);
    await this.operationLogsService.record({
      module: '用户管理',
      action: '重置密码',
      targetType: 'user',
      targetId: target.id,
      targetName: target.employeeProfile?.name || target.nickName || target.username,
      user,
      detailJson: { username: target.username },
    });
    return result;
  }

  @Patch('user/:id')
  @RequirePermissionCheck('user:update')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto, @CurrentUser() user: User) {
    const result = await this.usersService.update(id, dto);
    await this.operationLogsService.record({
      module: '用户管理',
      action: '更新用户',
      targetType: 'user',
      targetId: result.id,
      targetName: result.employeeProfile?.name || result.nickName || result.username,
      user,
      detailJson: { username: result.username, changedFields: Object.keys(dto) },
    });
    return result;
  }

  @Delete('user/:id')
  @RequirePermissions('DeleteUser')
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    const target = await this.usersService.findOne(id);
    const result = await this.usersService.remove(id);
    await this.operationLogsService.record({
      module: '用户管理',
      action: '删除用户',
      targetType: 'user',
      targetId: target.id,
      targetName: target.employeeProfile?.name || target.nickName || target.username,
      user,
      detailJson: { username: target.username },
    });
    return result;
  }
}
