import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { ARCHIVE_UPLOAD, UPLOAD_ROOT_DIR } from '../../common/upload.constants';
import { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { ParameterizedFileInterceptor } from '../system-parameters/parameterized-file.interceptor';
import { ARCHIVE_ALLOWED_EXTENSIONS } from './archive.constants';
import { ArchiveService, UploadedArchiveFile } from './archive.service';
import { CreateWeeklyReportDto } from './dto/create-weekly-report.dto';
import { UpdateWeeklyReportDto } from './dto/update-weekly-report.dto';

function incomingArchiveDir() {
  const dir = join(process.cwd(), UPLOAD_ROOT_DIR, ...ARCHIVE_UPLOAD.INCOMING_DIR);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function ArchiveFileInterceptor() {
  return ParameterizedFileInterceptor('file', {
    resolveMaxMb: parametersService => parametersService.getArchiveFileUploadMaxMb(),
    multerOptions: {
      dest: incomingArchiveDir(),
      fileFilter: (_request, file, callback) => {
        const allowed = ARCHIVE_ALLOWED_EXTENSIONS.includes(extname(file.originalname || '').toLowerCase() as typeof ARCHIVE_ALLOWED_EXTENSIONS[number]);
        callback(allowed ? null : new BadRequestException('只能上传 PDF、图片、Word、Excel 或常见视频文件'), allowed);
      },
    },
  });
}

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('archive')
export class ArchiveController {
  constructor(
    private readonly archiveService: ArchiveService,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  @Get('summary')
  summary() {
    return this.archiveService.summary();
  }

  @Get('link-targets')
  linkTargets(@Query() query: Record<string, string>) {
    return this.archiveService.linkTargets(query);
  }

  @Get('attachments')
  attachments(@Query() query: Record<string, string>) {
    return this.archiveService.attachments(query);
  }

  @Post('attachments')
  @RequirePermissions('UploadArchiveFile', 'ArchiveFiles', 'OrderManagement', 'MaintainFinanceInvoice')
  @UseInterceptors(ArchiveFileInterceptor())
  async uploadAttachment(
    @UploadedFile() file: UploadedArchiveFile,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: User,
  ) {
    const result = await this.archiveService.createAttachment(body, file, user);
    await this.operationLogsService.record({
      module: '资料中心',
      action: '上传业务归档',
      targetType: 'archive-attachment',
      targetId: result.id,
      targetName: result.name,
      user,
      detailJson: { tag: result.tag, links: result.links },
    });
    return result;
  }

  @Delete('attachments/:id')
  @RequirePermissions('DeleteArchiveFile')
  async removeAttachment(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    const file = await this.archiveService.resolveAttachmentFile(id);
    const result = await this.archiveService.removeAttachment(id);
    await this.operationLogsService.record({
      module: '资料中心',
      action: '删除资料文件',
      targetType: 'archive-attachment',
      targetId: id,
      targetName: file.attachment.name,
      user,
      detailJson: { originalName: file.attachment.originalName, storageKey: file.attachment.storageKey },
    });
    return result;
  }

  @Get('attachments/:id/preview')
  async previewAttachment(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User, @Res() response: any) {
    const file = await this.archiveService.resolveAttachmentFile(id);
    await this.operationLogsService.record({
      module: '资料中心',
      action: '预览资料文件',
      targetType: 'archive-attachment',
      targetId: id,
      targetName: file.attachment.name,
      user,
    });
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
    return response.sendFile(file.absolutePath);
  }

  @Get('attachments/:id/download')
  async downloadAttachment(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User, @Res() response: any) {
    const file = await this.archiveService.resolveAttachmentFile(id);
    await this.operationLogsService.record({
      module: '资料中心',
      action: '下载资料文件',
      targetType: 'archive-attachment',
      targetId: id,
      targetName: file.attachment.name,
      user,
    });
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
    return response.sendFile(file.absolutePath);
  }

  @Get('materials')
  materials(@Query() query: Record<string, string>) {
    return this.archiveService.materials(query);
  }

  @Post('materials')
  @RequirePermissions('ManageArchiveMaterial')
  @UseInterceptors(ArchiveFileInterceptor())
  async createMaterial(@UploadedFile() file: UploadedArchiveFile, @Body() body: Record<string, unknown>, @CurrentUser() user: User) {
    const result = await this.archiveService.createMaterial(body, file, user);
    await this.operationLogsService.record({
      module: '资料中心',
      action: '发布公司资料',
      targetType: 'archive-material',
      targetId: result.id,
      targetName: result.title,
      user,
      detailJson: { category: result.category, documentType: result.documentType, attachmentId: result.attachmentId },
    });
    return result;
  }

  @Patch('materials/:id')
  @RequirePermissions('ManageArchiveMaterial')
  @UseInterceptors(ArchiveFileInterceptor())
  async updateMaterial(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: UploadedArchiveFile | undefined,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: User,
  ) {
    const result = await this.archiveService.updateMaterial(id, body, file, user);
    await this.operationLogsService.record({
      module: '资料中心',
      action: '更新公司资料',
      targetType: 'archive-material',
      targetId: result.id,
      targetName: result.title,
      user,
      detailJson: { changedFields: Object.keys(body), replacedFile: Boolean(file) },
    });
    return result;
  }

  @Delete('materials/:id')
  @RequirePermissions('ManageArchiveMaterial')
  async removeMaterial(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    const result = await this.archiveService.removeMaterial(id);
    await this.operationLogsService.record({
      module: '资料中心',
      action: '删除公司资料',
      targetType: 'archive-material',
      targetId: id,
      user,
    });
    return result;
  }

  @Get('weekly-reports')
  weeklyReports(@Query() query: Record<string, string>) {
    return this.archiveService.weeklyReports(query);
  }

  @Post('weekly-reports')
  async createWeeklyReport(@Body() dto: CreateWeeklyReportDto, @CurrentUser() user: User) {
    const result = await this.archiveService.createWeeklyReport(dto, user);
    await this.operationLogsService.record({
      module: '资料中心',
      action: '创建周报',
      targetType: 'archive-weekly-report',
      targetId: result.id,
      targetName: result.title,
      user,
      detailJson: { weekStart: result.weekStart, weekEnd: result.weekEnd },
    });
    return result;
  }

  @Patch('weekly-reports/:id')
  async updateWeeklyReport(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateWeeklyReportDto, @CurrentUser() user: User) {
    const result = await this.archiveService.updateWeeklyReport(id, dto, user);
    await this.operationLogsService.record({
      module: '资料中心',
      action: '更新周报',
      targetType: 'archive-weekly-report',
      targetId: result.id,
      targetName: result.title,
      user,
      detailJson: { changedFields: Object.keys(dto) },
    });
    return result;
  }

  @Post('weekly-reports/generate-draft')
  async generateWeeklyDraft(@Body() body: Record<string, unknown>, @CurrentUser() user: User) {
    const result = await this.archiveService.generateWeeklyDraft(body, user);
    await this.operationLogsService.record({
      module: '资料中心',
      action: '生成周报草稿',
      targetType: 'archive-weekly-report',
      targetId: result.id,
      targetName: result.title,
      user,
      detailJson: { weekStart: result.weekStart, weekEnd: result.weekEnd, sourceType: result.sourceType },
    });
    return result;
  }

  @Post('weekly-reports/:id/submit')
  async submitWeeklyReport(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    const result = await this.archiveService.submitWeeklyReport(id, user);
    await this.operationLogsService.record({
      module: '资料中心',
      action: '提交周报',
      targetType: 'archive-weekly-report',
      targetId: result.id,
      targetName: result.title,
      user,
      detailJson: { weekStart: result.weekStart, weekEnd: result.weekEnd },
    });
    return result;
  }

  @Post('weekly-reports/:id/withdraw')
  async withdrawWeeklyReport(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    const result = await this.archiveService.withdrawWeeklyReport(id, user);
    await this.operationLogsService.record({
      module: '资料中心',
      action: '撤回周报',
      targetType: 'archive-weekly-report',
      targetId: result.id,
      targetName: result.title,
      user,
      detailJson: { weekStart: result.weekStart, weekEnd: result.weekEnd },
    });
    return result;
  }

  @Delete('weekly-reports/:id')
  async removeWeeklyReport(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.archiveService.removeWeeklyReport(id, user);
    await this.operationLogsService.record({
      module: '资料中心',
      action: '删除周报',
      targetType: 'archive-weekly-report',
      targetId: id,
      user,
    });
    return true;
  }
}
