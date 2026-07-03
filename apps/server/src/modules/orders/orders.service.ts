import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, In, Repository } from 'typeorm';
import { CONTRACT_STATUS, INVOICE_STATUS, SERVICE_COLLECTION_STATUS } from '../../common/business.constants';
import { normalizePage, pageResult } from '../../common/page';
import { parseOptionalPositiveInt } from '../../common/query';
import { resolveSort } from '../../common/sort';
import { ArchiveAttachmentLink } from '../../entities/archive-attachment-link.entity';
import { ArchiveAttachment } from '../../entities/archive-attachment.entity';
import { Client } from '../../entities/client.entity';
import { FinanceContractLine } from '../../entities/finance-contract-line.entity';
import { FinanceInvoiceLine } from '../../entities/finance-invoice-line.entity';
import { Order } from '../../entities/order.entity';
import { ServiceItem } from '../../entities/service-item.entity';
import { User } from '../../entities/user.entity';
import { ClientsService } from '../clients/clients.service';
import { ServiceCatalogService } from '../service-catalog/service-catalog.service';
import { SystemParametersService } from '../system-parameters/system-parameters.service';
import { CreateOrderDto, CreateOrderItemDto } from './dto/create-order.dto';
import { UpdateOrderDto, UpdateOrderItemDto } from './dto/update-order.dto';
import {
  DONE_SERVICE_ITEM_STATUSES,
  ORDER_CONTRACT_STATUS,
  ORDER_INVOICE_STATUS,
  ORDER_STATUS,
  ORDER_STATUSES,
  OrderContractStatus,
  OrderInvoiceStatus,
  SERVICE_ITEM_STATUS,
  SERVICE_ITEM_STATUSES,
  ServiceItemStatus,
} from './order.constants';
import { addDaysText, addMonthsInclusiveEndText, createRenewalSeed, createTodayText, resolveRenewalStatus } from './service-renewal';

type OrderQuery = {
  pageNo?: number;
  pageSize?: number;
  regionCode?: string;
  clientId?: string | number;
  serviceYear?: string | number;
  status?: string;
  keyword?: string;
  sortKey?: string;
  sortOrder?: string;
};

type ServiceDateRangeInput = {
  serviceStartDate?: string | null;
  serviceEndDate?: string | null;
};

type OrderWithAttachmentStatus = Order & {
  contractStatus?: OrderContractStatus;
  invoiceStatus?: OrderInvoiceStatus;
  attachmentCount?: number;
};

const LEGACY_REPORTED_SERVICE_ITEM_STATUS = '已上报';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly orderRepository: Repository<Order>,
    @InjectRepository(ServiceItem) private readonly serviceItemRepository: Repository<ServiceItem>,
    @InjectRepository(Client) private readonly clientRepository: Repository<Client>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(ArchiveAttachment) private readonly attachmentRepository: Repository<ArchiveAttachment>,
    @InjectRepository(ArchiveAttachmentLink) private readonly attachmentLinkRepository: Repository<ArchiveAttachmentLink>,
    @InjectRepository(FinanceContractLine) private readonly contractLineRepository: Repository<FinanceContractLine>,
    @InjectRepository(FinanceInvoiceLine) private readonly invoiceLineRepository: Repository<FinanceInvoiceLine>,
    private readonly dataSource: DataSource,
    private readonly clientsService: ClientsService,
    private readonly serviceCatalogService: ServiceCatalogService,
    private readonly parametersService: SystemParametersService,
  ) {}

  async page(query: OrderQuery) {
    const { pageSize, skip } = normalizePage(query);
    const qb = this.buildOrderQuery(query);
    const sort = resolveSort(query.sortKey, query.sortOrder, {
      orderNo: 'orderNo',
      createdAt: 'orderDate',
      orderDate: 'orderDate',
      serviceYear: 'serviceYear',
      regionName: 'regionName',
      unitCode: 'unitCode',
      clientName: 'unitName',
      unitName: 'unitName',
      packageAmount: 'packageAmount',
      billableAmount: 'billableAmount',
      status: 'status',
      updateTime: 'updateTime',
    });
    if (sort)
      qb.orderBy(`orders.${sort.column}`, sort.direction).addOrderBy('orders.id', 'DESC');
    else
      qb.orderBy('orders.id', 'DESC');
    const [orders, total] = await qb.skip(skip).take(pageSize).getManyAndCount();
    await this.attachServiceItems(orders);
    await this.attachFinancialStatuses(orders);
    await this.attachAttachmentStatuses(orders);
    const mergeInfos = await this.clientsService.snapshotMergeInfo(orders);
    return pageResult(orders.map((order, index) => this.toOrderRow(order, mergeInfos[index])), total);
  }

  async detail(id: number) {
    const order = await this.findOrderWithItems(id);
    const warningDays = await this.parametersService.getServiceDueWarningDays();
    await this.attachFinancialStatuses([order]);
    await this.attachAttachmentStatuses([order]);
    const [mergeInfo] = await this.clientsService.snapshotMergeInfo([order]);
    return {
      ...this.toOrderRow(order, mergeInfo),
      cancelReason: order.cancelReason || null,
      serviceItems: order.serviceItems.map(item => this.toServiceItemRow(item, warningDays)),
    };
  }

  async update(id: number, dto: UpdateOrderDto) {
    const order = await this.findOrderWithItems(id);
    if (order.status === ORDER_STATUS.CANCELLED && dto.status !== ORDER_STATUS.CANCELLED)
      throw new BadRequestException('已取消订单不能继续编辑');
    if (dto.serviceYear !== undefined) {
      order.serviceYear = dto.serviceYear;
      for (const item of order.serviceItems)
        item.serviceYear = dto.serviceYear;
    }
    if (dto.orderDate !== undefined)
      order.orderDate = dto.orderDate;
    if (dto.packageAmount !== undefined)
      order.packageAmount = String(dto.packageAmount);
    if (dto.remark !== undefined)
      order.remark = this.optionalText(dto.remark);

    const warningDays = dto.items ? await this.parametersService.getServiceDueWarningDays() : null;
    const removedItems = dto.items ? this.resolveRemovedItems(order, dto.items) : [];
    const nextItems = dto.items ? await this.resolveUpdatedServiceItems(order, dto.items, warningDays!) : order.serviceItems;

    if (dto.status) {
      this.assertOrderStatus(dto.status);
      if (dto.status === ORDER_STATUS.CANCELLED) {
        if (!dto.cancelReason?.trim())
          throw new BadRequestException('取消订单需要填写原因');
        order.status = ORDER_STATUS.CANCELLED;
        order.canceledAt = new Date();
        order.cancelReason = this.optionalText(dto.cancelReason);
        for (const item of nextItems) {
          if (item.status !== SERVICE_ITEM_STATUS.DONE) {
            item.status = SERVICE_ITEM_STATUS.CANCELLED;
            item.statusUpdatedAt = new Date();
          }
        }
      }
      else {
        const nextStatus = this.resolveOrderStatus(nextItems);
        if (dto.status !== nextStatus)
          throw new BadRequestException(`订单状态由服务项自动汇总，当前应为：${nextStatus}`);
        order.status = nextStatus;
        order.canceledAt = null;
        order.cancelReason = null;
      }
    }

    this.assertOrderAllocation(order, nextItems);
    this.refreshOrderTotals(order, nextItems);
    await this.dataSource.transaction(async (manager) => {
      if (removedItems.length)
        await manager.softRemove(ServiceItem, removedItems);
      order.serviceItems = nextItems;
      await manager.save(order);
      await manager.save(ServiceItem, nextItems);
    });
    await this.clientsService.refreshClientSummary(order.clientId);
    return this.detail(order.id);
  }

  async create(dto: CreateOrderDto) {
    const warningDays = await this.parametersService.getServiceDueWarningDays();
    const client = await this.clientRepository.findOne({ where: { id: dto.clientId } });
    if (!client)
      throw new NotFoundException('客户不存在');
    if (client.mergedToClientId)
      throw new BadRequestException('该客户已合并，请在合并后单位下新增订单');
    if (client.regionCode !== dto.regionCode)
      throw new BadRequestException('客户不属于所选区划');

    const allocatedTotal = dto.items.reduce((sum, item) => sum + Number(item.allocatedAmount || 0), 0);
    if (Number(allocatedTotal.toFixed(2)) !== Number(Number(dto.packageAmount).toFixed(2)))
      throw new BadRequestException('服务项分摊金额合计必须等于打包总价');

    const hydratedItems = await Promise.all(dto.items.map(item => this.resolveOrderItem(item)));
    for (const item of hydratedItems) {
      this.assertServiceDateRange(item.raw);
      if (item.service.minMonths > 0)
        this.assertMinServicePeriod(item.raw, item.service.minMonths);
      this.assertServiceItemStatus(item.raw.status || '进行中');
    }


    const result = await this.dataSource.transaction(async (manager) => {
      const orderNo = await this.nextOrderNo(manager);
      const billableAmount = hydratedItems.reduce((sum, item) => sum + Number(item.raw.billableAmount || 0), 0);
      const order = manager.create(Order, {
        orderNo,
        clientId: client.id,
        regionCode: client.regionCode,
        regionName: client.regionName,
        unitCode: client.unitCode,
        unitName: client.unitName,
        serviceYear: dto.serviceYear,
        packageAmount: String(dto.packageAmount),
        billableAmount: String(billableAmount),
        orderDate: dto.orderDate,
        status: this.resolveOrderStatusFromRawItems(dto.items),
        remark: dto.remark?.trim() || null,
      });
      const savedOrder = await manager.save(order);

      const serviceItems = hydratedItems.map(({ raw, service, receiver, performer }) => manager.create(ServiceItem, {
        orderId: savedOrder.id,
        orderNo,
        clientId: client.id,
        regionCode: client.regionCode,
        regionName: client.regionName,
        unitCode: client.unitCode,
        unitName: client.unitName,
        serviceCode: service.code,
        serviceName: service.name,
        serviceYear: dto.serviceYear,
        receiverId: receiver.id,
        receiverName: receiver.employeeProfile?.name || receiver.nickName || receiver.username,
        performerId: performer.id,
        performerName: performer.employeeProfile?.name || performer.nickName || performer.username,
        allocatedAmount: String(raw.allocatedAmount),
        billableAmount: String(raw.billableAmount),
        receivedAmount: '0',
        status: this.normalizeServiceItemStatus(raw.status || '进行中'),
        statusUpdatedAt: new Date(),
        serviceStartDate: raw.serviceStartDate || null,
        serviceEndDate: raw.serviceEndDate || null,
        ...createRenewalSeed(Boolean(service.reminderEnabled), warningDays, raw.serviceEndDate || null),
        renewalOfServiceItemId: null,
        renewedByServiceItemId: null,
        renewalRemark: null,
        completedAt: raw.completedAt || null,
        reportSummary: this.optionalText(raw.reportSummary),
        problemDescription: this.optionalText(raw.problemDescription),
        proofUrl: this.optionalText(raw.proofUrl),
        remark: raw.remark?.trim() || null,
      }));
      await manager.save(serviceItems);
      return this.toOrderRow({ ...savedOrder, serviceItems });
    });
    await this.clientsService.refreshClientSummary(client.id);
    return result;
  }

  async renewServiceItem(orderId: number, itemId: number) {
    const warningDays = await this.parametersService.getServiceDueWarningDays();
    const order = await this.findOrderWithItems(orderId);
    this.assertOrderEditable(order);
    const sourceItem = order.serviceItems.find(row => row.id === itemId);
    if (!sourceItem)
      throw new NotFoundException('服务项不存在');
    if (sourceItem.renewedByServiceItemId)
      throw new BadRequestException('该服务项已续签，不能重复创建');
    const service = await this.serviceCatalogService.findByCodeOrName(sourceItem.serviceCode);
    if (!service?.reminderEnabled)
      throw new BadRequestException('该服务项不需要续签');

    const serviceStartDate = sourceItem.serviceEndDate ? addDaysText(sourceItem.serviceEndDate, 1) : createTodayText();
    const serviceEndDate = addMonthsInclusiveEndText(serviceStartDate, service.minMonths || 12);
    const serviceYear = Number(serviceStartDate.slice(0, 4));
    const result = await this.dataSource.transaction(async (manager) => {
      const orderNo = await this.nextOrderNo(manager);
      const amount = Number(sourceItem.billableAmount || 0);
      const renewalOrder = await manager.save(manager.create(Order, {
        orderNo,
        clientId: order.clientId,
        regionCode: order.regionCode,
        regionName: order.regionName,
        unitCode: order.unitCode,
        unitName: order.unitName,
        serviceYear,
        packageAmount: String(amount),
        billableAmount: String(amount),
        orderDate: createTodayText(),
        status: '已确认',
        remark: `续签来源：${sourceItem.orderNo} ${sourceItem.serviceName}`,
      }));
      const renewalItem = await manager.save(manager.create(ServiceItem, {
        orderId: renewalOrder.id,
        orderNo,
        clientId: order.clientId,
        regionCode: order.regionCode,
        regionName: order.regionName,
        unitCode: order.unitCode,
        unitName: order.unitName,
        serviceCode: sourceItem.serviceCode,
        serviceName: sourceItem.serviceName,
        serviceYear,
        receiverId: sourceItem.receiverId,
        receiverName: sourceItem.receiverName,
        performerId: sourceItem.performerId,
        performerName: sourceItem.performerName,
        allocatedAmount: String(amount),
        billableAmount: String(amount),
        receivedAmount: '0',
        status: '待开始',
        statusUpdatedAt: new Date(),
        serviceStartDate,
        serviceEndDate,
        ...createRenewalSeed(Boolean(service.reminderEnabled), warningDays, serviceEndDate),
        renewalOfServiceItemId: sourceItem.id,
        renewedByServiceItemId: null,
        renewalRemark: `续签来源：${sourceItem.orderNo} ${sourceItem.serviceName}`,
        completedAt: null,
        reportSummary: null,
        problemDescription: null,
        proofUrl: null,
        remark: sourceItem.remark,
      }));
      sourceItem.renewalStatus = '已续签';
      sourceItem.renewedByServiceItemId = renewalItem.id;
      sourceItem.renewalRemark = `已续签至订单 ${orderNo}`;
      await manager.save(sourceItem);
      return renewalOrder;
    });
    await this.clientsService.refreshClientSummary(order.clientId);
    return this.detail(result.id);
  }

  async remove(id: number, reason?: string | null) {
    const deleteReason = this.optionalText(reason);
    if (!deleteReason)
      throw new BadRequestException('删除订单需要填写原因');

    const order = await this.findOrderWithItems(id);
    for (const item of order.serviceItems)
      this.assertServiceItemRemovable(item);

    const snapshot = {
      id: order.id,
      orderNo: order.orderNo,
      clientId: order.clientId,
      unitName: order.unitName,
      serviceYear: order.serviceYear,
      status: order.status,
      serviceItemCount: order.serviceItems.length,
      reason: deleteReason,
    };
    await this.dataSource.transaction(async (manager) => {
      if (order.serviceItems.length)
        await manager.softRemove(ServiceItem, order.serviceItems);
      await manager.softRemove(Order, order);
    });
    await this.clientsService.refreshClientSummary(order.clientId);
    return snapshot;
  }

  private async resolveOrderItem(raw: CreateOrderItemDto) {
    const service = await this.serviceCatalogService.findEnabledByCodeOrName(raw.serviceCode || raw.serviceName || '');
    if (!service)
      throw new BadRequestException(`服务项不存在或已停用：${raw.serviceCode || raw.serviceName}`);
    const [receiver, performer] = await Promise.all([
      this.userRepository.findOne({ where: { id: raw.receiverId, userKind: 'EMPLOYEE', enable: true }, relations: ['employeeProfile'] }),
      this.userRepository.findOne({ where: { id: raw.performerId, userKind: 'EMPLOYEE', enable: true }, relations: ['employeeProfile'] }),
    ]);
    if (!receiver)
      throw new BadRequestException(`接单员工不存在或已停用：${raw.receiverId}`);
    if (!performer)
      throw new BadRequestException(`完成员工不存在或已停用：${raw.performerId}`);
    return { raw, service, receiver, performer };
  }

  private async hydrateServiceItemForOrder(order: Order, raw: CreateOrderItemDto, warningDays: number) {
    const { service, receiver, performer } = await this.resolveOrderItem(raw);
    this.assertServiceDateRange(raw);
    if (service.minMonths > 0)
      this.assertMinServicePeriod(raw, service.minMonths);
    this.assertServiceItemStatus(raw.status || '进行中');
    return {
      orderId: order.id,
      orderNo: order.orderNo,
      clientId: order.clientId,
      regionCode: order.regionCode,
      regionName: order.regionName,
      unitCode: order.unitCode,
      unitName: order.unitName,
      serviceCode: service.code,
      serviceName: service.name,
      serviceYear: order.serviceYear,
      receiverId: receiver.id,
      receiverName: this.resolveEmployeeName(receiver),
      performerId: performer.id,
      performerName: this.resolveEmployeeName(performer),
      allocatedAmount: String(raw.allocatedAmount),
      billableAmount: String(raw.billableAmount),
      receivedAmount: '0',
      status: this.normalizeServiceItemStatus(raw.status || '进行中'),
      statusUpdatedAt: new Date(),
      serviceStartDate: raw.serviceStartDate || null,
      serviceEndDate: raw.serviceEndDate || null,
      ...createRenewalSeed(Boolean(service.reminderEnabled), warningDays, raw.serviceEndDate || null),
      renewalOfServiceItemId: null,
      renewedByServiceItemId: null,
      renewalRemark: null,
      completedAt: raw.completedAt || null,
      reportSummary: this.optionalText(raw.reportSummary),
      problemDescription: this.optionalText(raw.problemDescription),
      proofUrl: this.optionalText(raw.proofUrl),
      remark: this.optionalText(raw.remark),
    };
  }

  private resolveRemovedItems(order: Order, items: UpdateOrderItemDto[]) {
    const incomingIds = new Set(items.map(item => item.id).filter((itemId): itemId is number => Boolean(itemId)));
    const removedItems = order.serviceItems.filter(item => !incomingIds.has(item.id));
    for (const item of removedItems)
      this.assertServiceItemRemovable(item);
    return removedItems;
  }

  private async resolveUpdatedServiceItems(order: Order, rows: UpdateOrderItemDto[], warningDays: number) {
    const existingItems = new Map(order.serviceItems.map(item => [item.id, item]));
    const nextItems: ServiceItem[] = [];
    for (const raw of rows) {
      if (raw.id) {
        const item = existingItems.get(raw.id);
        if (!item)
          throw new NotFoundException('服务项不存在');
        await this.applyServiceItemSnapshot(item, raw, warningDays);
        nextItems.push(item);
      }
      else {
        nextItems.push(this.serviceItemRepository.create(await this.hydrateServiceItemForOrder(order, raw, warningDays)));
      }
    }
    return nextItems;
  }

  private async applyServiceItemSnapshot(item: ServiceItem, raw: UpdateOrderItemDto, warningDays: number) {
    const service = await this.resolveServiceCatalogForUpdate(raw.serviceCode, item);
    const [receiver, performer] = await Promise.all([
      this.resolveEmployee(raw.receiverId, '接单员工'),
      this.resolveEmployee(raw.performerId, '完成员工'),
    ]);
    item.serviceCode = service.code;
    item.serviceName = service.name;
    item.receiverId = receiver.id;
    item.receiverName = this.resolveEmployeeName(receiver);
    item.performerId = performer.id;
    item.performerName = this.resolveEmployeeName(performer);
    item.allocatedAmount = String(raw.allocatedAmount);
    item.billableAmount = String(raw.billableAmount);
    item.status = this.normalizeServiceItemStatus(raw.status || '进行中');
    item.statusUpdatedAt = new Date();
    item.serviceStartDate = raw.serviceStartDate || null;
    item.serviceEndDate = raw.serviceEndDate || null;
    this.applyRenewalSeed(item, Boolean(service.reminderEnabled), warningDays);
    if (raw.completedAt !== undefined)
      item.completedAt = raw.completedAt || null;
    if (raw.reportSummary !== undefined)
      item.reportSummary = this.optionalText(raw.reportSummary);
    if (raw.problemDescription !== undefined)
      item.problemDescription = this.optionalText(raw.problemDescription);
    if (raw.proofUrl !== undefined)
      item.proofUrl = this.optionalText(raw.proofUrl);
    item.remark = this.optionalText(raw.remark);
    this.assertServiceDateRange(item);
    if (service.minMonths > 0)
      this.assertMinServicePeriod(item, service.minMonths);
    this.assertServiceItemStatus(item.status);
    this.assertReceivedAmountCovered(item);
    if (item.status === SERVICE_ITEM_STATUS.DONE && !item.completedAt)
      item.completedAt = this.createTodayText();
  }

  private async resolveServiceCatalogForUpdate(serviceCode: string, currentItem: ServiceItem) {
    const service = currentItem.serviceCode === serviceCode
      ? await this.serviceCatalogService.findByCodeOrName(serviceCode)
      : await this.serviceCatalogService.findEnabledByCodeOrName(serviceCode);
    if (!service)
      throw new BadRequestException(`服务项不存在或已停用：${serviceCode}`);
    return service;
  }

  private async resolveEmployee(id: number, label: string) {
    const employee = await this.userRepository.findOne({ where: { id, userKind: 'EMPLOYEE', enable: true }, relations: ['employeeProfile'] });
    if (!employee)
      throw new BadRequestException(`${label}不存在或已停用：${id}`);
    return employee;
  }

  private assertMinServicePeriod(item: ServiceDateRangeInput, minMonths: number) {
    if (!item.serviceStartDate || !item.serviceEndDate)
      throw new BadRequestException('该服务项需要填写服务开始和到期日期');
    const range = this.resolveServiceDateRange(item);
    if (!range)
      throw new BadRequestException('该服务项需要填写服务开始和到期日期');
    const { startDate, endDate } = range;
    const minEndDate = new Date(startDate);
    minEndDate.setMonth(minEndDate.getMonth() + minMonths);
    minEndDate.setDate(minEndDate.getDate() - 1);
    if (endDate < minEndDate)
      throw new BadRequestException(`服务期不能少于 ${minMonths} 个月`);
  }

  private assertServiceDateRange(item: ServiceDateRangeInput) {
    const range = this.resolveServiceDateRange(item);
    if (range && range.endDate < range.startDate)
      throw new BadRequestException('服务到期日期不能早于服务开始日期');
  }

  private applyRenewalSeed(item: ServiceItem, reminderEnabled: boolean, warningDays: number) {
    if (['已续签', '不续签', '已终止'].includes(item.renewalStatus))
      return;
    const seed = createRenewalSeed(reminderEnabled, warningDays, item.serviceEndDate || null);
    item.renewalStatus = seed.renewalStatus;
    item.renewalReminderDate = seed.renewalReminderDate;
  }

  private resolveServiceDateRange(item: ServiceDateRangeInput) {
    if (!item.serviceStartDate || !item.serviceEndDate)
      return null;
    const startDate = new Date(`${item.serviceStartDate}T00:00:00`);
    const endDate = new Date(`${item.serviceEndDate}T00:00:00`);
    return { startDate, endDate };
  }

  private assertOrderAllocation(order: Order, items: Array<Pick<ServiceItem, 'allocatedAmount'>>) {
    const allocatedTotal = items.reduce((sum, item) => sum + Number(item.allocatedAmount || 0), 0);
    if (Number(allocatedTotal.toFixed(2)) !== Number(Number(order.packageAmount || 0).toFixed(2)))
      throw new BadRequestException('服务项分摊金额合计必须等于打包总价');
  }

  private assertOrderEditable(order: Order) {
    if (order.status === ORDER_STATUS.CANCELLED)
      throw new BadRequestException('已取消订单不能继续维护服务项');
  }

  private assertServiceItemRemovable(item: ServiceItem) {
    if (Number(item.receivedAmount || 0) > 0)
      throw new BadRequestException('已有收款的服务项不能删除');
  }

  private assertReceivedAmountCovered(item: ServiceItem) {
    if (Number(item.receivedAmount || 0) > Number(item.billableAmount || 0))
      throw new BadRequestException('服务项应收金额不能小于已收金额');
  }

  private assertOrderStatus(status: string) {
    if (!ORDER_STATUSES.includes(status as typeof ORDER_STATUSES[number]))
      throw new BadRequestException('订单状态无效');
  }

  private assertServiceItemStatus(status: string) {
    if (!SERVICE_ITEM_STATUSES.includes(this.normalizeServiceItemStatus(status) as ServiceItemStatus))
      throw new BadRequestException('服务项状态无效');
  }

  private refreshOrderTotals(order: Order, items: ServiceItem[]) {
    const billableAmount = items.reduce((sum, item) => sum + Number(item.billableAmount || 0), 0);
    order.billableAmount = String(Number(billableAmount.toFixed(2)));
    if (order.status !== ORDER_STATUS.CANCELLED)
      order.status = this.resolveOrderStatus(items);
    order.completedAt = order.status === ORDER_STATUS.DONE ? (order.completedAt || new Date()) : null;
  }

  private resolveOrderStatus(items: ServiceItem[]) {
    if (!items.length)
      return ORDER_STATUS.CONFIRMED;
    const statuses = items.map(item => this.normalizeServiceItemStatus(item.status));
    if (statuses.every(status => status === SERVICE_ITEM_STATUS.CANCELLED))
      return ORDER_STATUS.CANCELLED;
    if (statuses.some(status => status === SERVICE_ITEM_STATUS.DONE) && statuses.every(status => status === SERVICE_ITEM_STATUS.DONE || status === SERVICE_ITEM_STATUS.CANCELLED))
      return ORDER_STATUS.DONE;
    if (statuses.some(status => status === SERVICE_ITEM_STATUS.DONE || status === SERVICE_ITEM_STATUS.PENDING_CONFIRMATION))
      return ORDER_STATUS.PARTIAL_DONE;
    if (statuses.every(status => status === SERVICE_ITEM_STATUS.PENDING_ASSIGNMENT || status === SERVICE_ITEM_STATUS.PENDING_START))
      return ORDER_STATUS.CONFIRMED;
    return ORDER_STATUS.IN_PROGRESS;
  }

  private resolveOrderStatusFromRawItems(items: CreateOrderItemDto[]) {
    return this.resolveOrderStatus(items.map(item => ({ status: this.normalizeServiceItemStatus(item.status || SERVICE_ITEM_STATUS.IN_PROGRESS) }) as ServiceItem));
  }

  private normalizeServiceItemStatus(status: string) {
    return status === LEGACY_REPORTED_SERVICE_ITEM_STATUS ? SERVICE_ITEM_STATUS.PENDING_CONFIRMATION : status;
  }

  private buildOrderQuery(query: OrderQuery) {
    const clientId = parseOptionalPositiveInt(query.clientId, '客户ID');
    const serviceYear = this.parseOptionalYear(query.serviceYear);
    const qb = this.orderRepository.createQueryBuilder('orders');
    if (query.regionCode)
      qb.andWhere('orders.regionCode = :regionCode', { regionCode: query.regionCode });
    if (clientId)
      qb.andWhere('orders.clientId = :clientId', { clientId });
    if (serviceYear)
      qb.andWhere('orders.serviceYear = :serviceYear', { serviceYear });
    if (query.status) {
      this.assertOrderStatus(query.status);
      qb.andWhere('orders.status = :status', { status: query.status });
    }
    if (query.keyword?.trim()) {
      const keyword = `%${query.keyword.trim()}%`;
      qb.andWhere(new Brackets((where) => {
        where.where('orders.orderNo LIKE :keyword', { keyword })
          .orWhere('orders.unitName LIKE :keyword', { keyword })
          .orWhere('orders.unitCode LIKE :keyword', { keyword })
          .orWhere('orders.remark LIKE :keyword', { keyword });
      }));
    }
    return qb;
  }

  private parseOptionalYear(value?: string | number) {
    if (value === undefined || value === null || value === '')
      return null;
    const year = Number(value);
    if (!Number.isInteger(year) || year < 2000)
      throw new BadRequestException('服务年度无效');
    return year;
  }

  private async findOrderWithItems(id: number) {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['serviceItems'],
    });
    if (!order)
      throw new NotFoundException('订单不存在');
    order.serviceItems = (order.serviceItems || []).sort((left, right) => left.id - right.id);
    return order;
  }

  private async attachServiceItems(orders: Order[]) {
    if (!orders.length)
      return;
    const items = await this.serviceItemRepository.find({
      where: { orderId: In(orders.map(order => order.id)) },
      order: { id: 'ASC' },
    });
    const itemsByOrderId = new Map<number, ServiceItem[]>();
    for (const item of items) {
      const rows = itemsByOrderId.get(item.orderId) || [];
      rows.push(item);
      itemsByOrderId.set(item.orderId, rows);
    }
    for (const order of orders)
      order.serviceItems = itemsByOrderId.get(order.id) || [];
  }

  private async attachAttachmentStatuses(orders: OrderWithAttachmentStatus[]) {
    if (!orders.length)
      return;
    const linkRows = await this.attachmentLinkRepository.createQueryBuilder('link')
      .select('link.entityId', 'linkedId')
      .addSelect('COUNT(link.id)', 'attachmentCount')
      .where('link.entityType = :linkedType', { linkedType: '订单' })
      .andWhere('link.entityId IN (:...orderIds)', { orderIds: orders.map(order => order.id) })
      .groupBy('link.entityId')
      .getRawMany<{ linkedId: string | number; attachmentCount: string }>();

    const legacyRows = await this.attachmentRepository.createQueryBuilder('attachment')
      .select('attachment.linkedId', 'linkedId')
      .addSelect('COUNT(attachment.id)', 'attachmentCount')
      .where('attachment.linkedType = :linkedType', { linkedType: '订单' })
      .andWhere('attachment.linkedId IN (:...orderIds)', { orderIds: orders.map(order => order.id) })
      .groupBy('attachment.linkedId')
      .getRawMany<{ linkedId: string | number; attachmentCount: string }>();

    const countByOrderId = new Map<number, number>();
    for (const row of [...linkRows, ...legacyRows]) {
      const orderId = Number(row.linkedId);
      countByOrderId.set(orderId, (countByOrderId.get(orderId) || 0) + Number(row.attachmentCount || 0));
    }

    for (const order of orders)
      order.attachmentCount = countByOrderId.get(order.id) || 0;
  }

  private async attachFinancialStatuses(orders: OrderWithAttachmentStatus[]) {
    if (!orders.length)
      return;
    const itemOrderMap = new Map<number, number>();
    const billableByOrderId = new Map<number, number>();
    for (const order of orders) {
      billableByOrderId.set(order.id, Number(order.billableAmount || 0));
      for (const item of order.serviceItems || [])
        itemOrderMap.set(item.id, order.id);
      order.contractStatus = ORDER_CONTRACT_STATUS.NOT_CREATED;
      order.invoiceStatus = ORDER_INVOICE_STATUS.NOT_ISSUED;
    }
    const serviceItemIds = [...itemOrderMap.keys()];
    if (!serviceItemIds.length)
      return;

    const contractRows = await this.contractLineRepository.createQueryBuilder('line')
      .innerJoin('line.contract', 'contract')
      .select('line.orderServiceItemId', 'serviceItemId')
      .addSelect('contract.status', 'status')
      .addSelect('SUM(line.amount)', 'amount')
      .where('line.orderServiceItemId IN (:...serviceItemIds)', { serviceItemIds })
      .groupBy('line.orderServiceItemId')
      .addGroupBy('contract.status')
      .getRawMany<{ serviceItemId: string | number; status: string; amount: string }>();
    const invoiceRows = await this.invoiceLineRepository.createQueryBuilder('line')
      .innerJoin('line.invoice', 'invoice')
      .select('line.orderServiceItemId', 'serviceItemId')
      .addSelect('invoice.status', 'status')
      .addSelect('SUM(line.amount)', 'amount')
      .where('line.orderServiceItemId IN (:...serviceItemIds)', { serviceItemIds })
      .groupBy('line.orderServiceItemId')
      .addGroupBy('invoice.status')
      .getRawMany<{ serviceItemId: string | number; status: string; amount: string }>();

    const contractSignedByOrderId = new Map<number, number>();
    const contractDraftByOrderId = new Map<number, number>();
    for (const row of contractRows) {
      const orderId = itemOrderMap.get(Number(row.serviceItemId));
      if (!orderId)
        continue;
      if (row.status === CONTRACT_STATUS.SIGNED)
        contractSignedByOrderId.set(orderId, (contractSignedByOrderId.get(orderId) || 0) + Number(row.amount || 0));
      if (row.status === CONTRACT_STATUS.DRAFT)
        contractDraftByOrderId.set(orderId, (contractDraftByOrderId.get(orderId) || 0) + Number(row.amount || 0));
    }

    const invoiceAmountByOrderId = new Map<number, number>();
    for (const row of invoiceRows) {
      if (row.status === INVOICE_STATUS.VOIDED)
        continue;
      const orderId = itemOrderMap.get(Number(row.serviceItemId));
      if (!orderId)
        continue;
      invoiceAmountByOrderId.set(orderId, (invoiceAmountByOrderId.get(orderId) || 0) + Number(row.amount || 0));
    }

    for (const order of orders) {
      const billableAmount = billableByOrderId.get(order.id) || 0;
      const signedAmount = contractSignedByOrderId.get(order.id) || 0;
      const draftAmount = contractDraftByOrderId.get(order.id) || 0;
      const invoiceAmount = invoiceAmountByOrderId.get(order.id) || 0;
      order.contractStatus = this.resolveContractStatus(billableAmount, signedAmount, draftAmount);
      order.invoiceStatus = this.resolveInvoiceStatus(billableAmount, invoiceAmount);
    }
  }

  private resolveContractStatus(billableAmount: number, signedAmount: number, draftAmount: number) {
    if (billableAmount > 0 && signedAmount >= billableAmount)
      return ORDER_CONTRACT_STATUS.SIGNED;
    if (signedAmount > 0)
      return ORDER_CONTRACT_STATUS.PARTIAL_SIGNED;
    if (draftAmount > 0)
      return ORDER_CONTRACT_STATUS.DRAFT;
    return ORDER_CONTRACT_STATUS.NOT_CREATED;
  }

  private resolveInvoiceStatus(billableAmount: number, invoiceAmount: number) {
    if (billableAmount > 0 && invoiceAmount >= billableAmount)
      return ORDER_INVOICE_STATUS.ISSUED;
    if (invoiceAmount > 0)
      return ORDER_INVOICE_STATUS.PARTIAL_ISSUED;
    return ORDER_INVOICE_STATUS.NOT_ISSUED;
  }

  private async nextOrderNo(manager: EntityManager) {
    const prefix = await this.createOrderNoPrefix();
    const latest = await manager.getRepository(Order)
      .createQueryBuilder('orders')
      .where('orders.orderNo LIKE :prefix', { prefix: `${prefix}%` })
      .andWhere('orders.orderNo REGEXP :pattern', { pattern: `^${prefix}[0-9]{5}$` })
      .orderBy('orders.orderNo', 'DESC')
      .getOne();
    const nextSerial = latest ? Number(latest.orderNo.slice(prefix.length)) + 1 : 1;
    if (nextSerial > 99999)
      throw new BadRequestException('当日订单号已超过最大序号');
    return `${prefix}${String(nextSerial).padStart(5, '0')}`;
  }

  private async createOrderNoPrefix() {
    const orderNoPrefix = await this.parametersService.getOrderNoPrefix();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${orderNoPrefix}${year}${month}${day}`;
  }

  private toOrderRow(order: OrderWithAttachmentStatus, mergeInfo: {
    sourceClientId: number;
    targetClientId: number;
    targetRegionName: string;
    targetUnitCode: string;
    targetUnitName: string;
  } | null = null) {
    const serviceItems = order.serviceItems || [];
    const serviceNames = serviceItems.map(item => item.serviceName).filter(Boolean);
    const receivedAmount = serviceItems.reduce((sum, item) => sum + Number(item.receivedAmount || 0), 0);
    const billableAmount = Number(order.billableAmount || 0);
    return {
      id: order.id,
      orderNo: order.orderNo,
      clientId: order.clientId,
      regionCode: order.regionCode,
      regionName: order.regionName,
      clientName: order.unitName,
      unitCode: order.unitCode,
      unitName: order.unitName,
      serviceYear: order.serviceYear,
      packageAmount: Number(order.packageAmount || 0),
      billableAmount,
      receivedAmount,
      unreceivedAmount: Math.max(0, billableAmount - receivedAmount),
      collectionStatus: this.resolveCollectionStatus(billableAmount, receivedAmount),
      serviceItemCount: serviceItems.length,
      serviceNames,
      contractStatus: order.contractStatus || ORDER_CONTRACT_STATUS.NOT_CREATED,
      invoiceStatus: order.invoiceStatus || ORDER_INVOICE_STATUS.NOT_ISSUED,
      attachmentCount: order.attachmentCount || 0,
      status: order.status,
      createdAt: order.orderDate,
      orderDate: order.orderDate,
      remark: order.remark,
      historicalClientMergedToClientId: mergeInfo?.targetClientId || null,
      historicalClientMergedToRegionName: mergeInfo?.targetRegionName || null,
      historicalClientMergedToUnitCode: mergeInfo?.targetUnitCode || null,
      historicalClientMergedToUnitName: mergeInfo?.targetUnitName || null,
    };
  }

  private toServiceItemRow(item: ServiceItem, warningDays: number) {
    const billableAmount = Number(item.billableAmount || 0);
    const receivedAmount = Number(item.receivedAmount || 0);
    return {
      id: item.id,
      orderId: item.orderId,
      orderNo: item.orderNo,
      clientId: item.clientId,
      regionCode: item.regionCode,
      regionName: item.regionName,
      clientName: item.unitName,
      unitCode: item.unitCode,
      unitName: item.unitName,
      serviceCode: item.serviceCode,
      serviceName: item.serviceName,
      serviceYear: item.serviceYear,
      receiverId: item.receiverId,
      receiverName: item.receiverName,
      performerId: item.performerId,
      performerName: item.performerName,
      allocatedAmount: Number(item.allocatedAmount || 0),
      billableAmount,
      receivedAmount,
      unreceivedAmount: Math.max(0, billableAmount - receivedAmount),
      collectionStatus: this.resolveCollectionStatus(billableAmount, receivedAmount),
      status: this.normalizeServiceItemStatus(item.status),
      statusUpdatedAt: item.statusUpdatedAt,
      serviceStartDate: item.serviceStartDate || null,
      serviceEndDate: item.serviceEndDate || null,
      completedAt: item.completedAt || null,
      renewalStatus: resolveRenewalStatus(item, warningDays),
      renewalStoredStatus: item.renewalStatus || null,
      renewalOfServiceItemId: item.renewalOfServiceItemId || null,
      renewedByServiceItemId: item.renewedByServiceItemId || null,
      renewalReminderDate: item.renewalReminderDate || null,
      renewalRemark: item.renewalRemark || null,
      reportSummary: item.reportSummary || null,
      problemDescription: item.problemDescription || null,
      proofUrl: item.proofUrl || null,
      remark: item.remark || null,
    };
  }

  private resolveEmployeeName(user: User) {
    return user.employeeProfile?.name || user.nickName || user.username;
  }

  private resolveCollectionStatus(billableAmount: number, receivedAmount: number) {
    if (billableAmount <= 0)
      return SERVICE_COLLECTION_STATUS.NOT_REQUIRED;
    if (receivedAmount <= 0)
      return SERVICE_COLLECTION_STATUS.PENDING;
    if (receivedAmount < billableAmount)
      return SERVICE_COLLECTION_STATUS.PARTIAL;
    return SERVICE_COLLECTION_STATUS.PAID;
  }

  private optionalText(value?: string | null) {
    const text = value?.trim();
    return text || null;
  }

  private createTodayText() {
    return new Date().toISOString().slice(0, 10);
  }
}
