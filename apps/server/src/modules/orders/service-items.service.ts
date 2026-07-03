import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { SERVICE_COLLECTION_STATUS } from '../../common/business.constants';
import { normalizePage, pageResult } from '../../common/page';
import { parseOptionalPositiveInt } from '../../common/query';
import { resolveSort } from '../../common/sort';
import { ServiceItem } from '../../entities/service-item.entity';
import { ClientsService } from '../clients/clients.service';
import { SystemParametersService } from '../system-parameters/system-parameters.service';
import { DONE_SERVICE_ITEM_STATUSES } from './order.constants';
import { resolveRenewalStatus } from './service-renewal';

@Injectable()
export class ServiceItemsService {
  constructor(
    @InjectRepository(ServiceItem) private readonly serviceItemRepository: Repository<ServiceItem>,
    private readonly clientsService: ClientsService,
    private readonly parametersService: SystemParametersService,
  ) {}

  async page(query: {
    pageNo?: number;
    pageSize?: number;
    regionCode?: string;
    clientId?: string | number;
    serviceYear?: string | number;
    serviceCode?: string;
    receiverId?: string | number;
    performerId?: string | number;
    status?: string;
    dueState?: string;
    collectionStatus?: string;
    keyword?: string;
    sortKey?: string;
    sortOrder?: string;
  }) {
    const warningDays = await this.parametersService.getServiceDueWarningDays();
    const { pageSize, skip } = normalizePage(query);
    const clientId = parseOptionalPositiveInt(query.clientId, '客户ID');
    const receiverId = parseOptionalPositiveInt(query.receiverId, '接单人ID');
    const performerId = parseOptionalPositiveInt(query.performerId, '完成人ID');
    const serviceYear = this.parseOptionalYear(query.serviceYear);
    const qb = this.serviceItemRepository
      .createQueryBuilder('item')
      .innerJoinAndSelect('item.order', 'orders')
      .skip(skip)
      .take(pageSize);
    if (query.regionCode)
      qb.andWhere('item.regionCode = :regionCode', { regionCode: query.regionCode });
    if (clientId)
      qb.andWhere('orders.clientId = :clientId', { clientId });
    if (serviceYear)
      qb.andWhere('item.serviceYear = :serviceYear', { serviceYear });
    if (query.serviceCode)
      qb.andWhere('item.serviceCode = :serviceCode', { serviceCode: query.serviceCode });
    if (receiverId)
      qb.andWhere('item.receiverId = :receiverId', { receiverId });
    if (performerId)
      qb.andWhere('item.performerId = :performerId', { performerId });
    if (query.status)
      qb.andWhere('item.status = :status', { status: query.status });
    if (query.collectionStatus === SERVICE_COLLECTION_STATUS.PENDING)
      qb.andWhere('item.billableAmount > 0').andWhere('item.receivedAmount <= 0');
    if (query.collectionStatus === SERVICE_COLLECTION_STATUS.PARTIAL)
      qb.andWhere('item.receivedAmount > 0').andWhere('item.receivedAmount < item.billableAmount');
    if (query.collectionStatus === SERVICE_COLLECTION_STATUS.PAID)
      qb.andWhere('item.billableAmount > 0').andWhere('item.receivedAmount >= item.billableAmount');
    if (query.collectionStatus === SERVICE_COLLECTION_STATUS.NOT_REQUIRED)
      qb.andWhere('item.billableAmount <= 0');
    if (query.dueState === 'overdue') {
      qb.andWhere('item.serviceEndDate IS NOT NULL')
        .andWhere('item.serviceEndDate < CURRENT_DATE()')
        .andWhere('item.status NOT IN (:...doneStatuses)', { doneStatuses: [...DONE_SERVICE_ITEM_STATUSES] });
    }
    if (query.dueState === 'dueSoon') {
      qb.andWhere('item.serviceEndDate IS NOT NULL')
        .andWhere('item.serviceEndDate >= CURRENT_DATE()')
        .andWhere(`item.serviceEndDate <= DATE_ADD(CURRENT_DATE(), INTERVAL ${warningDays} DAY)`)
        .andWhere('item.status NOT IN (:...doneStatuses)', { doneStatuses: [...DONE_SERVICE_ITEM_STATUSES] });
    }
    if (query.keyword?.trim()) {
      const keyword = `%${query.keyword.trim()}%`;
      qb.andWhere(new Brackets((where) => {
        where.where('item.orderNo LIKE :keyword', { keyword })
          .orWhere('item.unitName LIKE :keyword', { keyword })
          .orWhere('item.unitCode LIKE :keyword', { keyword })
          .orWhere('item.serviceName LIKE :keyword', { keyword })
          .orWhere('item.receiverName LIKE :keyword', { keyword })
          .orWhere('item.performerName LIKE :keyword', { keyword })
          .orWhere('item.remark LIKE :keyword', { keyword })
          .orWhere('item.reportSummary LIKE :keyword', { keyword })
          .orWhere('item.problemDescription LIKE :keyword', { keyword });
      }));
    }
    const sort = resolveSort(query.sortKey, query.sortOrder, {
      orderNo: 'item.orderNo',
      orderDate: 'orders.orderDate',
      serviceYear: 'item.serviceYear',
      regionName: 'item.regionName',
      clientName: 'item.unitName',
      unitName: 'item.unitName',
      unitCode: 'item.unitCode',
      serviceName: 'item.serviceName',
      receiverName: 'item.receiverName',
      performerName: 'item.performerName',
      serviceStartDate: 'item.serviceStartDate',
      serviceEndDate: 'item.serviceEndDate',
      allocatedAmount: 'item.allocatedAmount',
      billableAmount: 'item.billableAmount',
      receivedAmount: 'item.receivedAmount',
      status: 'item.status',
      completedAt: 'item.completedAt',
      updateTime: 'item.updateTime',
    });
    if (sort)
      qb.orderBy(sort.column, sort.direction).addOrderBy('item.id', 'DESC');
    else
      qb.orderBy('item.id', 'DESC');
    const [items, total] = await qb.getManyAndCount();
    const mergeInfos = await this.clientsService.snapshotMergeInfo(items);
    return pageResult(items.map((item, index) => this.toServiceItemRow(item, warningDays, mergeInfos[index])), total);
  }

  private toServiceItemRow(item: ServiceItem, warningDays: number, mergeInfo: {
    sourceClientId: number;
    targetClientId: number;
    targetRegionName: string;
    targetUnitCode: string;
    targetUnitName: string;
  } | null = null) {
    const billableAmount = Number(item.billableAmount || 0);
    const receivedAmount = Number(item.receivedAmount || 0);
    return {
      ...item,
      clientName: item.unitName,
      orderDate: item.order.orderDate,
      allocatedAmount: Number(item.allocatedAmount || 0),
      billableAmount,
      receivedAmount,
      unreceivedAmount: Math.max(0, billableAmount - receivedAmount),
      collectionStatus: this.resolveCollectionStatus(billableAmount, receivedAmount),
      completedAt: item.completedAt || null,
      reportSummary: item.reportSummary || null,
      problemDescription: item.problemDescription || null,
      proofUrl: item.proofUrl || null,
      renewalStatus: resolveRenewalStatus(item, warningDays),
      renewalStoredStatus: item.renewalStatus || null,
      renewalOfServiceItemId: item.renewalOfServiceItemId || null,
      renewedByServiceItemId: item.renewedByServiceItemId || null,
      renewalReminderDate: item.renewalReminderDate || null,
      renewalRemark: item.renewalRemark || null,
      historicalClientMergedToClientId: mergeInfo?.targetClientId || null,
      historicalClientMergedToRegionName: mergeInfo?.targetRegionName || null,
      historicalClientMergedToUnitCode: mergeInfo?.targetUnitCode || null,
      historicalClientMergedToUnitName: mergeInfo?.targetUnitName || null,
    };
  }

  private parseOptionalYear(value?: string | number) {
    if (value === undefined || value === null || value === '')
      return null;
    const year = Number(value);
    if (!Number.isInteger(year) || year < 2000)
      throw new BadRequestException('服务年度无效');
    return year;
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
}
