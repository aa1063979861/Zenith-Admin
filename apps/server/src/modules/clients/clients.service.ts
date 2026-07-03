import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, Repository } from 'typeorm';
import { ClientContactRole, ClientUnitStatus, CustomerLevel } from '../../common/business.constants';
import { normalizePage, pageResult } from '../../common/page';
import { resolveSort } from '../../common/sort';
import { ClientContact } from '../../entities/client-contact.entity';
import { ClientCredential } from '../../entities/client-credential.entity';
import { ClientIdentityHistory } from '../../entities/client-identity-history.entity';
import { ClientMergeLog } from '../../entities/client-merge-log.entity';
import { ClientSummary } from '../../entities/client-summary.entity';
import { Client } from '../../entities/client.entity';
import { FinanceInvoice } from '../../entities/finance-invoice.entity';
import { FinancePayment } from '../../entities/finance-payment.entity';
import { Order } from '../../entities/order.entity';
import { ServiceItem } from '../../entities/service-item.entity';
import { User } from '../../entities/user.entity';
import { DictionariesService } from '../dictionaries/dictionaries.service';
import { resolveUserDisplayName } from '../operation-logs/operation-logs.service';
import { ChangeClientIdentityDto } from './dto/change-client-identity.dto';
import { CreateClientContactDto } from './dto/create-client-contact.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { MergeClientDto } from './dto/merge-client.dto';
import { UpdateClientContactDto } from './dto/update-client-contact.dto';
import { UpdateClientDto } from './dto/update-client.dto';

type ClientPageQuery = {
  pageNo?: number;
  pageSize?: number;
  regionCode?: string;
  keyword?: string;
  unitCode?: string;
  unitName?: string;
  creditCode?: string;
  contact?: string;
  unitStatus?: string;
  customerLevel?: string;
  customerStage?: string;
  hasOrders?: string;
  sortKey?: string;
  sortOrder?: string;
};

type ClientSummaryRaw = {
  orderCount?: string | number | null;
  serviceItemCount?: string | number | null;
  receivableAmount?: string | number | null;
  receivedAmount?: string | number | null;
  unpaidAmount?: string | number | null;
  credentialCount?: string | number | null;
  contactCount?: string | number | null;
  latestOrderDate?: string | null;
  primaryContactName?: string | null;
  primaryContactPhone?: string | null;
};

type SnapshotMergeInfo = {
  sourceClientId: number;
  targetClientId: number;
  targetRegionName: string;
  targetUnitCode: string;
  targetUnitName: string;
};

type MergeMovedDetails = {
  mode?: 'status-only';
  sourceUnitStatus?: ClientUnitStatus | null;
  orders?: number[];
  serviceItems?: Array<{ id: number; clientId: number }>;
  invoices?: number[];
  payments?: number[];
  contacts?: Array<{ id: number; isPrimary: boolean }>;
  credentials?: number[];
};

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client) private readonly clientRepository: Repository<Client>,
    @InjectRepository(ClientContact) private readonly contactRepository: Repository<ClientContact>,
    @InjectRepository(ClientCredential) private readonly credentialRepository: Repository<ClientCredential>,
    @InjectRepository(ClientIdentityHistory) private readonly identityHistoryRepository: Repository<ClientIdentityHistory>,
    @InjectRepository(ClientMergeLog) private readonly mergeLogRepository: Repository<ClientMergeLog>,
    @InjectRepository(ClientSummary) private readonly summaryRepository: Repository<ClientSummary>,
    @InjectRepository(Order) private readonly orderRepository: Repository<Order>,
    @InjectRepository(ServiceItem) private readonly serviceItemRepository: Repository<ServiceItem>,
    @InjectRepository(FinanceInvoice) private readonly invoiceRepository: Repository<FinanceInvoice>,
    @InjectRepository(FinancePayment) private readonly paymentRepository: Repository<FinancePayment>,
    private readonly dataSource: DataSource,
    private readonly dictionariesService: DictionariesService,
  ) {}

  async page(query: ClientPageQuery) {
    const { pageSize, skip } = normalizePage(query);
    const filterQb = this.clientRepository.createQueryBuilder('client')
      .leftJoin(ClientSummary, 'summary', 'summary.clientId = client.id');
    this.applyClientFilters(filterQb, query);

    const qb = this.clientRepository.createQueryBuilder('client');
    this.joinClientReadModel(qb);
    this.applyClientFilters(qb, query);

    const total = await filterQb.clone().getCount();
    const summary = await this.clientPageSummary(filterQb);
    this.applyClientSort(qb, query);
    const { entities, raw } = await qb
      .skip(skip)
      .take(pageSize)
      .getRawAndEntities();

    return {
      ...pageResult(entities.map((client, index) => this.toListItem(client, raw[index] as ClientSummaryRaw)), total),
      summary,
    };
  }

  async options(regionCode?: string) {
    const where = regionCode ? { regionCode } : {};
    const clients = await this.clientRepository.find({ where, order: { unitCode: 'ASC', id: 'ASC' } });
    return clients.filter(client => !client.mergedToClientId && client.unitStatus !== 'MERGED').map(client => ({
      label: client.unitName,
      value: client.id,
      regionCode: client.regionCode,
      unitCode: client.unitCode,
      unitName: client.unitName,
    }));
  }

  async create(dto: CreateClientDto) {
    const region = await this.dictionariesService.findEnabled('region', dto.regionCode);
    if (!region)
      throw new BadRequestException('区划不存在或已停用');
    const unitCode = dto.unitCode.trim();
    const unitName = dto.unitName.trim();
    if (!/^\d{6}$/.test(unitCode))
      throw new BadRequestException('单位编码必须是 6 位数字');
    if (!unitName)
      throw new BadRequestException('单位名称不能为空');

    const exists = await this.clientRepository.exists({ where: { regionCode: region.code, unitCode } });
    if (exists)
      throw new BadRequestException('该区划下单位编码已存在');

    const client = this.clientRepository.create({
      regionCode: region.code,
      regionName: region.name,
      unitCode,
      unitName,
      unitStatus: (dto.unitStatus || 'NORMAL') as ClientUnitStatus,
      customerLevel: (dto.customerLevel || 'NORMAL') as CustomerLevel,
      unifiedSocialCreditCode: this.cleanOptional(dto.unifiedSocialCreditCode),
      legalPerson: this.cleanOptional(dto.legalPerson),
      financeStaff: this.cleanOptional(dto.financeStaff),
      financeManager: this.cleanOptional(dto.financeManager),
      source: 'manual',
      address: this.cleanOptional(dto.address),
      contactPhone: this.cleanOptional(dto.contactPhone),
      remark: this.cleanOptional(dto.remark),
    });
    const saved = await this.clientRepository.save(client);
    await this.refreshClientSummary(saved.id);
    return this.detail(saved.id);
  }

  async update(id: number, dto: UpdateClientDto) {
    if (dto.regionCode !== undefined || dto.unitCode !== undefined || dto.unitName !== undefined)
      throw new BadRequestException('区划、单位编码和单位名称只能在客户详情的单位信息变更中修改');

    const client = await this.findOne(id);
    if (client.mergedToClientId)
      throw new BadRequestException('已合并单位不能修改，请先撤销合并');

    if (dto.unitStatus !== undefined)
      client.unitStatus = dto.unitStatus as ClientUnitStatus;
    if (dto.customerLevel !== undefined)
      client.customerLevel = dto.customerLevel as CustomerLevel;
    if (dto.unifiedSocialCreditCode !== undefined)
      client.unifiedSocialCreditCode = this.cleanOptional(dto.unifiedSocialCreditCode);
    if (dto.legalPerson !== undefined)
      client.legalPerson = this.cleanOptional(dto.legalPerson);
    if (dto.financeStaff !== undefined)
      client.financeStaff = this.cleanOptional(dto.financeStaff);
    if (dto.financeManager !== undefined)
      client.financeManager = this.cleanOptional(dto.financeManager);
    if (dto.address !== undefined)
      client.address = this.cleanOptional(dto.address);
    if (dto.contactPhone !== undefined)
      client.contactPhone = this.cleanOptional(dto.contactPhone);
    if (dto.remark !== undefined)
      client.remark = this.cleanOptional(dto.remark);

    const saved = await this.clientRepository.save(client);
    await this.refreshClientSummary(saved.id);
    return this.detail(saved.id);
  }

  async changeIdentity(id: number, dto: ChangeClientIdentityDto, user: User) {
    const savedId = await this.dataSource.transaction(async (manager) => {
      const clientRepository = manager.getRepository(Client);
      const historyRepository = manager.getRepository(ClientIdentityHistory);
      const client = await clientRepository.findOne({ where: { id } });
      if (!client)
        throw new NotFoundException('客户不存在');
      if (client.mergedToClientId)
        throw new BadRequestException('已合并客户不能变更单位信息');

      const region = await this.dictionariesService.findEnabled('region', dto.regionCode);
      if (!region)
        throw new BadRequestException('区划不存在或已停用');

      const unitCode = dto.unitCode.trim();
      const unitName = dto.unitName.trim();
      const reason = dto.reason.trim();
      if (!/^\d{6}$/.test(unitCode))
        throw new BadRequestException('单位编码必须是 6 位数字');
      if (!unitName)
        throw new BadRequestException('单位名称不能为空');
      if (!reason)
        throw new BadRequestException('单位信息变更原因不能为空');

      const identityChanged = client.regionCode !== region.code || client.unitCode !== unitCode || client.unitName !== unitName;
      if (!identityChanged)
        throw new BadRequestException('单位信息未发生变化');

      const exists = await clientRepository.exists({ where: { regionCode: region.code, unitCode, id: Not(id) } });
      if (exists)
        throw new BadRequestException('该区划下单位编码已存在');

      const operatorName = resolveUserDisplayName(user);
      await historyRepository.save(historyRepository.create({
        clientId: client.id,
        oldRegionCode: client.regionCode,
        oldRegionName: client.regionName,
        oldUnitCode: client.unitCode,
        oldUnitName: client.unitName,
        newRegionCode: region.code,
        newRegionName: region.name,
        newUnitCode: unitCode,
        newUnitName: unitName,
        reason,
        operatorId: user.id,
        operatorName,
      }));

      client.regionCode = region.code;
      client.regionName = region.name;
      client.unitCode = unitCode;
      client.unitName = unitName;
      await clientRepository.save(client);
      return client.id;
    });
    await this.refreshClientSummary(savedId);
    return this.detail(savedId);
  }

  async detail(id: number) {
    await this.refreshClientSummary(id);
    const client = await this.findOne(id);
    const summary = await this.summaryRepository.findOne({ where: { clientId: id } });
    const primaryContact = await this.contactRepository.findOne({ where: { clientId: id, isPrimary: true }, order: { id: 'ASC' } });
    const result = this.toListItem(client, this.summaryToRaw(summary, primaryContact));
    if (!client.mergedToClientId)
      return result;
    const target = await this.clientRepository.findOne({ where: { id: client.mergedToClientId } });
    return {
      ...result,
      mergedToClientRegionName: target?.regionName || null,
      mergedToClientUnitCode: target?.unitCode || null,
      mergedToClientUnitName: target?.unitName || null,
    };
  }

  async contacts(clientId: number) {
    await this.ensureClientExists(clientId);
    return this.contactRepository.find({ where: { clientId }, order: { isPrimary: 'DESC', id: 'DESC' } });
  }

  async createContact(clientId: number, dto: CreateClientContactDto) {
    await this.ensureClientEditable(clientId);
    if (dto.isPrimary)
      await this.contactRepository.update({ clientId }, { isPrimary: false });
    const contact = this.contactRepository.create({
      clientId,
      role: dto.role as ClientContactRole,
      name: this.requiredText(dto.name, '联系人姓名'),
      department: this.cleanOptional(dto.department),
      phone: this.cleanOptional(dto.phone),
      isPrimary: dto.isPrimary ?? false,
      remark: this.cleanOptional(dto.remark),
    });
    const saved = await this.contactRepository.save(contact);
    await this.refreshClientSummary(clientId);
    return saved;
  }

  async updateContact(clientId: number, contactId: number, dto: UpdateClientContactDto) {
    await this.ensureClientEditable(clientId);
    const contact = await this.contactRepository.findOne({ where: { id: contactId, clientId } });
    if (!contact)
      throw new NotFoundException('联系人不存在');
    if (dto.isPrimary)
      await this.contactRepository.update({ clientId }, { isPrimary: false });
    if (dto.role !== undefined)
      contact.role = dto.role as ClientContactRole;
    if (dto.name !== undefined)
      contact.name = this.requiredText(dto.name, '联系人姓名');
    if (dto.department !== undefined)
      contact.department = this.cleanOptional(dto.department);
    if (dto.phone !== undefined)
      contact.phone = this.cleanOptional(dto.phone);
    if (dto.isPrimary !== undefined)
      contact.isPrimary = dto.isPrimary;
    if (dto.remark !== undefined)
      contact.remark = this.cleanOptional(dto.remark);
    const saved = await this.contactRepository.save(contact);
    await this.refreshClientSummary(clientId);
    return saved;
  }

  async identityHistories(clientId: number) {
    await this.ensureClientExists(clientId);
    return this.identityHistoryRepository.find({ where: { clientId }, order: { id: 'DESC' } });
  }

  async mergeLogs(clientId: number) {
    await this.ensureClientExists(clientId);
    const logs = await this.mergeLogRepository
      .createQueryBuilder('log')
      .where('log.sourceClientId = :clientId OR log.targetClientId = :clientId', { clientId })
      .orderBy('log.id', 'DESC')
      .getMany();
    return logs.map(log => ({
      ...log,
      canRevert: Boolean(log.movedDetails && !log.revertedAt),
    }));
  }

  async merge(sourceClientId: number, dto: MergeClientDto, user: User) {
    if (sourceClientId === dto.targetClientId)
      throw new BadRequestException('不能合并到自身');
    const targetId = dto.targetClientId;
    const movedSummary = await this.dataSource.transaction(async (manager) => {
      const clientRepository = manager.getRepository(Client);
      const source = await clientRepository.findOne({ where: { id: sourceClientId } });
      const target = await clientRepository.findOne({ where: { id: targetId } });
      if (!source || !target)
        throw new NotFoundException('客户不存在');
      if (source.mergedToClientId || source.unitStatus === 'MERGED')
        throw new BadRequestException('该客户已经被合并');
      const movedDetails: MergeMovedDetails = {
        mode: 'status-only',
        sourceUnitStatus: source.unitStatus,
      };

      const moved = {
        orders: 0,
        serviceItems: 0,
        invoices: 0,
        payments: 0,
        contacts: 0,
        credentials: 0,
      };

      source.unitStatus = 'MERGED';
      source.mergedToClientId = target.id;
      await clientRepository.save(source);

      const operatorName = resolveUserDisplayName(user);
      await manager.getRepository(ClientMergeLog).save(manager.getRepository(ClientMergeLog).create({
        sourceClientId: source.id,
        targetClientId: target.id,
        sourceClientName: source.unitName,
        targetClientName: target.unitName,
        reason: this.cleanOptional(dto.reason),
        movedSummary: moved,
        movedDetails,
        operatorId: user.id,
        operatorName,
      }));
      return moved;
    });
    await Promise.all([this.refreshClientSummary(sourceClientId), this.refreshClientSummary(targetId)]);
    return { sourceClientId, targetClientId: targetId, movedSummary };
  }

  async revertMerge(clientId: number, logId: number, user: User) {
    const result = await this.dataSource.transaction(async (manager) => {
      const log = await manager.getRepository(ClientMergeLog).findOne({ where: { id: logId } });
      if (!log || (log.sourceClientId !== clientId && log.targetClientId !== clientId))
        throw new NotFoundException('合并记录不存在');
      if (log.revertedAt)
        throw new BadRequestException('该合并记录已撤销');
      const details = log.movedDetails as MergeMovedDetails | null;
      if (!details)
        throw new BadRequestException('旧合并记录缺少迁移明细，不能安全撤销');

      const clientRepository = manager.getRepository(Client);
      const source = await clientRepository.findOne({ where: { id: log.sourceClientId } });
      const target = await clientRepository.findOne({ where: { id: log.targetClientId } });
      if (!source || !target)
        throw new NotFoundException('客户不存在');
      if (source.mergedToClientId !== target.id)
        throw new BadRequestException('当前合并关系已变化，不能撤销该记录');

      const orderIds = details.orders || [];
      const invoiceIds = details.invoices || [];
      const paymentIds = details.payments || [];
      const credentialIds = details.credentials || [];
      const contactIds = (details.contacts || []).map(item => item.id);
      if (orderIds.length)
        await manager.getRepository(Order).update({ id: In(orderIds) }, { clientId: source.id });
      if (invoiceIds.length)
        await manager.getRepository(FinanceInvoice).update({ id: In(invoiceIds) }, { clientId: source.id });
      if (paymentIds.length)
        await manager.getRepository(FinancePayment).update({ id: In(paymentIds) }, { clientId: source.id });
      if (credentialIds.length)
        await manager.getRepository(ClientCredential).update({ id: In(credentialIds) }, { clientId: source.id });
      if (contactIds.length) {
        await manager.getRepository(ClientContact).update({ id: In(contactIds) }, { clientId: source.id, isPrimary: false });
        const primaryContactIds = (details.contacts || []).filter(item => item.isPrimary).map(item => item.id);
        if (primaryContactIds.length)
          await manager.getRepository(ClientContact).update({ id: In(primaryContactIds) }, { isPrimary: true });
      }
      for (const item of details.serviceItems || []) {
        await manager.getRepository(ServiceItem).update({ id: item.id }, { clientId: item.clientId });
      }

      source.mergedToClientId = null;
      source.unitStatus = details.sourceUnitStatus || 'NORMAL';
      await clientRepository.save(source);

      log.revertedAt = new Date();
      log.revertedById = user.id;
      log.revertedByName = resolveUserDisplayName(user);
      await manager.getRepository(ClientMergeLog).save(log);
      return { sourceClientId: source.id, targetClientId: target.id };
    });
    await Promise.all([this.refreshClientSummary(result.sourceClientId), this.refreshClientSummary(result.targetClientId)]);
    return result;
  }

  async remove(id: number) {
    const client = await this.findOne(id);
    const [orderCount, serviceCount, invoiceCount, paymentCount] = await Promise.all([
      this.orderRepository.count({ where: { clientId: client.id } }),
      this.serviceItemRepository.count({ where: { clientId: client.id } }),
      this.invoiceRepository.count({ where: { clientId: client.id } }),
      this.paymentRepository.count({ where: { clientId: client.id } }),
    ]);
    if (orderCount || serviceCount || invoiceCount || paymentCount)
      throw new BadRequestException('客户已存在订单、服务项、发票或收款，不能删除');

    await this.dataSource.transaction(async (manager) => {
      const credentials = await manager.getRepository(ClientCredential).find({ where: { clientId: client.id } });
      const contacts = await manager.getRepository(ClientContact).find({ where: { clientId: client.id } });
      if (credentials.length)
        await manager.getRepository(ClientCredential).softRemove(credentials);
      if (contacts.length)
        await manager.getRepository(ClientContact).softRemove(contacts);
      await manager.getRepository(Client).softRemove(client);
    });
    return true;
  }

  async findOne(id: number) {
    const client = await this.clientRepository.findOne({ where: { id } });
    if (!client)
      throw new NotFoundException('客户不存在');
    return client;
  }

  async refreshClientSummary(clientId: number) {
    const client = await this.clientRepository.findOne({ where: { id: clientId } });
    if (!client)
      throw new NotFoundException('客户不存在');
    const [orderRaw, serviceRaw, credentialCount, contactCount] = await Promise.all([
      this.orderRepository.createQueryBuilder('orders')
        .select('COUNT(orders.id)', 'orderCount')
        .addSelect('MAX(orders.orderDate)', 'latestOrderDate')
        .where('orders.clientId = :clientId', { clientId })
        .getRawOne<{ orderCount: string; latestOrderDate: string | null }>(),
      this.serviceItemRepository.createQueryBuilder('item')
        .innerJoin(Order, 'orders', 'orders.id = item.orderId')
        .select('COUNT(item.id)', 'serviceItemCount')
        .addSelect('COALESCE(SUM(item.billableAmount), 0)', 'receivableAmount')
        .addSelect('COALESCE(SUM(item.receivedAmount), 0)', 'receivedAmount')
        .where('orders.clientId = :clientId', { clientId })
        .getRawOne<{ serviceItemCount: string; receivableAmount: string; receivedAmount: string }>(),
      this.credentialRepository.count({ where: { clientId } }),
      this.contactRepository.count({ where: { clientId } }),
    ]);
    const receivableAmount = Number(serviceRaw?.receivableAmount || 0);
    const receivedAmount = Number(serviceRaw?.receivedAmount || 0);
    let summary = await this.summaryRepository.findOne({ where: { clientId } });
    if (!summary)
      summary = this.summaryRepository.create({ clientId });
    summary.orderCount = Number(orderRaw?.orderCount || 0);
    summary.serviceItemCount = Number(serviceRaw?.serviceItemCount || 0);
    summary.contactCount = contactCount;
    summary.credentialCount = credentialCount;
    summary.latestOrderDate = orderRaw?.latestOrderDate || null;
    summary.receivableAmount = String(receivableAmount);
    summary.receivedAmount = String(receivedAmount);
    summary.unpaidAmount = String(Math.max(receivableAmount - receivedAmount, 0));
    await this.summaryRepository.save(summary);
    return summary;
  }

  async snapshotMergeInfo(rows: Array<{ clientId: number }>): Promise<Array<SnapshotMergeInfo | null>> {
    if (!rows.length)
      return [];
    const clientIds = [...new Set(rows.map(row => row.clientId))];
    const clients = await this.clientRepository.find({
      where: { id: In(clientIds) },
      select: ['id', 'regionCode', 'unitCode', 'mergedToClientId'],
    });
    const targetIds = [...new Set(clients.map(client => client.mergedToClientId).filter((id): id is number => Boolean(id)))];
    const targets = targetIds.length
      ? await this.clientRepository.find({ where: { id: In(targetIds) }, select: ['id', 'regionName', 'unitCode', 'unitName'] })
      : [];
    const targetMap = new Map(targets.map(target => [target.id, target]));
    const mergeMap = new Map<number, SnapshotMergeInfo>();
    for (const client of clients) {
      if (!client.mergedToClientId)
        continue;
      const target = targetMap.get(client.mergedToClientId);
      if (!target)
        continue;
      mergeMap.set(client.id, {
        sourceClientId: client.id,
        targetClientId: target.id,
        targetRegionName: target.regionName,
        targetUnitCode: target.unitCode,
        targetUnitName: target.unitName,
      });
    }
    return rows.map(row => mergeMap.get(row.clientId) || null);
  }

  private joinClientReadModel(qb: ReturnType<Repository<Client>['createQueryBuilder']>) {
    qb
      .leftJoin(ClientSummary, 'summary', 'summary.clientId = client.id')
      .leftJoin(ClientContact, 'primaryContact', 'primaryContact.clientId = client.id AND primaryContact.isPrimary = true AND primaryContact.deleteTime IS NULL')
      .addSelect('COALESCE(summary.orderCount, 0)', 'orderCount')
      .addSelect('COALESCE(summary.serviceItemCount, 0)', 'serviceItemCount')
      .addSelect('COALESCE(summary.receivableAmount, 0)', 'receivableAmount')
      .addSelect('COALESCE(summary.receivedAmount, 0)', 'receivedAmount')
      .addSelect('COALESCE(summary.unpaidAmount, 0)', 'unpaidAmount')
      .addSelect('COALESCE(summary.credentialCount, 0)', 'credentialCount')
      .addSelect('COALESCE(summary.contactCount, 0)', 'contactCount')
      .addSelect('summary.latestOrderDate', 'latestOrderDate')
      .addSelect('primaryContact.name', 'primaryContactName')
      .addSelect('primaryContact.phone', 'primaryContactPhone');
  }

  private async clientPageSummary(qb: ReturnType<Repository<Client>['createQueryBuilder']>) {
    const raw = await qb.clone()
      .select('SUM(CASE WHEN COALESCE(summary.orderCount, 0) = 0 THEN 1 ELSE 0 END)', 'potentialCount')
      .addSelect('SUM(CASE WHEN COALESCE(summary.orderCount, 0) > 0 THEN 1 ELSE 0 END)', 'formalCount')
      .addSelect('SUM(CASE WHEN COALESCE(summary.orderCount, 0) > 0 AND COALESCE(client.customerLevel, :normalLevel) <> :normalLevel THEN 1 ELSE 0 END)', 'importantOrAboveCount')
      .addSelect('SUM(CASE WHEN COALESCE(summary.unpaidAmount, 0) > 0 THEN 1 ELSE 0 END)', 'unpaidClientCount')
      .addSelect('SUM(COALESCE(summary.unpaidAmount, 0))', 'unpaidAmount')
      .setParameter('normalLevel', 'NORMAL')
      .getRawOne();
    return {
      potentialCount: this.toNumber(raw?.potentialCount),
      formalCount: this.toNumber(raw?.formalCount),
      importantOrAboveCount: this.toNumber(raw?.importantOrAboveCount),
      unpaidClientCount: this.toNumber(raw?.unpaidClientCount),
      unpaidAmount: this.toNumber(raw?.unpaidAmount),
    };
  }

  private applyClientFilters(qb: ReturnType<Repository<Client>['createQueryBuilder']>, query: ClientPageQuery) {
    if (query.regionCode)
      qb.andWhere('client.regionCode = :regionCode', { regionCode: query.regionCode });
    if (query.keyword) {
      qb.andWhere('(client.unitName LIKE :keyword OR client.unitCode LIKE :keyword OR client.unifiedSocialCreditCode LIKE :keyword OR client.address LIKE :keyword)', {
        keyword: `%${query.keyword.trim()}%`,
      });
    }
    if (query.unitCode)
      qb.andWhere('client.unitCode LIKE :unitCode', { unitCode: `%${query.unitCode.trim()}%` });
    if (query.unitName)
      qb.andWhere('client.unitName LIKE :unitName', { unitName: `%${query.unitName.trim()}%` });
    if (query.creditCode)
      qb.andWhere('client.unifiedSocialCreditCode LIKE :creditCode', { creditCode: `%${query.creditCode.trim()}%` });
    if (query.unitStatus)
      qb.andWhere('client.unitStatus = :unitStatus', { unitStatus: query.unitStatus });
    if (query.customerStage === 'POTENTIAL')
      qb.andWhere('COALESCE(summary.orderCount, 0) = 0');
    if (query.customerStage === 'FORMAL')
      qb.andWhere('COALESCE(summary.orderCount, 0) > 0');
    if (query.customerLevel) {
      qb.andWhere('client.customerLevel = :customerLevel', { customerLevel: query.customerLevel });
    }
    if (query.contact) {
      qb.andWhere(`EXISTS (
        SELECT 1 FROM client_contacts contact
        WHERE contact.clientId = client.id
          AND contact.deleteTime IS NULL
          AND (contact.name LIKE :contact OR contact.phone LIKE :contact)
      )`, { contact: `%${query.contact.trim()}%` });
    }
    if (query.hasOrders === 'yes')
      qb.andWhere('COALESCE(summary.orderCount, 0) > 0');
    if (query.hasOrders === 'no')
      qb.andWhere('COALESCE(summary.orderCount, 0) = 0');
  }

  private applyClientSort(qb: ReturnType<Repository<Client>['createQueryBuilder']>, query: ClientPageQuery) {
    const sort = resolveSort(query.sortKey, query.sortOrder, {
      regionName: 'client.regionName',
      unitCode: 'client.unitCode',
      unitName: 'client.unitName',
      unitStatus: 'client.unitStatus',
      customerLevel: 'client.customerLevel',
      primaryContactName: 'primaryContact.name',
      primaryContactPhone: 'primaryContact.phone',
      orderCount: 'summary.orderCount',
      latestOrderDate: 'summary.latestOrderDate',
      receivableAmount: 'summary.receivableAmount',
      unpaidAmount: 'summary.unpaidAmount',
    });
    if (sort) {
      qb.orderBy(sort.column, sort.direction).addOrderBy('client.id', 'ASC');
      return;
    }
    qb.orderBy('client.regionCode', 'ASC')
      .addOrderBy('client.unitCode', 'ASC')
      .addOrderBy('client.id', 'ASC');
  }

  private toListItem(client: Client, summary: ClientSummaryRaw = {}) {
    const orderCount = this.toNumber(summary.orderCount);
    const serviceItemCount = this.toNumber(summary.serviceItemCount);
    const receivableAmount = this.toNumber(summary.receivableAmount);
    const receivedAmount = this.toNumber(summary.receivedAmount);
    const unpaidAmount = this.toNumber(summary.unpaidAmount);
    const credentialCount = this.toNumber(summary.credentialCount);
    const contactCount = this.toNumber(summary.contactCount);
    return {
      id: client.id,
      regionCode: client.regionCode,
      regionName: client.regionName,
      unitCode: client.unitCode,
      unitName: client.unitName,
      unitStatus: client.mergedToClientId ? 'MERGED' : client.unitStatus || 'NORMAL',
      customerStage: orderCount > 0 ? 'FORMAL' : 'POTENTIAL',
      customerLevel: client.customerLevel || 'NORMAL',
      maintainedCustomerLevel: client.customerLevel || 'NORMAL',
      mergedToClientId: client.mergedToClientId || null,
      unifiedSocialCreditCode: client.unifiedSocialCreditCode,
      legalPerson: client.legalPerson,
      financeStaff: client.financeStaff,
      financeManager: client.financeManager,
      source: client.source,
      address: client.address,
      contactPhone: client.contactPhone,
      remark: client.remark,
      createTime: client.createTime,
      updateTime: client.updateTime,
      primaryContactName: summary.primaryContactName || null,
      primaryContactPhone: summary.primaryContactPhone || null,
      latestOrderDate: summary.latestOrderDate || null,
      orderCount,
      serviceItemCount,
      serviceCount: serviceItemCount,
      receivableAmount,
      receivedAmount,
      unpaidAmount,
      credentialCount,
      contactCount,
    };
  }

  private summaryToRaw(summary?: ClientSummary | null, primaryContact?: ClientContact | null): ClientSummaryRaw {
    return {
      orderCount: summary?.orderCount || 0,
      serviceItemCount: summary?.serviceItemCount || 0,
      receivableAmount: summary?.receivableAmount || 0,
      receivedAmount: summary?.receivedAmount || 0,
      unpaidAmount: summary?.unpaidAmount || 0,
      credentialCount: summary?.credentialCount || 0,
      contactCount: summary?.contactCount || 0,
      latestOrderDate: summary?.latestOrderDate || null,
      primaryContactName: primaryContact?.name || null,
      primaryContactPhone: primaryContact?.phone || null,
    };
  }

  private async ensureClientExists(clientId: number) {
    const exists = await this.clientRepository.exists({ where: { id: clientId } });
    if (!exists)
      throw new NotFoundException('客户不存在');
  }

  private async ensureClientEditable(clientId: number) {
    const client = await this.clientRepository.findOne({ where: { id: clientId } });
    if (!client)
      throw new NotFoundException('客户不存在');
    if (client.mergedToClientId)
      throw new BadRequestException('已合并单位不能修改，请先撤销合并');
  }

  private toNumber(value: string | number | null | undefined) {
    return Number(value || 0);
  }

  private requiredText(value: string, label: string) {
    const text = value.trim();
    if (!text)
      throw new BadRequestException(`${label}不能为空`);
    return text;
  }

  private cleanOptional(value: string | undefined | null) {
    return value?.trim() || null;
  }
}
