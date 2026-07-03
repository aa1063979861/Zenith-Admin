import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, Repository } from 'typeorm';
import { COMMISSION_ITEM_SETTLEMENT_STATUS, COMMISSION_SETTLEMENT_STATUS, COMMISSION_SETTLEMENT_STATUSES, CommissionSettlementStatus } from '../../common/business.constants';
import { normalizePage, pageResult } from '../../common/page';
import { parseOptionalBooleanFlag, parseOptionalPositiveInt, parseOptionalStringIn } from '../../common/query';
import { resolveSort } from '../../common/sort';
import { CommissionLine } from '../../entities/commission-line.entity';
import { CommissionBaseType, CommissionRoleType, CommissionRule } from '../../entities/commission-rule.entity';
import { CommissionSettlement } from '../../entities/commission-settlement.entity';
import { ServiceItem } from '../../entities/service-item.entity';
import { ServiceCatalogService } from '../service-catalog/service-catalog.service';
import { CreateCommissionRuleDto } from './dto/create-commission-rule.dto';
import { GenerateCommissionDraftDto } from './dto/generate-commission-draft.dto';
import { UpdateCommissionRuleDto } from './dto/update-commission-rule.dto';

type CommissionQuery = {
  pageNo?: number;
  pageSize?: number;
  keyword?: string;
  enabled?: string;
  roleType?: CommissionRoleType;
  baseType?: CommissionBaseType;
  status?: CommissionSettlementStatus;
  employeeId?: string | number;
  settlementId?: string | number;
  serviceYear?: string | number;
  serviceCode?: string;
  periodStart?: string;
  periodEnd?: string;
  sortKey?: string;
  sortOrder?: string;
};

type DraftScope = {
  periodStart: string;
  periodEnd: string;
  serviceYear: number | null;
  serviceCode: string | null;
  serviceName: string | null;
  employeeIds: number[];
};

type DraftLine = Omit<CommissionLine, 'id' | 'createTime' | 'updateTime' | 'deleteTime' | 'settlement' | 'serviceItem'>;

const ROLE_TYPES: CommissionRoleType[] = ['receiver', 'performer'];
const BASE_TYPES: CommissionBaseType[] = ['received_amount', 'billable_amount', 'allocated_amount'];
const SETTLEMENT_STATUSES: readonly CommissionSettlementStatus[] = COMMISSION_SETTLEMENT_STATUSES;
const SETTLED_SETTLEMENT_STATUSES: readonly CommissionSettlementStatus[] = [COMMISSION_SETTLEMENT_STATUS.CONFIRMED, COMMISSION_SETTLEMENT_STATUS.PAID];

const roleTypeLabels: Record<CommissionRoleType, string> = {
  receiver: '接单',
  performer: '完成',
};

const baseTypeLabels: Record<CommissionBaseType, string> = {
  received_amount: '已收金额',
  billable_amount: '应收金额',
  allocated_amount: '分摊金额',
};

const settlementStatusLabels: Record<CommissionSettlementStatus, string> = {
  [COMMISSION_SETTLEMENT_STATUS.DRAFT]: '草稿',
  [COMMISSION_SETTLEMENT_STATUS.CONFIRMED]: '已确认',
  [COMMISSION_SETTLEMENT_STATUS.PAID]: '已发放',
  [COMMISSION_SETTLEMENT_STATUS.CANCELLED]: '已取消',
};

@Injectable()
export class CommissionService {
  constructor(
    @InjectRepository(CommissionRule) private readonly ruleRepository: Repository<CommissionRule>,
    @InjectRepository(CommissionSettlement) private readonly settlementRepository: Repository<CommissionSettlement>,
    @InjectRepository(CommissionLine) private readonly lineRepository: Repository<CommissionLine>,
    @InjectRepository(ServiceItem) private readonly serviceItemRepository: Repository<ServiceItem>,
    private readonly serviceCatalogService: ServiceCatalogService,
    private readonly dataSource: DataSource,
  ) {}

  async rules(query: CommissionQuery) {
    const { pageSize, skip } = normalizePage(query);
    const enabled = parseOptionalBooleanFlag(query.enabled, '启用状态');
    const roleType = parseOptionalStringIn(query.roleType, '提成角色', ROLE_TYPES);
    const baseType = parseOptionalStringIn(query.baseType, '提成基数', BASE_TYPES);
    const qb = this.ruleRepository
      .createQueryBuilder('rule')
      .skip(skip)
      .take(pageSize);

    if (enabled !== null)
      qb.andWhere('rule.enabled = :enabled', { enabled });
    if (roleType)
      qb.andWhere('rule.roleType = :roleType', { roleType });
    if (baseType)
      qb.andWhere('rule.baseType = :baseType', { baseType });
    if (query.serviceCode)
      qb.andWhere('rule.serviceCode = :serviceCode', { serviceCode: query.serviceCode });
    if (query.keyword) {
      qb.andWhere(new Brackets((builder) => {
        builder
          .where('rule.title LIKE :keyword', { keyword: `%${query.keyword}%` })
          .orWhere('rule.serviceName LIKE :keyword', { keyword: `%${query.keyword}%` })
          .orWhere('rule.note LIKE :keyword', { keyword: `%${query.keyword}%` });
      }));
    }
    const sort = resolveSort(query.sortKey, query.sortOrder, {
      title: 'rule.title',
      roleTypeLabel: 'rule.roleType',
      serviceName: 'rule.serviceName',
      baseTypeLabel: 'rule.baseType',
      ratePercent: 'rule.rate',
      fixedAmount: 'rule.fixedAmount',
      effectiveFrom: 'rule.effectiveFrom',
      effectiveTo: 'rule.effectiveTo',
      sort: 'rule.sort',
      enabled: 'rule.enabled',
      createTime: 'rule.createTime',
      updateTime: 'rule.updateTime',
    });
    if (sort)
      qb.orderBy(sort.column, sort.direction).addOrderBy('rule.id', 'ASC');
    else
      qb.orderBy('rule.sort', 'ASC').addOrderBy('rule.id', 'ASC');

    const [rows, total] = await qb.getManyAndCount();
    return pageResult(rows.map(row => this.toRuleRow(row)), total);
  }

  async createRule(dto: CreateCommissionRuleDto) {
    const patch = await this.resolveRulePatch(dto, true);
    const rule = this.ruleRepository.create(patch);
    return this.toRuleRow(await this.ruleRepository.save(rule));
  }

  async updateRule(id: number, dto: UpdateCommissionRuleDto) {
    const rule = await this.findRule(id);
    const patch = await this.resolveRulePatch(dto, false, rule);
    Object.assign(rule, patch);
    return this.toRuleRow(await this.ruleRepository.save(rule));
  }

  async deleteRule(id: number) {
    const rule = await this.findRule(id);
    await this.ruleRepository.softRemove(rule);
    return true;
  }

  async settlementItems(query: CommissionQuery) {
    const { pageSize, skip } = normalizePage(query);
    const serviceYear = parseOptionalPositiveInt(query.serviceYear, '服务年度');
    const qb = this.serviceItemRepository
      .createQueryBuilder('item')
      .skip(skip)
      .take(pageSize);

    if (serviceYear)
      qb.andWhere('item.serviceYear = :serviceYear', { serviceYear });
    if (query.serviceCode)
      qb.andWhere('item.serviceCode = :serviceCode', { serviceCode: query.serviceCode });
    if (query.keyword) {
      qb.andWhere(new Brackets((builder) => {
        builder
          .where('item.orderNo LIKE :keyword', { keyword: `%${query.keyword}%` })
          .orWhere('item.unitName LIKE :keyword', { keyword: `%${query.keyword}%` })
          .orWhere('item.serviceName LIKE :keyword', { keyword: `%${query.keyword}%` })
          .orWhere('item.receiverName LIKE :keyword', { keyword: `%${query.keyword}%` })
          .orWhere('item.performerName LIKE :keyword', { keyword: `%${query.keyword}%` });
      }));
    }
    const sort = resolveSort(query.sortKey, query.sortOrder, {
      orderNo: 'item.orderNo',
      serviceYear: 'item.serviceYear',
      regionName: 'item.regionName',
      clientName: 'item.unitName',
      unitCode: 'item.unitCode',
      serviceName: 'item.serviceName',
      receiverName: 'item.receiverName',
      performerName: 'item.performerName',
      allocatedAmount: 'item.allocatedAmount',
      billableAmount: 'item.billableAmount',
      receivedAmount: 'item.receivedAmount',
    });
    if (sort)
      qb.orderBy(sort.column, sort.direction).addOrderBy('item.id', 'DESC');
    else
      qb.orderBy('item.id', 'DESC');

    const [rows, total] = await qb.getManyAndCount();
    const settledCommission = await this.loadSettledCommissionByItem(rows.map(item => item.id));
    return pageResult(rows.map(item => this.toSettlementItemRow(item, settledCommission.get(item.id) || 0)), total);
  }

  async settlements(query: CommissionQuery) {
    const { pageSize, skip } = normalizePage(query);
    const status = parseOptionalStringIn(query.status, '结算状态', SETTLEMENT_STATUSES);
    const employeeId = parseOptionalPositiveInt(query.employeeId, '员工ID');
    const serviceYear = parseOptionalPositiveInt(query.serviceYear, '服务年度');
    const qb = this.settlementRepository
      .createQueryBuilder('settlement')
      .loadRelationCountAndMap('settlement.lineCount', 'settlement.lines')
      .skip(skip)
      .take(pageSize);

    if (status)
      qb.andWhere('settlement.status = :status', { status });
    if (employeeId)
      qb.andWhere('settlement.employeeId = :employeeId', { employeeId });
    if (serviceYear)
      qb.andWhere('settlement.serviceYear = :serviceYear', { serviceYear });
    if (query.serviceCode)
      qb.andWhere('settlement.serviceCode = :serviceCode', { serviceCode: query.serviceCode });
    if (query.periodStart)
      qb.andWhere('settlement.periodEnd >= :periodStart', { periodStart: query.periodStart });
    if (query.periodEnd)
      qb.andWhere('settlement.periodStart <= :periodEnd', { periodEnd: query.periodEnd });
    if (query.keyword) {
      qb.andWhere(new Brackets((builder) => {
        builder
          .where('settlement.employeeName LIKE :keyword', { keyword: `%${query.keyword}%` })
          .orWhere('settlement.serviceName LIKE :keyword', { keyword: `%${query.keyword}%` });
      }));
    }
    const sort = resolveSort(query.sortKey, query.sortOrder, {
      employeeName: 'settlement.employeeName',
      period: 'settlement.periodEnd',
      serviceYear: 'settlement.serviceYear',
      serviceName: 'settlement.serviceName',
      totalAmount: 'settlement.totalAmount',
      statusLabel: 'settlement.status',
      confirmedAt: 'settlement.confirmedAt',
      createTime: 'settlement.createTime',
      updateTime: 'settlement.updateTime',
    });
    if (sort)
      qb.orderBy(sort.column, sort.direction).addOrderBy('settlement.id', 'DESC');
    else
      qb.orderBy('settlement.periodEnd', 'DESC').addOrderBy('settlement.id', 'DESC');

    const [rows, total] = await qb.getManyAndCount();
    return pageResult(rows.map(row => this.toSettlementRow(row)), total);
  }

  async settlementDetail(id: number) {
    const settlement = await this.findSettlement(id);
    const lines = await this.lineRepository.find({
      where: { settlementId: settlement.id },
      order: { employeeName: 'ASC', id: 'ASC' },
    });
    return {
      ...this.toSettlementRow(settlement),
      lines: lines.map(line => this.toLineRow(line)),
    };
  }

  async lines(query: CommissionQuery) {
    const { pageSize, skip } = normalizePage(query);
    const settlementId = parseOptionalPositiveInt(query.settlementId, '结算单ID');
    const employeeId = parseOptionalPositiveInt(query.employeeId, '员工ID');
    const serviceYear = parseOptionalPositiveInt(query.serviceYear, '服务年度');
    const qb = this.lineRepository
      .createQueryBuilder('line')
      .skip(skip)
      .take(pageSize);

    if (settlementId)
      qb.andWhere('line.settlementId = :settlementId', { settlementId });
    if (employeeId)
      qb.andWhere('line.employeeId = :employeeId', { employeeId });
    if (serviceYear)
      qb.andWhere('line.serviceYear = :serviceYear', { serviceYear });
    if (query.serviceCode)
      qb.andWhere('line.serviceCode = :serviceCode', { serviceCode: query.serviceCode });
    if (query.keyword) {
      qb.andWhere(new Brackets((builder) => {
        builder
          .where('line.employeeName LIKE :keyword', { keyword: `%${query.keyword}%` })
          .orWhere('line.orderNo LIKE :keyword', { keyword: `%${query.keyword}%` })
          .orWhere('line.clientName LIKE :keyword', { keyword: `%${query.keyword}%` })
          .orWhere('line.serviceName LIKE :keyword', { keyword: `%${query.keyword}%` });
      }));
    }
    const sort = resolveSort(query.sortKey, query.sortOrder, {
      employeeName: 'line.employeeName',
      roleTypeLabel: 'line.roleType',
      orderNo: 'line.orderNo',
      serviceYear: 'line.serviceYear',
      regionName: 'line.regionName',
      clientName: 'line.clientName',
      unitCode: 'line.unitCode',
      serviceName: 'line.serviceName',
      ruleTitle: 'line.ruleTitle',
      baseTypeLabel: 'line.baseType',
      baseAmount: 'line.baseAmount',
      ratePercent: 'line.rate',
      fixedAmount: 'line.fixedAmount',
      commissionAmount: 'line.commissionAmount',
      createTime: 'line.createTime',
    });
    if (sort)
      qb.orderBy(sort.column, sort.direction).addOrderBy('line.id', 'DESC');
    else
      qb.orderBy('line.id', 'DESC');

    const [rows, total] = await qb.getManyAndCount();
    return pageResult(rows.map(row => this.toLineRow(row)), total);
  }

  async generateDraft(dto: GenerateCommissionDraftDto) {
    const scope = await this.resolveDraftScope(dto);
    return this.generateDraftByScope(scope);
  }

  async recalculateSettlement(id: number) {
    const settlement = await this.findSettlement(id);
    if (settlement.status !== COMMISSION_SETTLEMENT_STATUS.DRAFT)
      throw new BadRequestException('只有草稿结算单可以重算');
    return this.generateDraftByScope({
      periodStart: settlement.periodStart,
      periodEnd: settlement.periodEnd,
      serviceYear: settlement.serviceYear || null,
      serviceCode: settlement.serviceCode || null,
      serviceName: settlement.serviceName || null,
      employeeIds: [settlement.employeeId],
    });
  }

  async confirmSettlement(id: number, userId: number) {
    const settlement = await this.findSettlement(id);
    if (settlement.status !== COMMISSION_SETTLEMENT_STATUS.DRAFT)
      throw new BadRequestException('只有草稿结算单可以确认');
    if (Number(settlement.totalAmount || 0) <= 0)
      throw new BadRequestException('提成合计为0，不能确认');
    settlement.status = COMMISSION_SETTLEMENT_STATUS.CONFIRMED;
    settlement.confirmedBy = userId;
    settlement.confirmedAt = new Date();
    return this.toSettlementRow(await this.settlementRepository.save(settlement));
  }

  async markPaid(id: number) {
    const settlement = await this.findSettlement(id);
    if (settlement.status !== COMMISSION_SETTLEMENT_STATUS.CONFIRMED)
      throw new BadRequestException('只有已确认结算单可以标记发放');
    settlement.status = COMMISSION_SETTLEMENT_STATUS.PAID;
    settlement.paidAt = new Date();
    return this.toSettlementRow(await this.settlementRepository.save(settlement));
  }

  async cancelSettlement(id: number) {
    const settlement = await this.findSettlement(id);
    if (settlement.status === COMMISSION_SETTLEMENT_STATUS.PAID)
      throw new BadRequestException('已发放结算单不能取消');
    if (settlement.status === COMMISSION_SETTLEMENT_STATUS.CANCELLED)
      return this.toSettlementRow(settlement);
    settlement.status = COMMISSION_SETTLEMENT_STATUS.CANCELLED;
    settlement.cancelledAt = new Date();
    return this.toSettlementRow(await this.settlementRepository.save(settlement));
  }

  private async generateDraftByScope(scope: DraftScope) {
    const rules = await this.loadActiveRules(scope.periodStart, scope.periodEnd);
    if (!rules.length)
      throw new BadRequestException('没有启用且生效的提成规则');

    return this.dataSource.transaction(async (manager) => {
      const itemRepository = manager.getRepository(ServiceItem);
      const settlementRepository = manager.getRepository(CommissionSettlement);
      const lineRepository = manager.getRepository(CommissionLine);

      const items = await this.loadDraftServiceItems(itemRepository, scope);
      const settled = await this.loadSettledBaseMaps(lineRepository, items.map(item => item.id));
      const linesByEmployee = new Map<number, DraftLine[]>();

      for (const item of items) {
        for (const roleType of ROLE_TYPES) {
          const employee = this.resolveLineEmployee(item, roleType);
          if (scope.employeeIds.length && !scope.employeeIds.includes(employee.employeeId))
            continue;

          const rule = this.resolveRule(item, roleType, rules);
          if (!rule)
            continue;

          const baseAmount = this.money(this.resolveBaseAmount(item, rule.baseType));
          const baseKey = this.baseSettlementKey(item.id, roleType, rule.baseType);
          const roleKey = this.roleSettlementKey(item.id, roleType);
          const remainingBase = this.money(baseAmount - (settled.baseByKey.get(baseKey) || 0));
          const fixedAmount = settled.roleKeys.has(roleKey) ? 0 : Number(rule.fixedAmount || 0);
          if (remainingBase <= 0 && fixedAmount <= 0)
            continue;

          const commissionAmount = this.money(remainingBase * Number(rule.rate || 0) + fixedAmount);
          if (commissionAmount <= 0)
            continue;

          const draftLine = this.createDraftLine(item, rule, roleType, employee.employeeId, employee.employeeName, remainingBase, fixedAmount, commissionAmount);
          const employeeLines = linesByEmployee.get(employee.employeeId) || [];
          employeeLines.push(draftLine);
          linesByEmployee.set(employee.employeeId, employeeLines);
        }
      }

      await this.clearDraftSettlements(settlementRepository, lineRepository, scope);

      const settlements: CommissionSettlement[] = [];
      let lineCount = 0;
      let totalAmount = 0;
      for (const [employeeId, lines] of linesByEmployee.entries()) {
        const employeeName = lines[0]?.employeeName;
        const settlementTotal = this.money(lines.reduce((sum, line) => sum + Number(line.commissionAmount || 0), 0));
        const settlement = await settlementRepository.save(settlementRepository.create({
          employeeId,
          employeeName,
          serviceYear: scope.serviceYear,
          serviceCode: scope.serviceCode,
          serviceName: scope.serviceName,
          periodStart: scope.periodStart,
          periodEnd: scope.periodEnd,
          totalAmount: String(settlementTotal),
          status: COMMISSION_SETTLEMENT_STATUS.DRAFT,
        }));
        await lineRepository.save(lines.map(line => lineRepository.create({ ...line, settlementId: settlement.id })));
        settlements.push(settlement);
        lineCount += lines.length;
        totalAmount = this.money(totalAmount + settlementTotal);
      }

      return {
        settlementCount: settlements.length,
        lineCount,
        totalAmount,
        settlements: settlements.map(settlement => this.toSettlementRow(settlement)),
      };
    });
  }

  private async resolveRulePatch(dto: CreateCommissionRuleDto | UpdateCommissionRuleDto, creating: boolean, current?: CommissionRule) {
    const title = this.hasOwn(dto, 'title') ? dto.title?.trim() : current?.title;
    if (!title)
      throw new BadRequestException('规则名称不能为空');

    const roleType = this.hasOwn(dto, 'roleType') ? dto.roleType : current?.roleType;
    const baseType = this.hasOwn(dto, 'baseType') ? dto.baseType : current?.baseType;
    if (!roleType || !ROLE_TYPES.includes(roleType))
      throw new BadRequestException('提成角色取值无效');
    if (!baseType || !BASE_TYPES.includes(baseType))
      throw new BadRequestException('提成基数取值无效');

    const rate = this.hasOwn(dto, 'rate') ? Number(dto.rate || 0) : Number(current?.rate || 0);
    const fixedAmount = this.hasOwn(dto, 'fixedAmount') ? Number(dto.fixedAmount || 0) : Number(current?.fixedAmount || 0);
    this.assertRuleAmount(rate, fixedAmount);

    const effectiveFrom = this.hasOwn(dto, 'effectiveFrom') ? dto.effectiveFrom || null : current?.effectiveFrom || null;
    const effectiveTo = this.hasOwn(dto, 'effectiveTo') ? dto.effectiveTo || null : current?.effectiveTo || null;
    this.assertDateRange(effectiveFrom, effectiveTo, '规则生效日期');

    const service = this.hasOwn(dto, 'serviceCode')
      ? await this.resolveService(dto.serviceCode)
      : { serviceCode: current?.serviceCode || null, serviceName: current?.serviceName || null };

    return {
      title,
      roleType,
      serviceCode: service.serviceCode,
      serviceName: service.serviceName,
      baseType,
      rate: String(this.rate(rate)),
      fixedAmount: String(this.money(fixedAmount)),
      effectiveFrom,
      effectiveTo,
      note: this.hasOwn(dto, 'note') ? dto.note?.trim() || null : current?.note || null,
      enabled: this.hasOwn(dto, 'enabled') ? dto.enabled !== false : (current?.enabled ?? true),
      sort: this.hasOwn(dto, 'sort') ? Number(dto.sort || 0) : (creating ? 0 : current?.sort || 0),
    };
  }

  private async resolveDraftScope(dto: GenerateCommissionDraftDto): Promise<DraftScope> {
    this.assertDateRange(dto.periodStart, dto.periodEnd, '结算周期');
    const service = await this.resolveService(dto.serviceCode);
    const employeeIds = [...new Set((dto.employeeIds || []).map(id => Number(id)).filter(id => Number.isInteger(id) && id > 0))];
    return {
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      serviceYear: dto.serviceYear || null,
      serviceCode: service.serviceCode,
      serviceName: service.serviceName,
      employeeIds,
    };
  }

  private async resolveService(serviceCode?: string | null) {
    const code = serviceCode?.trim();
    if (!code)
      return { serviceCode: null, serviceName: null };
    const service = await this.serviceCatalogService.findEnabledByCodeOrName(code);
    if (!service)
      throw new BadRequestException('服务项不存在或已停用');
    return { serviceCode: service.code, serviceName: service.name };
  }

  private async loadActiveRules(periodStart: string, periodEnd: string) {
    const rules = await this.ruleRepository.find({
      where: { enabled: true },
      order: { sort: 'ASC', id: 'ASC' },
    });
    return rules.filter(rule =>
      (!rule.effectiveFrom || rule.effectiveFrom <= periodEnd)
      && (!rule.effectiveTo || rule.effectiveTo >= periodStart),
    );
  }

  private async loadDraftServiceItems(repository: Repository<ServiceItem>, scope: DraftScope) {
    const qb = repository
      .createQueryBuilder('item')
      .orderBy('item.id', 'ASC');

    if (scope.serviceYear)
      qb.andWhere('item.serviceYear = :serviceYear', { serviceYear: scope.serviceYear });
    if (scope.serviceCode)
      qb.andWhere('item.serviceCode = :serviceCode', { serviceCode: scope.serviceCode });
    if (scope.employeeIds.length) {
      qb.andWhere('(item.receiverId IN (:...employeeIds) OR item.performerId IN (:...employeeIds))', {
        employeeIds: scope.employeeIds,
      });
    }

    return qb.getMany();
  }

  private async clearDraftSettlements(
    settlementRepository: Repository<CommissionSettlement>,
    lineRepository: Repository<CommissionLine>,
    scope: DraftScope,
  ) {
    const qb = settlementRepository
      .createQueryBuilder('settlement')
      .where('settlement.status = :status', { status: COMMISSION_SETTLEMENT_STATUS.DRAFT })
      .andWhere('settlement.periodStart = :periodStart', { periodStart: scope.periodStart })
      .andWhere('settlement.periodEnd = :periodEnd', { periodEnd: scope.periodEnd });

    if (scope.serviceYear)
      qb.andWhere('settlement.serviceYear = :serviceYear', { serviceYear: scope.serviceYear });
    else
      qb.andWhere('settlement.serviceYear IS NULL');

    if (scope.serviceCode)
      qb.andWhere('settlement.serviceCode = :serviceCode', { serviceCode: scope.serviceCode });
    else
      qb.andWhere('settlement.serviceCode IS NULL');

    if (scope.employeeIds.length)
      qb.andWhere('settlement.employeeId IN (:...employeeIds)', { employeeIds: scope.employeeIds });

    const staleSettlements = await qb.getMany();
    const staleIds = staleSettlements.map(settlement => settlement.id);
    if (!staleIds.length)
      return;
    await lineRepository.softDelete({ settlementId: In(staleIds) });
    await settlementRepository.softDelete(staleIds);
  }

  private async loadSettledBaseMaps(repository: Repository<CommissionLine>, serviceItemIds: number[]) {
    const baseByKey = new Map<string, number>();
    const roleKeys = new Set<string>();
    if (!serviceItemIds.length)
      return { baseByKey, roleKeys };

    const lines = await repository
      .createQueryBuilder('line')
      .innerJoin('line.settlement', 'settlement')
      .where('line.orderServiceItemId IN (:...serviceItemIds)', { serviceItemIds })
      .andWhere('settlement.status IN (:...statuses)', { statuses: [...SETTLED_SETTLEMENT_STATUSES] })
      .getMany();

    for (const line of lines) {
      const baseKey = this.baseSettlementKey(line.orderServiceItemId, line.roleType, line.baseType);
      const roleKey = this.roleSettlementKey(line.orderServiceItemId, line.roleType);
      baseByKey.set(baseKey, this.money((baseByKey.get(baseKey) || 0) + Number(line.baseAmount || 0)));
      roleKeys.add(roleKey);
    }
    return { baseByKey, roleKeys };
  }

  private async loadSettledCommissionByItem(serviceItemIds: number[]) {
    const map = new Map<number, number>();
    if (!serviceItemIds.length)
      return map;

    const lines = await this.lineRepository
      .createQueryBuilder('line')
      .innerJoin('line.settlement', 'settlement')
      .where('line.orderServiceItemId IN (:...serviceItemIds)', { serviceItemIds })
      .andWhere('settlement.status IN (:...statuses)', { statuses: [...SETTLED_SETTLEMENT_STATUSES] })
      .getMany();
    for (const line of lines)
      map.set(line.orderServiceItemId, this.money((map.get(line.orderServiceItemId) || 0) + Number(line.commissionAmount || 0)));
    return map;
  }

  private resolveRule(item: ServiceItem, roleType: CommissionRoleType, rules: CommissionRule[]) {
    const matches = rules.filter(rule =>
      rule.roleType === roleType
      && (!rule.serviceCode || rule.serviceCode === item.serviceCode),
    );
    return matches.sort((left, right) => {
      const leftSpecific = left.serviceCode ? 1 : 0;
      const rightSpecific = right.serviceCode ? 1 : 0;
      return rightSpecific - leftSpecific || left.sort - right.sort || left.id - right.id;
    })[0] || null;
  }

  private resolveLineEmployee(item: ServiceItem, roleType: CommissionRoleType) {
    if (roleType === 'receiver')
      return { employeeId: item.receiverId, employeeName: item.receiverName };
    return { employeeId: item.performerId, employeeName: item.performerName };
  }

  private resolveBaseAmount(item: ServiceItem, baseType: CommissionBaseType) {
    if (baseType === 'billable_amount')
      return Number(item.billableAmount || 0);
    if (baseType === 'allocated_amount')
      return Number(item.allocatedAmount || 0);
    return Number(item.receivedAmount || 0);
  }

  private createDraftLine(
    item: ServiceItem,
    rule: CommissionRule,
    roleType: CommissionRoleType,
    employeeId: number,
    employeeName: string,
    baseAmount: number,
    fixedAmount: number,
    commissionAmount: number,
  ): DraftLine {
    return {
      settlementId: 0,
      orderServiceItemId: item.id,
      paymentServiceAllocationId: null,
      employeeId,
      employeeName,
      roleType,
      ruleId: rule.id,
      ruleTitle: rule.title,
      baseType: rule.baseType,
      orderNo: item.orderNo,
      serviceYear: item.serviceYear,
      regionName: item.regionName,
      unitCode: item.unitCode,
      clientName: item.unitName,
      serviceCode: item.serviceCode,
      serviceName: item.serviceName,
      baseAmount: String(baseAmount),
      rate: String(this.rate(Number(rule.rate || 0))),
      fixedAmount: String(this.money(fixedAmount)),
      commissionAmount: String(commissionAmount),
    };
  }

  private async findRule(id: number) {
    if (!Number.isInteger(id) || id <= 0)
      throw new BadRequestException('规则ID必须是正整数');
    const rule = await this.ruleRepository.findOne({ where: { id } });
    if (!rule)
      throw new NotFoundException('提成规则不存在');
    return rule;
  }

  private async findSettlement(id: number) {
    if (!Number.isInteger(id) || id <= 0)
      throw new BadRequestException('结算单ID必须是正整数');
    const settlement = await this.settlementRepository.findOne({ where: { id } });
    if (!settlement)
      throw new NotFoundException('提成结算单不存在');
    return settlement;
  }

  private assertRuleAmount(rate: number, fixedAmount: number) {
    if (!Number.isFinite(rate) || rate < 0 || rate > 1)
      throw new BadRequestException('提成比例必须在0到1之间');
    if (!Number.isFinite(fixedAmount) || fixedAmount < 0)
      throw new BadRequestException('固定提成不能小于0');
    if (rate <= 0 && fixedAmount <= 0)
      throw new BadRequestException('提成比例和固定提成不能同时为0');
  }

  private assertDateRange(start: string | null | undefined, end: string | null | undefined, label: string) {
    if (start && end && start > end)
      throw new BadRequestException(`${label}开始日期不能晚于结束日期`);
  }

  private money(value: number) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  private rate(value: number) {
    return Math.round((Number(value) || 0) * 1000000) / 1000000;
  }

  private hasOwn<T extends object>(target: T, key: keyof T) {
    return Object.prototype.hasOwnProperty.call(target, key);
  }

  private baseSettlementKey(serviceItemId: number, roleType: CommissionRoleType, baseType: CommissionBaseType) {
    return `${serviceItemId}:${roleType}:${baseType}`;
  }

  private roleSettlementKey(serviceItemId: number, roleType: CommissionRoleType) {
    return `${serviceItemId}:${roleType}`;
  }

  private toRuleRow(row: CommissionRule) {
    return {
      id: row.id,
      title: row.title,
      roleType: row.roleType,
      roleTypeLabel: roleTypeLabels[row.roleType],
      serviceCode: row.serviceCode,
      serviceName: row.serviceName || '全部服务项',
      baseType: row.baseType,
      baseTypeLabel: baseTypeLabels[row.baseType],
      rate: Number(row.rate || 0),
      ratePercent: this.money(Number(row.rate || 0) * 100),
      fixedAmount: Number(row.fixedAmount || 0),
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
      note: row.note,
      enabled: row.enabled,
      sort: row.sort,
      createTime: row.createTime,
      updateTime: row.updateTime,
    };
  }

  private toSettlementItemRow(item: ServiceItem, settledCommission: number) {
    const receivedAmount = Number(item.receivedAmount || 0);
    return {
      id: item.id,
      orderNo: item.orderNo,
      serviceYear: item.serviceYear,
      regionName: item.regionName,
      unitCode: item.unitCode,
      clientName: item.unitName,
      serviceCode: item.serviceCode,
      serviceName: item.serviceName,
      receiverId: item.receiverId,
      receiverName: item.receiverName,
      performerId: item.performerId,
      performerName: item.performerName,
      allocatedAmount: Number(item.allocatedAmount || 0),
      billableAmount: Number(item.billableAmount || 0),
      receivedAmount,
      settledCommission,
      commissionBase: receivedAmount,
      serviceStartDate: item.serviceStartDate,
      serviceEndDate: item.serviceEndDate,
      status: item.status,
      remark: item.remark,
      settlementStatus: receivedAmount <= 0
        ? COMMISSION_ITEM_SETTLEMENT_STATUS.PENDING_COLLECTION
        : (settledCommission > 0 ? COMMISSION_ITEM_SETTLEMENT_STATUS.SETTLED : COMMISSION_ITEM_SETTLEMENT_STATUS.SETTLEABLE),
    };
  }

  private toSettlementRow(row: CommissionSettlement) {
    const rowWithCount = row as CommissionSettlement & { lineCount?: number };
    return {
      id: row.id,
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      serviceYear: row.serviceYear,
      serviceCode: row.serviceCode,
      serviceName: row.serviceName || '全部服务项',
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      totalAmount: Number(row.totalAmount || 0),
      status: row.status,
      statusLabel: settlementStatusLabels[row.status],
      confirmedBy: row.confirmedBy,
      confirmedAt: row.confirmedAt,
      paidAt: row.paidAt,
      cancelledAt: row.cancelledAt,
      lineCount: rowWithCount.lineCount || 0,
      createTime: row.createTime,
      updateTime: row.updateTime,
    };
  }

  private toLineRow(row: CommissionLine) {
    return {
      id: row.id,
      settlementId: row.settlementId,
      orderServiceItemId: row.orderServiceItemId,
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      roleType: row.roleType,
      roleTypeLabel: roleTypeLabels[row.roleType],
      ruleId: row.ruleId,
      ruleTitle: row.ruleTitle,
      baseType: row.baseType,
      baseTypeLabel: baseTypeLabels[row.baseType],
      orderNo: row.orderNo,
      serviceYear: row.serviceYear,
      regionName: row.regionName,
      unitCode: row.unitCode,
      clientName: row.clientName,
      serviceCode: row.serviceCode,
      serviceName: row.serviceName,
      baseAmount: Number(row.baseAmount || 0),
      rate: Number(row.rate || 0),
      ratePercent: this.money(Number(row.rate || 0) * 100),
      fixedAmount: Number(row.fixedAmount || 0),
      commissionAmount: Number(row.commissionAmount || 0),
      paymentServiceAllocationId: row.paymentServiceAllocationId,
      createTime: row.createTime,
    };
  }
}
