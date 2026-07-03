import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { Brackets, Repository } from 'typeorm';
import { INVOICE_STATUS } from '../../common/business.constants';
import { normalizePage, pageResult } from '../../common/page';
import { parseOptionalPositiveInt } from '../../common/query';
import { resolveSort } from '../../common/sort';
import { ARCHIVE_UPLOAD, UPLOAD_ROOT_DIR, UPLOAD_URL_PREFIX } from '../../common/upload.constants';
import { normalizeUploadFileName } from '../../common/upload-file-name';
import { ArchiveAttachmentLink } from '../../entities/archive-attachment-link.entity';
import { ArchiveMaterial } from '../../entities/archive-material.entity';
import { ArchiveAttachment } from '../../entities/archive-attachment.entity';
import { ArchiveWeeklyReport, WeeklyDayWork } from '../../entities/archive-weekly-report.entity';
import { Client } from '../../entities/client.entity';
import { FinanceContractLine } from '../../entities/finance-contract-line.entity';
import { FinanceContract } from '../../entities/finance-contract.entity';
import { FinanceInvoiceLine } from '../../entities/finance-invoice-line.entity';
import { FinanceInvoice } from '../../entities/finance-invoice.entity';
import { FinancePayment } from '../../entities/finance-payment.entity';
import { Order } from '../../entities/order.entity';
import { ServiceItem } from '../../entities/service-item.entity';
import { User } from '../../entities/user.entity';
import { resolveUserDisplayName } from '../operation-logs/operation-logs.service';
import { SERVICE_ITEM_STATUS } from '../orders/order.constants';
import {
  ARCHIVE_ALLOWED_EXTENSIONS,
  ARCHIVE_ENTITY_TYPES,
  ARCHIVE_MATERIAL_STATUSES,
  ARCHIVE_MATERIAL_TYPES,
  ARCHIVE_WEEKLY_REPORT_SOURCE_TYPE,
  ARCHIVE_WEEKLY_REPORT_STATUS,
  ArchiveEntityType,
} from './archive.constants';
import { ArchiveLinkDto } from './dto/archive-link.dto';
import { CreateWeeklyReportDto } from './dto/create-weekly-report.dto';
import { UpdateWeeklyReportDto } from './dto/update-weekly-report.dto';

export type UploadedArchiveFile = {
  originalname: string;
  mimetype?: string;
  size?: number;
  path?: string;
  buffer?: Buffer;
};

type ArchiveQuery = {
  pageNo?: number;
  pageSize?: number;
  clientId?: string | number;
  keyword?: string;
  tag?: string;
  entityType?: string;
  linkedType?: string;
  entityId?: string | number;
  linkedId?: string | number;
  sortKey?: string;
  sortOrder?: string;
};

type MaterialQuery = ArchiveQuery & {
  category?: string;
  documentType?: string;
  status?: string;
};

type WeeklyReportQuery = ArchiveQuery & {
  weekStart?: string;
  weekEnd?: string;
  ownerUserId?: string | number;
  departmentName?: string;
  status?: string;
};

type LinkTarget = {
  entityType: ArchiveEntityType;
  entityId: number;
  entityName: string;
  clientId?: number | null;
  clientName?: string | null;
  serviceYear?: number | null;
};

type ResolvedArchiveLink = LinkTarget & {
  tag: string;
  remark?: string | null;
};

@Injectable()
export class ArchiveService {
  constructor(
    @InjectRepository(ArchiveAttachment) private readonly attachmentRepository: Repository<ArchiveAttachment>,
    @InjectRepository(ArchiveAttachmentLink) private readonly linkRepository: Repository<ArchiveAttachmentLink>,
    @InjectRepository(ArchiveMaterial) private readonly materialRepository: Repository<ArchiveMaterial>,
    @InjectRepository(ArchiveWeeklyReport) private readonly weeklyReportRepository: Repository<ArchiveWeeklyReport>,
    @InjectRepository(Client) private readonly clientRepository: Repository<Client>,
    @InjectRepository(Order) private readonly orderRepository: Repository<Order>,
    @InjectRepository(ServiceItem) private readonly serviceItemRepository: Repository<ServiceItem>,
    @InjectRepository(FinanceContract) private readonly contractRepository: Repository<FinanceContract>,
    @InjectRepository(FinanceContractLine) private readonly contractLineRepository: Repository<FinanceContractLine>,
    @InjectRepository(FinanceInvoice) private readonly invoiceRepository: Repository<FinanceInvoice>,
    @InjectRepository(FinanceInvoiceLine) private readonly invoiceLineRepository: Repository<FinanceInvoiceLine>,
    @InjectRepository(FinancePayment) private readonly paymentRepository: Repository<FinancePayment>,
  ) {}

  async summary() {
    const [
      fileCount,
      businessLinkCount,
      materialCount,
      videoCount,
      weeklyReportCount,
      orderCount,
      contractOrderIds,
      invoiceOrderIds,
    ] = await Promise.all([
      this.attachmentRepository.count(),
      this.linkRepository.count(),
      this.materialRepository.count(),
      this.materialRepository.count({ where: { documentType: '视频' } }),
      this.weeklyReportRepository.count(),
      this.orderRepository.count(),
      this.orderIdsByContractLines(),
      this.orderIdsByInvoiceLines(),
    ]);

    return {
      fileCount,
      businessLinkCount,
      materialCount,
      videoCount,
      weeklyReportCount,
      missingContractOrders: Math.max(0, orderCount - contractOrderIds.size),
      missingInvoiceOrders: Math.max(0, orderCount - invoiceOrderIds.size),
    };
  }

  async attachments(query: ArchiveQuery) {
    const { pageSize, skip } = normalizePage(query);
    const clientId = parseOptionalPositiveInt(query.clientId, '客户ID');
    const entityId = parseOptionalPositiveInt(query.entityId ?? query.linkedId, '关联对象ID');
    const entityType = this.cleanText(query.entityType || query.linkedType);
    const keyword = this.cleanText(query.keyword);

    const qb = this.attachmentRepository
      .createQueryBuilder('attachment')
      .leftJoinAndSelect('attachment.client', 'client')
      .leftJoinAndSelect('attachment.links', 'link')
      .distinct(true)
      .skip(skip)
      .take(pageSize);

    if (clientId) {
      qb.andWhere(new Brackets((where) => {
        where.where('attachment.clientId = :clientId', { clientId })
          .orWhere('link.clientId = :clientId', { clientId });
      }));
    }
    if (query.tag) {
      qb.andWhere(new Brackets((where) => {
        where.where('attachment.tag = :tag', { tag: query.tag })
          .orWhere('link.tag = :tag', { tag: query.tag });
      }));
    }
    if (entityType) {
      this.assertEntityType(entityType);
      qb.andWhere(new Brackets((where) => {
        where.where('attachment.linkedType = :entityType', { entityType })
          .orWhere('link.entityType = :entityType', { entityType });
      }));
    }
    if (entityId) {
      qb.andWhere(new Brackets((where) => {
        where.where('attachment.linkedId = :entityId', { entityId })
          .orWhere('link.entityId = :entityId', { entityId });
      }));
    }
    if (keyword) {
      qb.andWhere(new Brackets((where) => {
        where.where('attachment.name LIKE :keyword', { keyword: `%${keyword}%` })
          .orWhere('attachment.originalName LIKE :keyword', { keyword: `%${keyword}%` })
          .orWhere('attachment.remark LIKE :keyword', { keyword: `%${keyword}%` })
          .orWhere('attachment.linkedName LIKE :keyword', { keyword: `%${keyword}%` })
          .orWhere('client.unitName LIKE :keyword', { keyword: `%${keyword}%` })
          .orWhere('link.entityName LIKE :keyword', { keyword: `%${keyword}%` })
          .orWhere('link.clientName LIKE :keyword', { keyword: `%${keyword}%` });
      }));
    }

    const sort = resolveSort(query.sortKey, query.sortOrder, {
      name: 'attachment.name',
      tag: 'attachment.tag',
      currentClientName: 'client.unitName',
      linkedTo: 'attachment.linkedName',
      linkedType: 'attachment.linkedType',
      uploadedAt: 'attachment.uploadedAt',
      sizeBytes: 'attachment.sizeBytes',
      createTime: 'attachment.createTime',
      updateTime: 'attachment.updateTime',
    });
    if (sort)
      qb.orderBy(sort.column, sort.direction).addOrderBy('attachment.id', 'DESC');
    else
      qb.orderBy('attachment.uploadedAt', 'DESC').addOrderBy('attachment.id', 'DESC');

    const [rows, total] = await qb.getManyAndCount();
    return pageResult(rows.map(row => this.toAttachmentRow(row)), total);
  }

  async createAttachment(body: Record<string, unknown>, file: UploadedArchiveFile | undefined, user: User) {
    const incomingPath = file?.path;
    try {
      if (!file)
        throw new BadRequestException('请选择上传文件');
      const tag = this.requiredText(body.tag, '资料标签');
      const links = await this.resolveLinks(this.parseLinkInputs(body, tag), tag);
      const primaryLink = links[0];
      const savedFile = await this.saveFileAttachment({
        file,
        tag,
        name: this.cleanText(body.name) || normalizeUploadFileName(file.originalname),
        remark: this.cleanText(body.remark) || null,
        user,
        primaryLink,
      });
      const attachment = savedFile.attachment;
      const savedLinks = await this.linkRepository.save(links.map(link => this.linkRepository.create({
        attachmentId: attachment.id,
        entityType: link.entityType,
        entityId: link.entityId,
        entityName: link.entityName,
        clientId: link.clientId || null,
        clientName: link.clientName || null,
        serviceYear: link.serviceYear || null,
        tag: link.tag,
        remark: link.remark,
      })));
      attachment.links = savedLinks;
      const row: ReturnType<ArchiveService['toAttachmentRow']> & { duplicateOf?: ReturnType<ArchiveService['toDuplicateAttachmentRow']> } = this.toAttachmentRow(attachment);
      if (savedFile.duplicateOf)
        row.duplicateOf = savedFile.duplicateOf;
      return row;
    }
    catch (error) {
      await this.removeIncomingFile(incomingPath);
      throw error;
    }
  }

  async removeAttachment(id: number) {
    const attachment = await this.attachmentRepository.findOne({ where: { id }, relations: ['links'] });
    if (!attachment)
      throw new NotFoundException('资料文件不存在');
    if (attachment.links?.length)
      await this.linkRepository.softRemove(attachment.links);
    await this.attachmentRepository.softRemove(attachment);
    return true;
  }

  async resolveAttachmentFile(id: number) {
    const attachment = await this.attachmentRepository.findOne({ where: { id } });
    if (!attachment)
      throw new NotFoundException('资料文件不存在');
    const absolutePath = this.resolveAttachmentPath(attachment);
    if (!absolutePath)
      throw new NotFoundException('资料文件缺少存储路径');
    try {
      await stat(absolutePath);
    }
    catch {
      throw new NotFoundException('资料文件不存在或已被移动');
    }
    return {
      attachment,
      absolutePath,
      fileName: attachment.originalName || attachment.name,
      mimeType: attachment.mimeType || 'application/octet-stream',
    };
  }

  async linkTargets(query: { entityType?: string; keyword?: string }) {
    const entityType = this.assertEntityType(this.requiredText(query.entityType, '关联类型'));
    const keyword = this.cleanText(query.keyword);
    const like = `%${keyword}%`;
    if (entityType === '客户') {
      const rows = await this.clientRepository.createQueryBuilder('client')
        .where(keyword ? '(client.unitName LIKE :like OR client.unitCode LIKE :like)' : '1=1', { like })
        .orderBy('client.id', 'DESC')
        .take(50)
        .getMany();
      return rows.map(row => ({
        label: `${row.unitCode} / ${row.unitName}`,
        value: row.id,
        clientId: row.id,
        clientName: row.unitName,
      }));
    }
    if (entityType === '订单') {
      const rows = await this.orderRepository.createQueryBuilder('orders')
        .where(keyword ? '(orders.orderNo LIKE :like OR orders.unitName LIKE :like)' : '1=1', { like })
        .orderBy('orders.id', 'DESC')
        .take(50)
        .getMany();
      return rows.map(row => ({ label: `${row.orderNo} / ${row.unitName}`, value: row.id, clientId: row.clientId, clientName: row.unitName }));
    }
    if (entityType === '服务项') {
      const rows = await this.serviceItemRepository.createQueryBuilder('item')
        .where(keyword ? '(item.orderNo LIKE :like OR item.unitName LIKE :like OR item.serviceName LIKE :like)' : '1=1', { like })
        .orderBy('item.id', 'DESC')
        .take(50)
        .getMany();
      return rows.map(row => ({ label: `${row.orderNo} / ${row.serviceName} / ${row.unitName}`, value: row.id, clientId: row.clientId, clientName: row.unitName }));
    }
    if (entityType === '合同') {
      const rows = await this.contractRepository.createQueryBuilder('contract')
        .where(keyword ? '(contract.contractNo LIKE :like OR contract.title LIKE :like OR contract.clientName LIKE :like)' : '1=1', { like })
        .orderBy('contract.id', 'DESC')
        .take(50)
        .getMany();
      return rows.map(row => ({ label: `${row.contractNo} / ${row.clientName}`, value: row.id, clientId: row.clientId, clientName: row.clientName }));
    }
    if (entityType === '发票') {
      const rows = await this.invoiceRepository.createQueryBuilder('invoice')
        .where(keyword ? '(invoice.invoiceNo LIKE :like OR invoice.clientName LIKE :like)' : '1=1', { like })
        .orderBy('invoice.id', 'DESC')
        .take(50)
        .getMany();
      return rows.map(row => ({ label: `${row.invoiceNo} / ${row.clientName}`, value: row.id, clientId: row.clientId, clientName: row.clientName }));
    }

    const rows = await this.paymentRepository.createQueryBuilder('payment')
      .where(keyword ? '(payment.payerName LIKE :like OR payment.clientName LIKE :like OR payment.bankSerialNo LIKE :like)' : '1=1', { like })
      .orderBy('payment.id', 'DESC')
      .take(50)
      .getMany();
    return rows.map(row => ({ label: `${row.paymentDate} / ${row.payerName}`, value: row.id, clientId: row.clientId, clientName: row.clientName }));
  }

  async materials(query: MaterialQuery) {
    const { pageSize, skip } = normalizePage(query);
    const keyword = this.cleanText(query.keyword);
    const qb = this.materialRepository.createQueryBuilder('material')
      .leftJoinAndSelect('material.attachment', 'attachment')
      .skip(skip)
      .take(pageSize);

    if (query.category)
      qb.andWhere('material.category = :category', { category: query.category });
    if (query.documentType) {
      this.assertIn(query.documentType, ARCHIVE_MATERIAL_TYPES, '资料类型');
      qb.andWhere('material.documentType = :documentType', { documentType: query.documentType });
    }
    if (query.status) {
      this.assertIn(query.status, ARCHIVE_MATERIAL_STATUSES, '资料状态');
      qb.andWhere('material.status = :status', { status: query.status });
    }
    if (keyword) {
      qb.andWhere(new Brackets((where) => {
        where.where('material.title LIKE :keyword', { keyword: `%${keyword}%` })
          .orWhere('material.category LIKE :keyword', { keyword: `%${keyword}%` })
          .orWhere('material.description LIKE :keyword', { keyword: `%${keyword}%` })
          .orWhere('attachment.name LIKE :keyword', { keyword: `%${keyword}%` })
          .orWhere('attachment.originalName LIKE :keyword', { keyword: `%${keyword}%` });
      }));
    }

    const sort = resolveSort(query.sortKey, query.sortOrder, {
      title: 'material.title',
      category: 'material.category',
      documentType: 'material.documentType',
      status: 'material.status',
      pinned: 'material.pinned',
      publishedAt: 'material.publishedAt',
      createTime: 'material.createTime',
    });
    if (sort)
      qb.orderBy(sort.column, sort.direction).addOrderBy('material.id', 'DESC');
    else
      qb.orderBy('material.pinned', 'DESC').addOrderBy('material.publishedAt', 'DESC').addOrderBy('material.id', 'DESC');

    const [rows, total] = await qb.getManyAndCount();
    return pageResult(rows.map(row => this.toMaterialRow(row)), total);
  }

  async createMaterial(body: Record<string, unknown>, file: UploadedArchiveFile | undefined, user: User) {
    const incomingPath = file?.path;
    try {
      if (!file)
        throw new BadRequestException('请选择资料文件');
      const input = this.parseMaterialInput(body, true);
      const title = this.requiredText(input.title, '资料标题');
      const documentType = this.requiredText(input.documentType, '资料类型');
      const savedFile = await this.saveFileAttachment({
        file,
        tag: documentType,
        name: title,
        remark: input.description || null,
        user,
        primaryLink: null,
      });
      const attachment = savedFile.attachment;
      const material = this.materialRepository.create({
        attachmentId: attachment.id,
        title,
        category: this.requiredText(input.category, '资料分类'),
        documentType,
        version: input.version,
        status: input.status,
        pinned: input.pinned,
        effectiveDate: input.effectiveDate,
        expiredDate: input.expiredDate,
        publishedAt: new Date(),
        publishedById: user.id,
        publishedByName: resolveUserDisplayName(user),
        description: input.description,
      });
      const row: ReturnType<ArchiveService['toMaterialRow']> & { duplicateOf?: ReturnType<ArchiveService['toDuplicateAttachmentRow']> } = this.toMaterialRow(await this.materialRepository.save(material));
      if (savedFile.duplicateOf)
        row.duplicateOf = savedFile.duplicateOf;
      return row;
    }
    catch (error) {
      await this.removeIncomingFile(incomingPath);
      throw error;
    }
  }

  async updateMaterial(id: number, body: Record<string, unknown>, file: UploadedArchiveFile | undefined, user: User) {
    const incomingPath = file?.path;
    try {
      const material = await this.materialRepository.findOne({ where: { id }, relations: ['attachment'] });
      if (!material)
        throw new NotFoundException('资料不存在');
      const input = this.parseMaterialInput(body, false);

      if (input.title !== undefined)
        material.title = input.title;
      if (input.category !== undefined)
        material.category = input.category;
      if (input.documentType !== undefined)
        material.documentType = input.documentType;
      if (input.version !== undefined)
        material.version = input.version;
      if (input.status !== undefined)
        material.status = input.status;
      if (input.pinned !== undefined)
        material.pinned = input.pinned;
      if (input.effectiveDate !== undefined)
        material.effectiveDate = input.effectiveDate;
      if (input.expiredDate !== undefined)
        material.expiredDate = input.expiredDate;
      if (input.description !== undefined)
        material.description = input.description;

      if (file) {
        const savedFile = await this.saveFileAttachment({
          file,
          tag: material.documentType,
          name: material.title,
          remark: material.description || null,
          user,
          primaryLink: null,
        });
        const attachment = savedFile.attachment;
        material.attachmentId = attachment.id;
        const row: ReturnType<ArchiveService['toMaterialRow']> & { duplicateOf?: ReturnType<ArchiveService['toDuplicateAttachmentRow']> } = this.toMaterialRow(await this.materialRepository.save(material));
        if (savedFile.duplicateOf)
          row.duplicateOf = savedFile.duplicateOf;
        return row;
      }

      return this.toMaterialRow(await this.materialRepository.save(material));
    }
    catch (error) {
      await this.removeIncomingFile(incomingPath);
      throw error;
    }
  }

  async removeMaterial(id: number) {
    const material = await this.materialRepository.findOne({ where: { id } });
    if (!material)
      throw new NotFoundException('资料不存在');
    await this.materialRepository.softRemove(material);
    return true;
  }

  async weeklyReports(query: WeeklyReportQuery) {
    const { pageSize, skip } = normalizePage(query);
    const ownerUserId = parseOptionalPositiveInt(query.ownerUserId, '员工ID');
    const keyword = this.cleanText(query.keyword);
    const qb = this.weeklyReportRepository.createQueryBuilder('report').skip(skip).take(pageSize);

    if (ownerUserId)
      qb.andWhere('report.ownerUserId = :ownerUserId', { ownerUserId });
    if (query.departmentName)
      qb.andWhere('report.departmentName = :departmentName', { departmentName: query.departmentName });
    if (query.status)
      qb.andWhere('report.status = :status', { status: query.status });
    if (query.weekStart)
      qb.andWhere('report.weekStart >= :weekStart', { weekStart: query.weekStart });
    if (query.weekEnd)
      qb.andWhere('report.weekEnd <= :weekEnd', { weekEnd: query.weekEnd });
    if (keyword) {
      qb.andWhere(new Brackets((where) => {
        where.where('report.title LIKE :keyword', { keyword: `%${keyword}%` })
          .orWhere('report.ownerName LIKE :keyword', { keyword: `%${keyword}%` })
          .orWhere('report.departmentName LIKE :keyword', { keyword: `%${keyword}%` })
          .orWhere('report.completedWork LIKE :keyword', { keyword: `%${keyword}%` })
          .orWhere('report.weeklySummary LIKE :keyword', { keyword: `%${keyword}%` })
          .orWhere('report.nextPlan LIKE :keyword', { keyword: `%${keyword}%` });
      }));
    }

    const sort = resolveSort(query.sortKey, query.sortOrder, {
      weekStart: 'report.weekStart',
      weekEnd: 'report.weekEnd',
      ownerName: 'report.ownerName',
      departmentName: 'report.departmentName',
      status: 'report.status',
      submittedAt: 'report.submittedAt',
      createTime: 'report.createTime',
    });
    if (sort)
      qb.orderBy(sort.column, sort.direction).addOrderBy('report.id', 'DESC');
    else
      qb.orderBy('report.weekStart', 'DESC').addOrderBy('report.id', 'DESC');

    const [rows, total] = await qb.getManyAndCount();
    return pageResult(rows.map(row => this.toWeeklyReportRow(row)), total);
  }

  async createWeeklyReport(dto: CreateWeeklyReportDto, user: User) {
    this.assertDateRange(dto.weekStart, dto.weekEnd, '周报日期');
    const existing = await this.weeklyReportRepository.findOne({ where: { ownerUserId: user.id, weekStart: dto.weekStart }, withDeleted: true });
    if (existing && !existing.deleteTime)
      throw new BadRequestException('该周已存在周报');
    const report = existing || this.weeklyReportRepository.create({
      ownerUserId: user.id,
      ownerName: resolveUserDisplayName(user) || '',
      departmentName: user.employeeProfile?.departmentName || null,
    });
    if (existing?.deleteTime)
      await this.recoverWeeklyReport(report);
    report.weekStart = dto.weekStart;
    report.weekEnd = dto.weekEnd;
    report.title = this.cleanText(dto.title) || `${dto.weekStart} 周报`;
    report.completedWork = this.cleanText(dto.completedWork) || null;
    report.dailyWork = this.sanitizeDailyWork(dto.dailyWork, dto.weekStart, dto.weekEnd);
    report.weeklySummary = this.cleanText(dto.weeklySummary) || null;
    report.blockers = this.cleanText(dto.blockers) || null;
    report.nextPlan = this.cleanText(dto.nextPlan) || null;
    report.sourceType = ARCHIVE_WEEKLY_REPORT_SOURCE_TYPE.MANUAL;
    report.status = ARCHIVE_WEEKLY_REPORT_STATUS.DRAFT;
    report.submittedAt = null;
    return this.toWeeklyReportRow(await this.weeklyReportRepository.save(report));
  }

  async updateWeeklyReport(id: number, dto: UpdateWeeklyReportDto, user: User) {
    const report = await this.findEditableWeeklyReport(id, user);
    if (dto.title !== undefined)
      report.title = this.requiredText(dto.title, '周报标题');
    if (dto.completedWork !== undefined)
      report.completedWork = this.cleanText(dto.completedWork) || null;
    if (dto.dailyWork !== undefined)
      report.dailyWork = this.sanitizeDailyWork(dto.dailyWork, report.weekStart, report.weekEnd);
    if (dto.weeklySummary !== undefined)
      report.weeklySummary = this.cleanText(dto.weeklySummary) || null;
    if (dto.blockers !== undefined)
      report.blockers = this.cleanText(dto.blockers) || null;
    if (dto.nextPlan !== undefined)
      report.nextPlan = this.cleanText(dto.nextPlan) || null;
    return this.toWeeklyReportRow(await this.weeklyReportRepository.save(report));
  }

  async submitWeeklyReport(id: number, user: User) {
    const report = await this.findEditableWeeklyReport(id, user);
    if (!this.hasWeeklyContent(report))
      throw new BadRequestException('周报至少填写每日工作内容或本周总结');
    report.status = ARCHIVE_WEEKLY_REPORT_STATUS.SUBMITTED;
    report.submittedAt = new Date();
    return this.toWeeklyReportRow(await this.weeklyReportRepository.save(report));
  }

  async withdrawWeeklyReport(id: number, user: User) {
    const report = await this.findOwnWeeklyReport(id, user);
    if (report.status !== ARCHIVE_WEEKLY_REPORT_STATUS.SUBMITTED)
      throw new BadRequestException('只有已提交周报可以撤回');
    report.status = ARCHIVE_WEEKLY_REPORT_STATUS.DRAFT;
    report.submittedAt = null;
    return this.toWeeklyReportRow(await this.weeklyReportRepository.save(report));
  }

  async removeWeeklyReport(id: number, user: User) {
    const report = await this.findOwnWeeklyReport(id, user);
    if (report.status === ARCHIVE_WEEKLY_REPORT_STATUS.SUBMITTED)
      throw new BadRequestException('已提交周报请先撤回再删除');
    await this.weeklyReportRepository.softRemove(report);
    return true;
  }

  async generateWeeklyDraft(body: Record<string, unknown>, user: User) {
    const weekStart = this.requiredText(body.weekStart, '周开始日期');
    const weekEnd = this.requiredText(body.weekEnd, '周结束日期');
    this.assertDateRange(weekStart, weekEnd, '周报日期');
    const existing = await this.weeklyReportRepository.findOne({ where: { ownerUserId: user.id, weekStart }, withDeleted: true });
    if (existing && !existing.deleteTime && existing.status === ARCHIVE_WEEKLY_REPORT_STATUS.SUBMITTED)
      throw new BadRequestException('已提交周报不能重新生成');

    const items = await this.serviceItemRepository.createQueryBuilder('item')
      .where('(item.receiverId = :userId OR item.performerId = :userId)', { userId: user.id })
      .andWhere(new Brackets((where) => {
        where.where('item.completedAt BETWEEN :weekStart AND :weekEnd', { weekStart, weekEnd })
          .orWhere('item.statusUpdatedAt BETWEEN :startAt AND :endAt', { startAt: `${weekStart} 00:00:00`, endAt: `${weekEnd} 23:59:59` })
          .orWhere('item.createTime BETWEEN :startAt AND :endAt', { startAt: `${weekStart} 00:00:00`, endAt: `${weekEnd} 23:59:59` });
      }))
      .orderBy('item.statusUpdatedAt', 'DESC')
      .addOrderBy('item.id', 'DESC')
      .take(80)
      .getMany();

    const dailyWork = this.buildDailyWorkDraft(weekStart, weekEnd, items);
    const completed = items.filter(item => item.status === SERVICE_ITEM_STATUS.DONE || item.completedAt);
    const active = items.filter(item => item.status !== SERVICE_ITEM_STATUS.DONE && item.status !== SERVICE_ITEM_STATUS.CANCELLED);
    const completedText = dailyWork.map(day => day.content).filter(Boolean).join('\n');
    const weeklySummary = items.length
      ? `累计处理服务事项${items.length}件，其中已完成${completed.length}件，跟进中${active.length}件`
      : '本周暂无系统服务项记录';
    const nextPlanText = active.length
      ? active.slice(0, 20).map(item => `跟进 ${item.unitName} ${item.serviceYear} ${item.serviceName}（${item.status}）`).join('\n')
      : '暂无系统可生成的下周跟进项';

    const report = existing || this.weeklyReportRepository.create({
      ownerUserId: user.id,
      ownerName: resolveUserDisplayName(user) || '',
      departmentName: user.employeeProfile?.departmentName || null,
      weekStart,
      weekEnd,
      status: ARCHIVE_WEEKLY_REPORT_STATUS.DRAFT,
    });
    if (existing?.deleteTime)
      await this.recoverWeeklyReport(report);
    report.weekStart = weekStart;
    report.weekEnd = weekEnd;
    report.title = this.cleanText(body.title) || `${weekStart} 周报`;
    report.completedWork = completedText;
    report.dailyWork = dailyWork;
    report.weeklySummary = weeklySummary;
    report.nextPlan = nextPlanText;
    report.blockers = report.blockers || null;
    report.sourceType = ARCHIVE_WEEKLY_REPORT_SOURCE_TYPE.GENERATED;
    report.status = ARCHIVE_WEEKLY_REPORT_STATUS.DRAFT;
    report.submittedAt = null;
    report.generatedJson = {
      serviceItemCount: items.length,
      completedCount: completed.length,
      activeCount: active.length,
      serviceItemIds: items.map(item => item.id),
    };
    return this.toWeeklyReportRow(await this.weeklyReportRepository.save(report));
  }

  private buildDailyWorkDraft(weekStart: string, weekEnd: string, items: ServiceItem[]): WeeklyDayWork[] {
    const rows = this.weekdayRows(weekStart, weekEnd);
    for (const item of items) {
      const date = this.resolveServiceItemWorkDate(item, weekStart, weekEnd);
      const row = rows.find(day => day.date === date);
      if (row)
        row.content = [row.content, `${item.unitName}${item.serviceName ? ` ${item.serviceName}` : ''}（${item.status}）`].filter(Boolean).join('\n');
    }
    return rows;
  }

  private resolveServiceItemWorkDate(item: ServiceItem, weekStart: string, weekEnd: string) {
    if (item.completedAt && item.completedAt >= weekStart && item.completedAt <= weekEnd)
      return item.completedAt;
    const statusDate = this.formatDateOnly(item.statusUpdatedAt);
    if (statusDate && statusDate >= weekStart && statusDate <= weekEnd)
      return statusDate;
    const createdDate = this.formatDateOnly(item.createTime);
    return createdDate && createdDate >= weekStart && createdDate <= weekEnd ? createdDate : weekStart;
  }

  private sanitizeDailyWork(value: unknown, weekStart: string, weekEnd: string): WeeklyDayWork[] {
    const defaults = this.weekdayRows(weekStart, weekEnd);
    if (!Array.isArray(value))
      return defaults;
    const inputByDate = new Map(value.map((item) => {
      const row = item as Partial<WeeklyDayWork>;
      return [row.date, row];
    }));
    return defaults.map((day) => {
      const input = inputByDate.get(day.date);
      return {
        date: day.date,
        weekday: day.weekday,
        content: this.cleanText(input?.content) || '',
      };
    });
  }

  private weekdayRows(weekStart: string, weekEnd: string): WeeklyDayWork[] {
    const start = this.parseDateOnly(weekStart, '周开始日期');
    const end = this.parseDateOnly(weekEnd, '周结束日期');
    const rows: WeeklyDayWork[] = [];
    for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      rows.push({
        date: this.formatDateValue(date),
        weekday: `星期${['日', '一', '二', '三', '四', '五', '六'][date.getDay()]}`,
        content: '',
      });
    }
    return rows;
  }

  private hasWeeklyContent(report: ArchiveWeeklyReport) {
    return Boolean(
      report.dailyWork?.some(day => this.cleanText(day.content))
      || this.cleanText(report.weeklySummary)
      || this.cleanText(report.completedWork)
      || this.cleanText(report.nextPlan),
    );
  }

  private parseDateOnly(value: string, label: string) {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime()))
      throw new BadRequestException(`${label}无效`);
    return date;
  }

  private formatDateOnly(value?: Date | string | null) {
    if (!value)
      return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : this.formatDateValue(date);
  }

  private formatDateValue(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private async orderIdsByContractLines() {
    const rows = await this.contractLineRepository.createQueryBuilder('line')
      .innerJoin('line.serviceItem', 'item')
      .select('DISTINCT item.orderId', 'orderId')
      .getRawMany<{ orderId: number | string }>();
    return new Set(rows.map(row => Number(row.orderId)).filter(Boolean));
  }

  private async orderIdsByInvoiceLines() {
    const rows = await this.invoiceLineRepository.createQueryBuilder('line')
      .innerJoin('line.serviceItem', 'item')
      .innerJoin('line.invoice', 'invoice')
      .select('DISTINCT item.orderId', 'orderId')
      .where('invoice.status <> :voidedStatus', { voidedStatus: INVOICE_STATUS.VOIDED })
      .getRawMany<{ orderId: number | string }>();
    return new Set(rows.map(row => Number(row.orderId)).filter(Boolean));
  }

  private parseLinkInputs(body: Record<string, unknown>, defaultTag: string): ArchiveLinkDto[] {
    const linksValue = body.links;
    if (typeof linksValue === 'string' && linksValue.trim()) {
      try {
        const parsed = JSON.parse(linksValue);
        if (!Array.isArray(parsed))
          throw new Error('links must be array');
        return parsed.map(item => ({
          entityType: this.cleanText(item.entityType),
          entityId: this.toPositiveInt(item.entityId, '关联对象ID'),
          tag: this.cleanText(item.tag) || defaultTag,
          remark: this.cleanText(item.remark) || undefined,
        }));
      }
      catch {
        throw new BadRequestException('关联对象格式无效');
      }
    }

    const linkedType = this.cleanText(body.linkedType || body.entityType);
    const linkedId = body.linkedId ?? body.entityId;
    if (linkedType && linkedId) {
      return [{
        entityType: linkedType,
        entityId: this.toPositiveInt(linkedId, '关联对象ID'),
        tag: defaultTag,
        remark: this.cleanText(body.remark) || undefined,
      }];
    }

    if (body.clientId) {
      return [{
        entityType: '客户',
        entityId: this.toPositiveInt(body.clientId, '客户ID'),
        tag: defaultTag,
        remark: this.cleanText(body.remark) || undefined,
      }];
    }
    throw new BadRequestException('请选择关联对象');
  }

  private async resolveLinks(inputs: ArchiveLinkDto[], defaultTag: string): Promise<ResolvedArchiveLink[]> {
    if (!inputs.length)
      throw new BadRequestException('请选择关联对象');
    const links: ResolvedArchiveLink[] = [];
    for (const input of inputs) {
      const entityType = this.assertEntityType(input.entityType);
      const entityId = this.toPositiveInt(input.entityId, '关联对象ID');
      const target = await this.resolveTarget(entityType, entityId);
      links.push({
        ...target,
        tag: this.cleanText(input.tag) || defaultTag,
        remark: this.cleanText(input.remark) || null,
      });
    }
    return links;
  }

  private async resolveTarget(entityType: ArchiveEntityType, entityId: number): Promise<LinkTarget> {
    if (entityType === '客户') {
      const client = await this.clientRepository.findOne({ where: { id: entityId } });
      if (!client)
        throw new NotFoundException('客户不存在');
      return { entityType, entityId, entityName: client.unitName, clientId: client.id, clientName: client.unitName };
    }
    if (entityType === '订单') {
      const order = await this.orderRepository.findOne({ where: { id: entityId } });
      if (!order)
        throw new NotFoundException('订单不存在');
      return { entityType, entityId, entityName: order.orderNo, clientId: order.clientId, clientName: order.unitName, serviceYear: order.serviceYear };
    }
    if (entityType === '服务项') {
      const item = await this.serviceItemRepository.findOne({ where: { id: entityId } });
      if (!item)
        throw new NotFoundException('服务项不存在');
      return { entityType, entityId, entityName: `${item.orderNo} / ${item.serviceName}`, clientId: item.clientId, clientName: item.unitName, serviceYear: item.serviceYear };
    }
    if (entityType === '合同') {
      const contract = await this.contractRepository.findOne({ where: { id: entityId } });
      if (!contract)
        throw new NotFoundException('合同不存在');
      return { entityType, entityId, entityName: contract.contractNo, clientId: contract.clientId, clientName: contract.clientName };
    }
    if (entityType === '发票') {
      const invoice = await this.invoiceRepository.findOne({ where: { id: entityId } });
      if (!invoice)
        throw new NotFoundException('发票不存在');
      return { entityType, entityId, entityName: invoice.invoiceNo, clientId: invoice.clientId, clientName: invoice.clientName };
    }
    const payment = await this.paymentRepository.findOne({ where: { id: entityId } });
    if (!payment)
      throw new NotFoundException('收款不存在');
    return { entityType, entityId, entityName: `${payment.paymentDate} / ${payment.payerName}`, clientId: payment.clientId, clientName: payment.clientName };
  }

  private async saveFileAttachment(input: {
    file: UploadedArchiveFile;
    tag: string;
    name: string;
    remark: string | null;
    user: User;
    primaryLink: LinkTarget | null;
  }) {
    const ext = extname(input.file.originalname || '').toLowerCase();
    this.assertIn(ext, ARCHIVE_ALLOWED_EXTENSIONS, '文件类型');
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const storedName = `${now.getTime()}-${Math.random().toString(16).slice(2)}${ext}`;
    const storageKey = `${ARCHIVE_UPLOAD.STORAGE_DIR}/${year}/${month}/${storedName}`;
    const absolutePath = join(process.cwd(), UPLOAD_ROOT_DIR, ARCHIVE_UPLOAD.STORAGE_DIR, year, month, storedName);
    await mkdir(dirname(absolutePath), { recursive: true });
    if (input.file.path)
      await rename(input.file.path, absolutePath);
    else if (input.file.buffer)
      await writeFile(absolutePath, input.file.buffer);
    else
      throw new BadRequestException('上传文件无效');

    const fileStat = await stat(absolutePath);
    const sha256 = await this.sha256File(absolutePath);
    const duplicate = await this.attachmentRepository.findOne({ where: { sha256 }, order: { id: 'DESC' } });
    const userName = resolveUserDisplayName(input.user);
    const attachment = this.attachmentRepository.create({
      name: this.requiredText(input.name, '文件名称'),
      originalName: normalizeUploadFileName(input.file.originalname),
      tag: input.tag,
      fileKind: this.resolveFileKind(ext),
      clientId: input.primaryLink?.clientId || null,
      linkedType: input.primaryLink?.entityType || null,
      linkedId: input.primaryLink?.entityId || null,
      linkedName: input.primaryLink?.entityName || null,
      storageKey,
      fileUrl: '',
      fileExt: ext,
      mimeType: input.file.mimetype || null,
      sizeBytes: String(fileStat.size),
      sha256,
      uploadedById: input.user.id,
      uploadedByName: userName,
      uploadedAt: now,
      remark: input.remark,
    });
    const saved = await this.attachmentRepository.save(attachment);
    saved.fileUrl = `/archive/attachments/${saved.id}/download`;
    return {
      attachment: await this.attachmentRepository.save(saved),
      duplicateOf: duplicate ? this.toDuplicateAttachmentRow(duplicate) : null,
    };
  }

  private parseMaterialInput(body: Record<string, unknown>, required: boolean) {
    const title = this.cleanText(body.title);
    const category = this.cleanText(body.category);
    const documentType = this.cleanText(body.documentType);
    const status = this.cleanText(body.status) || '已发布';
    if (required && !title)
      throw new BadRequestException('请填写资料标题');
    if (required && !category)
      throw new BadRequestException('请填写资料分类');
    if (required && !documentType)
      throw new BadRequestException('请选择资料类型');
    if (documentType)
      this.assertIn(documentType, ARCHIVE_MATERIAL_TYPES, '资料类型');
    if (status)
      this.assertIn(status, ARCHIVE_MATERIAL_STATUSES, '资料状态');
    return {
      title: title || undefined,
      category: category || undefined,
      documentType: documentType || undefined,
      version: this.cleanText(body.version) || (required ? 'V1' : undefined),
      status: status || undefined,
      pinned: body.pinned === undefined ? (required ? false : undefined) : this.parseBoolean(body.pinned, '是否置顶'),
      effectiveDate: this.cleanText(body.effectiveDate) || null,
      expiredDate: this.cleanText(body.expiredDate) || null,
      description: this.cleanText(body.description) || null,
    };
  }

  private async findEditableWeeklyReport(id: number, user: User) {
    const report = await this.findOwnWeeklyReport(id, user);
    if (report.status === ARCHIVE_WEEKLY_REPORT_STATUS.SUBMITTED)
      throw new BadRequestException('已提交周报不能修改');
    return report;
  }

  private async recoverWeeklyReport(report: ArchiveWeeklyReport) {
    await this.weeklyReportRepository.restore(report.id);
    report.deleteTime = null;
  }

  private async findOwnWeeklyReport(id: number, user: User) {
    const report = await this.weeklyReportRepository.findOne({ where: { id } });
    if (!report)
      throw new NotFoundException('周报不存在');
    if (!user.builtIn && report.ownerUserId !== user.id)
      throw new ForbiddenException('只能操作自己的周报');
    return report;
  }

  private toAttachmentRow(row: ArchiveAttachment) {
    const links = row.links?.length
      ? row.links.map(link => this.toLinkRow(link))
      : this.legacyLinkRows(row);
    const firstLink = links[0];
    return {
      id: row.id,
      name: row.name,
      originalName: normalizeUploadFileName(row.originalName || row.name),
      tag: row.tag,
      fileKind: row.fileKind,
      fileExt: row.fileExt,
      mimeType: row.mimeType,
      sizeBytes: Number(row.sizeBytes || 0),
      sha256: row.sha256,
      clientId: firstLink?.clientId || row.clientId || null,
      currentClientName: firstLink?.clientName || row.client?.unitName || null,
      linkedType: firstLink?.entityType || row.linkedType,
      linkedId: firstLink?.entityId || row.linkedId,
      linkedName: firstLink?.entityName || row.linkedName,
      linkedTo: links.map(link => link.entityName).filter(Boolean).join('、') || row.linkedName || '-',
      links,
      fileUrl: row.fileUrl,
      previewUrl: `/archive/attachments/${row.id}/preview`,
      downloadUrl: `/archive/attachments/${row.id}/download`,
      uploadedAt: row.uploadedAt,
      uploadedByName: row.uploadedByName,
      remark: row.remark,
      createTime: row.createTime,
      updateTime: row.updateTime,
    };
  }

  private toDuplicateAttachmentRow(row: ArchiveAttachment) {
    return {
      id: row.id,
      name: row.name,
      originalName: normalizeUploadFileName(row.originalName || row.name),
      uploadedAt: row.uploadedAt,
      uploadedByName: row.uploadedByName,
    };
  }

  private toLinkRow(link: ArchiveAttachmentLink) {
    return {
      id: link.id,
      entityType: link.entityType,
      entityId: link.entityId,
      entityName: link.entityName,
      clientId: link.clientId,
      clientName: link.clientName,
      serviceYear: link.serviceYear,
      tag: link.tag,
      remark: link.remark,
    };
  }

  private legacyLinkRows(row: ArchiveAttachment) {
    if (!row.linkedType || !row.linkedId)
      return [];
    return [{
      id: null,
      entityType: row.linkedType,
      entityId: row.linkedId,
      entityName: row.linkedName || '',
      clientId: row.clientId || null,
      clientName: row.client?.unitName || null,
      serviceYear: null,
      tag: row.tag,
      remark: row.remark,
    }];
  }

  private toMaterialRow(row: ArchiveMaterial) {
    return {
      id: row.id,
      attachmentId: row.attachmentId,
      title: row.title,
      category: row.category,
      documentType: row.documentType,
      version: row.version,
      status: row.status,
      pinned: row.pinned,
      effectiveDate: row.effectiveDate,
      expiredDate: row.expiredDate,
      publishedAt: row.publishedAt,
      publishedByName: row.publishedByName,
      description: row.description,
      attachment: row.attachment ? this.toAttachmentRow(row.attachment) : null,
      createTime: row.createTime,
      updateTime: row.updateTime,
    };
  }

  private toWeeklyReportRow(row: ArchiveWeeklyReport) {
    return {
      id: row.id,
      ownerUserId: row.ownerUserId,
      ownerName: row.ownerName,
      departmentName: row.departmentName,
      weekStart: row.weekStart,
      weekEnd: row.weekEnd,
      title: row.title,
      completedWork: row.completedWork,
      dailyWork: row.dailyWork,
      weeklySummary: row.weeklySummary,
      blockers: row.blockers,
      nextPlan: row.nextPlan,
      generatedJson: row.generatedJson,
      sourceType: row.sourceType,
      status: row.status,
      submittedAt: row.submittedAt,
      createTime: row.createTime,
      updateTime: row.updateTime,
    };
  }

  private resolveAttachmentPath(row: ArchiveAttachment) {
    if (row.storageKey)
      return join(process.cwd(), UPLOAD_ROOT_DIR, ...row.storageKey.split('/'));
    if (row.fileUrl?.startsWith(UPLOAD_URL_PREFIX))
      return join(process.cwd(), UPLOAD_ROOT_DIR, ...row.fileUrl.slice(UPLOAD_URL_PREFIX.length).split('/'));
    return null;
  }

  private sha256File(path: string) {
    return new Promise<string>((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(path);
      stream.on('data', chunk => hash.update(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }

  private async removeIncomingFile(path?: string) {
    if (!path)
      return;
    try {
      await unlink(path);
    }
    catch {
      // 上传校验失败时清理临时文件；文件不存在则无需处理。
    }
  }

  private assertDateRange(start: string, end: string, label: string) {
    const startDate = new Date(`${start}T00:00:00`);
    const endDate = new Date(`${end}T00:00:00`);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()))
      throw new BadRequestException(`${label}无效`);
    if (startDate > endDate)
      throw new BadRequestException(`${label}开始日期不能晚于结束日期`);
    const days = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
    if (days > 7)
      throw new BadRequestException(`${label}不能超过7天`);
  }

  private resolveFileKind(ext: string) {
    if (['.png', '.jpg', '.jpeg'].includes(ext))
      return '图片';
    if (['.xls', '.xlsx'].includes(ext))
      return '表格';
    if (['.mp4', '.webm', '.mov'].includes(ext))
      return '视频';
    if (['.pdf', '.doc', '.docx'].includes(ext))
      return '文档';
    return '其他';
  }

  private assertEntityType(value: string): ArchiveEntityType {
    return this.assertIn(value, ARCHIVE_ENTITY_TYPES, '关联类型');
  }

  private assertIn<T extends readonly string[]>(value: string, allowed: T, label: string): T[number] {
    if (allowed.includes(value))
      return value as T[number];
    throw new BadRequestException(`${label}无效`);
  }

  private requiredText(value: unknown, label: string) {
    const text = this.cleanText(value);
    if (!text)
      throw new BadRequestException(`请填写${label}`);
    return text;
  }

  private cleanText(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
  }

  private toPositiveInt(value: unknown, label: string) {
    const numberValue = Number(value);
    if (!Number.isInteger(numberValue) || numberValue <= 0)
      throw new BadRequestException(`${label}必须是正整数`);
    return numberValue;
  }

  private parseBoolean(value: unknown, label: string) {
    if (value === true || value === 'true' || value === '1' || value === 1)
      return true;
    if (value === false || value === 'false' || value === '0' || value === 0)
      return false;
    throw new BadRequestException(`${label}必须是布尔值`);
  }
}
