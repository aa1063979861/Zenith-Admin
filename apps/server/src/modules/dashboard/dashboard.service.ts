import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { INVOICE_DELIVERY_STATUSES, INVOICE_PAYMENT_STATUS, INVOICE_STATUS, PAYMENT_MATCH_STATUS } from '../../common/business.constants';
import { Client } from '../../entities/client.entity';
import { FinanceInvoiceLine } from '../../entities/finance-invoice-line.entity';
import { FinanceInvoice } from '../../entities/finance-invoice.entity';
import { FinancePayment } from '../../entities/finance-payment.entity';
import { Order } from '../../entities/order.entity';
import { PaymentServiceAllocation } from '../../entities/payment-service-allocation.entity';
import { ServiceItem } from '../../entities/service-item.entity';
import { User } from '../../entities/user.entity';
import { DONE_SERVICE_ITEM_STATUSES, SERVICE_ITEM_STATUS } from '../orders/order.constants';
import { SystemParametersService } from '../system-parameters/system-parameters.service';

type DashboardQuery = {
  serviceYear?: string | number;
  regionCode?: string;
  serviceCode?: string;
  receiverId?: string | number;
  performerId?: string | number;
  ownerUserId?: string | number;
  scope?: string;
};

type DashboardFilters = {
  serviceYear: number | null;
  regionCode: string | null;
  serviceCode: string | null;
  receiverId: number | null;
  performerId: number | null;
  ownerUserId: number | null;
};

type CountAmountRow = {
  name: string;
  value: string;
  amount?: string;
  receivedAmount?: string;
  billableAmount?: string;
};

const DONE_SERVICE_STATUSES = DONE_SERVICE_ITEM_STATUSES;
const VOID_INVOICE_STATUS = INVOICE_STATUS.VOIDED;
const MATCHED_PAYMENT_STATUS = PAYMENT_MATCH_STATUS.MATCHED;
const PENDING_INVOICE_DELIVERY_STATUS = INVOICE_DELIVERY_STATUSES[0];

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Client) private readonly clientRepository: Repository<Client>,
    @InjectRepository(Order) private readonly orderRepository: Repository<Order>,
    @InjectRepository(ServiceItem) private readonly serviceItemRepository: Repository<ServiceItem>,
    @InjectRepository(FinanceInvoice) private readonly invoiceRepository: Repository<FinanceInvoice>,
    @InjectRepository(FinanceInvoiceLine) private readonly invoiceLineRepository: Repository<FinanceInvoiceLine>,
    @InjectRepository(FinancePayment) private readonly paymentRepository: Repository<FinancePayment>,
    @InjectRepository(PaymentServiceAllocation) private readonly allocationRepository: Repository<PaymentServiceAllocation>,
    private readonly parametersService: SystemParametersService,
  ) {}

  async workbench(user: User, query: DashboardQuery = {}) {
    const canSwitchScope = user.builtIn || user.userKind === 'SYSTEM_ADMIN';
    const requestedScope = query.scope === 'mine' ? 'mine' : 'all';
    const scope = canSwitchScope ? requestedScope : 'mine';
    const ownerUserId = scope === 'mine' ? user.id : undefined;
    const scopedQuery = { ...query, ownerUserId };
    const filters = this.parseFilters(scopedQuery);
    const [overview, pendingServices, problemServices] = await Promise.all([
      this.overview(scopedQuery),
      this.pendingServices(filters),
      this.problemServices(filters),
    ]);
    const exceptions = overview.exceptions || {};

    return {
      user: {
        displayName: user.employeeProfile?.name || user.nickName || user.username,
        departmentName: user.employeeProfile?.departmentName || null,
        roleName: user.builtIn ? '超级管理员' : user.employeeProfile?.positionName || null,
        scope,
        canSwitchScope,
      },
      taskCards: [
        { key: 'pendingServices', label: '待处理服务项', value: pendingServices.total, valueType: 'count', note: scope === 'mine' ? '与我相关' : '全公司未完成', tone: pendingServices.total ? 'primary' : 'muted' },
        { key: 'renewals', label: '待续签', value: exceptions.renewalPendingCount || 0, valueType: 'count', note: '到提醒日未续签', tone: exceptions.renewalPendingCount ? 'warning' : 'muted' },
        { key: 'unmatchedPayments', label: '待匹配收款', value: exceptions.unmatchedPaymentCount || 0, valueType: 'count', note: `￥${this.money(overview.kpis?.paymentUnmatchedAmount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`, tone: exceptions.unmatchedPaymentCount ? 'danger' : 'muted' },
        { key: 'unreceivedAmount', label: '未收金额', value: overview.kpis?.unreceivedAmount || 0, valueType: 'currency', note: `收款率 ${overview.kpis?.collectionRate || 0}%`, tone: overview.kpis?.unreceivedAmount ? 'accent' : 'muted' },
      ],
      todoGroups: {
        pendingServices,
        renewals: { total: exceptions.renewalPendingCount || 0, rows: exceptions.dueRenewals || [] },
        overdueServices: { total: exceptions.overdueCount || 0, rows: exceptions.overdueServices || [] },
        problemServices,
        unmatchedPayments: { total: exceptions.unmatchedPaymentCount || 0, rows: exceptions.unmatchedPayments || [] },
        unpaidInvoices: { total: exceptions.unpaidInvoiceCount || 0, rows: exceptions.unpaidInvoices || [] },
      },
      risks: [
        { key: 'overdueServices', label: '已逾期服务', value: exceptions.overdueCount || 0, level: 'danger', route: '/orders' },
        { key: 'renewals', label: '待续签服务', value: exceptions.renewalPendingCount || 0, level: 'warning', route: '/orders' },
        { key: 'unpaidInvoices', label: '已开未收发票', value: exceptions.unpaidInvoiceCount || 0, level: 'warning', route: '/finance', query: { tab: 'invoice', paymentStatus: INVOICE_PAYMENT_STATUS.PENDING } },
        { key: 'unmatchedPayments', label: '待匹配流水', value: exceptions.unmatchedPaymentCount || 0, level: 'danger', route: '/finance', query: { tab: 'payment', matchStatus: PAYMENT_MATCH_STATUS.PENDING } },
        { key: 'problemServices', label: '有问题说明', value: problemServices.total, level: 'info', route: '/orders' },
      ],
      overview,
    };
  }

  async overview(query: DashboardQuery = {}) {
    const filters = this.parseFilters(query);
    const [
      serviceSummary,
      invoiceSummary,
      paymentSummary,
      serviceDistribution,
      regionDistribution,
      statusDistribution,
      yearlyTrend,
      monthlyTrend,
      receiverRanking,
      performerRanking,
      renewalFunnel,
      agingBuckets,
      exceptions,
    ] = await Promise.all([
      this.serviceSummary(filters),
      this.invoiceSummary(filters),
      this.paymentSummary(filters),
      this.serviceDistribution(filters),
      this.regionDistribution(filters),
      this.serviceStatusDistribution(filters),
      this.yearlyTrend(filters),
      this.monthlyTrend(filters),
      this.employeeRanking(filters, 'receiver'),
      this.employeeRanking(filters, 'performer'),
      this.renewalFunnel(filters),
      this.agingBuckets(filters),
      this.exceptions(filters),
    ]);

    const billableAmount = serviceSummary.billableAmount;
    const receivedAmount = serviceSummary.receivedAmount;
    const unreceivedAmount = this.money(billableAmount - receivedAmount);
    const collectionRate = this.percent(receivedAmount, billableAmount);
    const completionRate = this.percent(serviceSummary.completedCount, serviceSummary.serviceItemCount);

    const summaryCards = [
      { key: 'clientCount', label: '客户数', value: serviceSummary.clientCount, valueType: 'count', note: '筛选范围内客户' },
      { key: 'orderCount', label: '订单数', value: serviceSummary.orderCount, valueType: 'count', note: '筛选范围内订单' },
      { key: 'serviceItemCount', label: '服务项', value: serviceSummary.serviceItemCount, valueType: 'count', note: '最小核算单元' },
      { key: 'billableAmount', label: '应收金额', value: billableAmount, valueType: 'currency', note: '服务项应收合计' },
      { key: 'invoiceAmount', label: '开票金额', value: invoiceSummary.invoiceAmount, valueType: 'currency', note: '已开票合计' },
      { key: 'invoiceUnmatchedAmount', label: '已开未收', value: invoiceSummary.unmatchedAmount, valueType: 'currency', note: '发票待回款' },
      { key: 'receivedAmount', label: '已收金额', value: receivedAmount, valueType: 'currency', note: '已匹配到服务项' },
      { key: 'unreceivedAmount', label: '未收金额', value: unreceivedAmount, valueType: 'currency', note: '应收减已收' },
      { key: 'collectionRate', label: '收款率', value: collectionRate, valueType: 'percent', note: '已收 / 应收' },
      { key: 'completionRate', label: '完成率', value: completionRate, valueType: 'percent', note: '服务完成占比' },
      { key: 'renewalPendingCount', label: '待续签', value: exceptions.renewalPendingCount, valueType: 'count', note: '到提醒日未续签' },
      { key: 'paymentUnmatchedAmount', label: '待匹配收款', value: paymentSummary.unmatchedAmount, valueType: 'currency', note: '银行流水待认领' },
    ];

    return {
      filters,
      trendYear: filters.serviceYear || new Date().getFullYear(),
      cards: summaryCards.slice(0, 4),
      summaryCards,
      kpis: {
        ...serviceSummary,
        invoiceAmount: invoiceSummary.invoiceAmount,
        invoiceUnmatchedAmount: invoiceSummary.unmatchedAmount,
        paymentUnmatchedAmount: paymentSummary.unmatchedAmount,
        paymentUnmatchedCount: paymentSummary.unmatchedCount,
        unreceivedAmount,
        collectionRate,
        completionRate,
      },
      financeSummary: [
        { name: '应收', value: billableAmount },
        { name: '开票', value: invoiceSummary.invoiceAmount },
        { name: '已收', value: receivedAmount },
        { name: '未收', value: unreceivedAmount },
      ],
      serviceDistribution,
      regionDistribution,
      statusDistribution,
      yearlyTrend,
      monthlyTrend,
      receiverRanking,
      performerRanking,
      renewalFunnel,
      agingBuckets,
      exceptions,
    };
  }

  private async serviceSummary(filters: DashboardFilters) {
    const raw = await this.applyServiceFilters(
      this.serviceItemRepository
        .createQueryBuilder('item')
        .select('COUNT(item.id)', 'serviceItemCount')
        .addSelect('COUNT(DISTINCT item.clientId)', 'clientCount')
        .addSelect('COUNT(DISTINCT item.orderId)', 'orderCount')
        .addSelect('COALESCE(SUM(item.billableAmount), 0)', 'billableAmount')
        .addSelect('COALESCE(SUM(item.receivedAmount), 0)', 'receivedAmount')
        .addSelect('SUM(CASE WHEN item.status = :completedStatus THEN 1 ELSE 0 END)', 'completedCount')
        .setParameter('completedStatus', SERVICE_ITEM_STATUS.DONE),
      'item',
      filters,
    ).getRawOne<{
      serviceItemCount: string;
      clientCount: string;
      orderCount: string;
      billableAmount: string;
      receivedAmount: string;
      completedCount: string;
    }>();

    const billableAmount = this.money(raw?.billableAmount);
    return {
      clientCount: Number(raw?.clientCount || 0),
      orderCount: Number(raw?.orderCount || 0),
      serviceItemCount: Number(raw?.serviceItemCount || 0),
      completedCount: Number(raw?.completedCount || 0),
      billableAmount,
      receivedAmount: this.money(raw?.receivedAmount),
    };
  }

  private async invoiceSummary(filters: DashboardFilters) {
    const raw = await this.applyServiceFilters(
      this.invoiceLineRepository
        .createQueryBuilder('line')
        .innerJoin('line.invoice', 'invoice')
        .innerJoin('line.serviceItem', 'item')
        .select('COALESCE(SUM(line.amount), 0)', 'invoiceAmount')
        .where('invoice.status <> :voidStatus', { voidStatus: VOID_INVOICE_STATUS }),
      'item',
      filters,
    ).getRawOne<{ invoiceAmount: string }>();
    const invoiceAmount = this.money(raw?.invoiceAmount);
    return {
      invoiceAmount,
      unmatchedAmount: this.money(await this.invoiceOutstandingAmount(filters)),
    };
  }

  private async paymentSummary(filters: DashboardFilters) {
    const qb = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoin('payment.client', 'client')
      .select('COUNT(payment.id)', 'unmatchedCount')
      .addSelect('COALESCE(SUM(payment.amount - payment.matchedAmount), 0)', 'unmatchedAmount')
      .where('payment.matchStatus <> :matchedStatus', { matchedStatus: MATCHED_PAYMENT_STATUS })
      .andWhere('payment.amount > payment.matchedAmount');

    this.applyPaymentFilters(qb, filters);
    const raw = await qb.getRawOne<{ unmatchedCount: string; unmatchedAmount: string }>();
    return {
      unmatchedCount: Number(raw?.unmatchedCount || 0),
      unmatchedAmount: this.money(raw?.unmatchedAmount),
    };
  }

  private async serviceDistribution(filters: DashboardFilters) {
    const rows = await this.applyServiceFilters(
      this.serviceItemRepository
        .createQueryBuilder('item')
        .select('item.serviceName', 'name')
        .addSelect('COUNT(item.id)', 'value')
        .addSelect('COALESCE(SUM(item.billableAmount), 0)', 'amount')
        .groupBy('item.serviceName')
        .orderBy('value', 'DESC')
        .addOrderBy('amount', 'DESC'),
      'item',
      filters,
    ).getRawMany<CountAmountRow>();

    return rows.map(row => ({
      name: row.name,
      value: Number(row.value || 0),
      amount: this.money(row.amount),
    }));
  }

  private async regionDistribution(filters: DashboardFilters) {
    const rows = await this.applyServiceFilters(
      this.serviceItemRepository
        .createQueryBuilder('item')
        .select('item.regionCode', 'regionCode')
        .addSelect('item.regionName', 'name')
        .addSelect('COUNT(item.id)', 'serviceItemCount')
        .addSelect('COALESCE(SUM(item.billableAmount), 0)', 'billableAmount')
        .addSelect('COALESCE(SUM(item.receivedAmount), 0)', 'receivedAmount')
        .groupBy('item.regionCode')
        .addGroupBy('item.regionName')
        .orderBy('billableAmount', 'DESC'),
      'item',
      filters,
    ).getRawMany<{
      regionCode: string;
      name: string;
      serviceItemCount: string;
      billableAmount: string;
      receivedAmount: string;
    }>();

    return rows.map(row => {
      const billableAmount = this.money(row.billableAmount);
      const receivedAmount = this.money(row.receivedAmount);
      return {
        regionCode: row.regionCode,
        name: row.name,
        serviceItemCount: Number(row.serviceItemCount || 0),
        billableAmount,
        receivedAmount,
        unreceivedAmount: this.money(billableAmount - receivedAmount),
        collectionRate: this.percent(receivedAmount, billableAmount),
      };
    });
  }

  private async serviceStatusDistribution(filters: DashboardFilters) {
    const statusSql = this.serviceStatusSql('item');
    const rows = await this.applyServiceFilters(
      this.serviceItemRepository
        .createQueryBuilder('item')
        .select(statusSql, 'name')
        .addSelect('COUNT(item.id)', 'value')
        .groupBy(statusSql)
        .orderBy('value', 'DESC'),
      'item',
      filters,
    ).getRawMany<CountAmountRow>();

    return rows.map(row => ({ name: row.name, value: Number(row.value || 0) }));
  }

  private async yearlyTrend(filters: DashboardFilters) {
    const rows = await this.applyServiceFilters(
      this.serviceItemRepository
        .createQueryBuilder('item')
        .select('item.serviceYear', 'year')
        .addSelect('COUNT(item.id)', 'serviceItemCount')
        .addSelect('COALESCE(SUM(item.billableAmount), 0)', 'billableAmount')
        .addSelect('COALESCE(SUM(item.receivedAmount), 0)', 'receivedAmount')
        .groupBy('item.serviceYear')
        .orderBy('item.serviceYear', 'ASC'),
      'item',
      filters,
    ).getRawMany<{
      year: string;
      serviceItemCount: string;
      billableAmount: string;
      receivedAmount: string;
    }>();

    return rows.map(row => {
      const billableAmount = this.money(row.billableAmount);
      const receivedAmount = this.money(row.receivedAmount);
      return {
        year: Number(row.year),
        serviceItemCount: Number(row.serviceItemCount || 0),
        billableAmount,
        receivedAmount,
        unreceivedAmount: this.money(billableAmount - receivedAmount),
      };
    });
  }

  private async monthlyTrend(filters: DashboardFilters) {
    const year = filters.serviceYear || new Date().getFullYear();
    const months = Array.from({ length: 12 }, (_, index) => ({
      month: `${year}-${String(index + 1).padStart(2, '0')}`,
      orderAmount: 0,
      invoiceAmount: 0,
      receivedAmount: 0,
    }));
    const monthMap = new Map(months.map(row => [row.month.slice(5), row]));

    const orderRows = await this.applyServiceFilters(
      this.serviceItemRepository
        .createQueryBuilder('item')
        .innerJoin('item.order', 'orders')
        .select("DATE_FORMAT(orders.orderDate, '%m')", 'month')
        .addSelect('COALESCE(SUM(item.billableAmount), 0)', 'amount')
        .where('YEAR(orders.orderDate) = :trendYear', { trendYear: year })
        .groupBy("DATE_FORMAT(orders.orderDate, '%m')"),
      'item',
      filters,
    ).getRawMany<{ month: string; amount: string }>();

    const invoiceRows = await this.applyServiceFilters(
      this.invoiceLineRepository
        .createQueryBuilder('line')
        .innerJoin('line.invoice', 'invoice')
        .innerJoin('line.serviceItem', 'item')
        .select("DATE_FORMAT(invoice.invoiceDate, '%m')", 'month')
        .addSelect('COALESCE(SUM(line.amount), 0)', 'amount')
        .where('invoice.status <> :voidStatus', { voidStatus: VOID_INVOICE_STATUS })
        .andWhere('YEAR(invoice.invoiceDate) = :trendYear', { trendYear: year })
        .groupBy("DATE_FORMAT(invoice.invoiceDate, '%m')"),
      'item',
      filters,
    ).getRawMany<{ month: string; amount: string }>();

    const receivedRows = await this.applyServiceFilters(
      this.allocationRepository
        .createQueryBuilder('allocation')
        .innerJoin('allocation.serviceItem', 'item')
        .innerJoin('allocation.paymentInvoiceMatch', 'match')
        .innerJoin('match.payment', 'payment')
        .innerJoin('match.invoice', 'invoice')
        .select("DATE_FORMAT(payment.paymentDate, '%m')", 'month')
        .addSelect('COALESCE(SUM(allocation.allocatedAmount), 0)', 'amount')
        .where('invoice.status <> :voidStatus', { voidStatus: VOID_INVOICE_STATUS })
        .andWhere('YEAR(payment.paymentDate) = :trendYear', { trendYear: year })
        .groupBy("DATE_FORMAT(payment.paymentDate, '%m')"),
      'item',
      filters,
    ).getRawMany<{ month: string; amount: string }>();

    for (const row of orderRows)
      monthMap.get(row.month)!.orderAmount = this.money(row.amount);
    for (const row of invoiceRows)
      monthMap.get(row.month)!.invoiceAmount = this.money(row.amount);
    for (const row of receivedRows)
      monthMap.get(row.month)!.receivedAmount = this.money(row.amount);

    return months;
  }

  private async employeeRanking(filters: DashboardFilters, type: 'receiver' | 'performer') {
    const idColumn = type === 'receiver' ? 'item.receiverId' : 'item.performerId';
    const nameColumn = type === 'receiver' ? 'item.receiverName' : 'item.performerName';
    const rows = await this.applyServiceFilters(
      this.serviceItemRepository
        .createQueryBuilder('item')
        .select(idColumn, 'employeeId')
        .addSelect(nameColumn, 'name')
        .addSelect('COUNT(item.id)', 'serviceItemCount')
        .addSelect('SUM(CASE WHEN item.status = :completedStatus THEN 1 ELSE 0 END)', 'completedCount')
        .addSelect('COALESCE(SUM(item.billableAmount), 0)', 'billableAmount')
        .addSelect('COALESCE(SUM(item.receivedAmount), 0)', 'receivedAmount')
        .setParameter('completedStatus', SERVICE_ITEM_STATUS.DONE)
        .groupBy(idColumn)
        .addGroupBy(nameColumn)
        .orderBy('receivedAmount', 'DESC')
        .addOrderBy('serviceItemCount', 'DESC')
        .limit(10),
      'item',
      filters,
    ).getRawMany<{
      employeeId: string;
      name: string;
      serviceItemCount: string;
      completedCount: string;
      billableAmount: string;
      receivedAmount: string;
    }>();

    return rows.map(row => {
      const serviceItemCount = Number(row.serviceItemCount || 0);
      const completedCount = Number(row.completedCount || 0);
      const billableAmount = this.money(row.billableAmount);
      const receivedAmount = this.money(row.receivedAmount);
      return {
        employeeId: Number(row.employeeId),
        name: row.name,
        serviceItemCount,
        completedCount,
        billableAmount,
        receivedAmount,
        unreceivedAmount: this.money(billableAmount - receivedAmount),
        completionRate: this.percent(completedCount, serviceItemCount),
        collectionRate: this.percent(receivedAmount, billableAmount),
      };
    });
  }

  private async renewalFunnel(filters: DashboardFilters) {
    const warningDays = await this.parametersService.getServiceDueWarningDays();
    const renewalSql = this.renewalStatusSql('item', warningDays);
    const rows = await this.applyServiceFilters(
      this.serviceItemRepository
        .createQueryBuilder('item')
        .select(renewalSql, 'name')
        .addSelect('COUNT(item.id)', 'value')
        .groupBy(renewalSql),
      'item',
      filters,
    ).getRawMany<CountAmountRow>();

    const order = ['无需续签', '未到期', '待续签', '已续签', '不续签', '已终止'];
    const rowMap = new Map(rows.map(row => [row.name, Number(row.value || 0)]));
    return order.map(name => ({ name, value: rowMap.get(name) || 0 }));
  }

  private async agingBuckets(filters: DashboardFilters) {
    const ageSql = `
      CASE
        WHEN DATEDIFF(CURRENT_DATE(), invoice.invoiceDate) <= 30 THEN '0-30天'
        WHEN DATEDIFF(CURRENT_DATE(), invoice.invoiceDate) <= 60 THEN '31-60天'
        WHEN DATEDIFF(CURRENT_DATE(), invoice.invoiceDate) <= 90 THEN '61-90天'
        ELSE '90天以上'
      END
    `;
    const rows = await this.applyServiceFilters(
      this.withAllocationSum(
        this.invoiceLineRepository
          .createQueryBuilder('line')
          .innerJoin('line.invoice', 'invoice')
          .innerJoin('line.serviceItem', 'item')
          .select(ageSql, 'name')
          .addSelect('COUNT(DISTINCT invoice.id)', 'invoiceCount')
          .addSelect('COALESCE(SUM(GREATEST(line.amount - COALESCE(allocation_sum.allocatedAmount, 0), 0)), 0)', 'amount')
          .where('invoice.status <> :voidStatus', { voidStatus: VOID_INVOICE_STATUS })
          .groupBy(ageSql)
          .having('amount > 0'),
      ),
      'item',
      filters,
    ).getRawMany<{ name: string; invoiceCount: string; amount: string }>();

    const order = ['0-30天', '31-60天', '61-90天', '90天以上'];
    const rowMap = new Map(rows.map(row => [row.name, row]));
    return order.map(name => {
      const row = rowMap.get(name);
      return {
        name,
        invoiceCount: Number(row?.invoiceCount || 0),
        amount: this.money(row?.amount),
      };
    });
  }

  private async exceptions(filters: DashboardFilters) {
    const [
      unpaidServices,
      overdueServices,
      renewalRows,
      unpaidInvoices,
      unmatchedPayments,
      problemRaw,
      undeliveredRaw,
    ] = await Promise.all([
      this.unpaidServices(filters),
      this.overdueServices(filters),
      this.pendingRenewals(filters),
      this.unpaidInvoices(filters),
      this.unmatchedPayments(filters),
      this.applyServiceFilters(
        this.serviceItemRepository
          .createQueryBuilder('item')
          .select('COUNT(item.id)', 'count')
          .where('item.problemDescription IS NOT NULL')
          .andWhere("item.problemDescription <> ''"),
        'item',
        filters,
      ).getRawOne<{ count: string }>(),
      this.applyServiceFilters(
        this.invoiceLineRepository
          .createQueryBuilder('line')
          .innerJoin('line.invoice', 'invoice')
          .innerJoin('line.serviceItem', 'item')
          .select('COUNT(DISTINCT invoice.id)', 'count')
          .where('invoice.status <> :voidStatus', { voidStatus: VOID_INVOICE_STATUS })
          .andWhere('invoice.deliveryStatus = :deliveryStatus', { deliveryStatus: PENDING_INVOICE_DELIVERY_STATUS }),
        'item',
        filters,
      ).getRawOne<{ count: string }>(),
    ]);

    return {
      unpaidServiceCount: unpaidServices.total,
      overdueCount: overdueServices.total,
      renewalPendingCount: renewalRows.total,
      problemCount: Number(problemRaw?.count || 0),
      unpaidInvoiceCount: unpaidInvoices.total,
      undeliveredInvoiceCount: Number(undeliveredRaw?.count || 0),
      unmatchedPaymentCount: unmatchedPayments.total,
      unpaidServices: unpaidServices.rows,
      overdueServices: overdueServices.rows,
      dueRenewals: renewalRows.rows,
      unpaidInvoices: unpaidInvoices.rows,
      unmatchedPayments: unmatchedPayments.rows,
    };
  }

  private async pendingServices(filters: DashboardFilters) {
    const warningDays = await this.parametersService.getServiceDueWarningDays();
    const countQb = this.applyServiceFilters(
      this.serviceItemRepository
        .createQueryBuilder('item')
        .select('COUNT(item.id)', 'count')
        .where('item.status NOT IN (:...doneStatuses)', { doneStatuses: DONE_SERVICE_STATUSES }),
      'item',
      filters,
    );
    const rowsQb = this.applyServiceFilters(
      this.serviceItemRepository
        .createQueryBuilder('item')
        .where('item.status NOT IN (:...doneStatuses)', { doneStatuses: DONE_SERVICE_STATUSES })
        .orderBy(`CASE WHEN item.problemDescription IS NOT NULL AND item.problemDescription <> '' THEN 0 WHEN item.serviceEndDate IS NOT NULL AND item.serviceEndDate <= DATE_ADD(CURRENT_DATE(), INTERVAL ${warningDays} DAY) THEN 1 ELSE 2 END`, 'ASC')
        .addOrderBy('item.serviceEndDate', 'ASC')
        .addOrderBy('item.id', 'DESC')
        .limit(10),
      'item',
      filters,
    );
    const [countRaw, rows] = await Promise.all([
      countQb.getRawOne<{ count: string }>(),
      rowsQb.getMany(),
    ]);
    return {
      total: Number(countRaw?.count || 0),
      rows: rows.map(item => this.toServiceItemDrillRow(item)),
    };
  }

  private async problemServices(filters: DashboardFilters) {
    const countQb = this.applyServiceFilters(
      this.serviceItemRepository
        .createQueryBuilder('item')
        .select('COUNT(item.id)', 'count')
        .where('item.problemDescription IS NOT NULL')
        .andWhere("item.problemDescription <> ''")
        .andWhere('item.status NOT IN (:...doneStatuses)', { doneStatuses: DONE_SERVICE_STATUSES }),
      'item',
      filters,
    );
    const rowsQb = this.applyServiceFilters(
      this.serviceItemRepository
        .createQueryBuilder('item')
        .where('item.problemDescription IS NOT NULL')
        .andWhere("item.problemDescription <> ''")
        .andWhere('item.status NOT IN (:...doneStatuses)', { doneStatuses: DONE_SERVICE_STATUSES })
        .orderBy('item.updateTime', 'DESC')
        .addOrderBy('item.id', 'DESC')
        .limit(8),
      'item',
      filters,
    );
    const [countRaw, rows] = await Promise.all([
      countQb.getRawOne<{ count: string }>(),
      rowsQb.getMany(),
    ]);
    return {
      total: Number(countRaw?.count || 0),
      rows: rows.map(item => this.toServiceItemDrillRow(item)),
    };
  }

  private async unpaidServices(filters: DashboardFilters) {
    const countQb = this.applyServiceFilters(
      this.serviceItemRepository
        .createQueryBuilder('item')
        .select('COUNT(item.id)', 'count')
        .where('item.billableAmount > item.receivedAmount'),
      'item',
      filters,
    );
    const rowsQb = this.applyServiceFilters(
      this.serviceItemRepository
        .createQueryBuilder('item')
        .where('item.billableAmount > item.receivedAmount')
        .orderBy('(item.billableAmount - item.receivedAmount)', 'DESC')
        .addOrderBy('item.id', 'DESC')
        .limit(8),
      'item',
      filters,
    );
    const [countRaw, rows] = await Promise.all([
      countQb.getRawOne<{ count: string }>(),
      rowsQb.getMany(),
    ]);
    return {
      total: Number(countRaw?.count || 0),
      rows: rows.map(item => this.toServiceItemDrillRow(item)),
    };
  }

  private async overdueServices(filters: DashboardFilters) {
    const countQb = this.applyServiceFilters(
      this.serviceItemRepository
        .createQueryBuilder('item')
        .select('COUNT(item.id)', 'count')
        .where('item.serviceEndDate IS NOT NULL')
        .andWhere('item.serviceEndDate < CURRENT_DATE()')
        .andWhere('item.status NOT IN (:...doneStatuses)', { doneStatuses: DONE_SERVICE_STATUSES }),
      'item',
      filters,
    );
    const rowsQb = this.applyServiceFilters(
      this.serviceItemRepository
        .createQueryBuilder('item')
        .where('item.serviceEndDate IS NOT NULL')
        .andWhere('item.serviceEndDate < CURRENT_DATE()')
        .andWhere('item.status NOT IN (:...doneStatuses)', { doneStatuses: DONE_SERVICE_STATUSES })
        .orderBy('item.serviceEndDate', 'ASC')
        .addOrderBy('item.id', 'DESC')
        .limit(8),
      'item',
      filters,
    );
    const [countRaw, rows] = await Promise.all([
      countQb.getRawOne<{ count: string }>(),
      rowsQb.getMany(),
    ]);
    return {
      total: Number(countRaw?.count || 0),
      rows: rows.map(item => this.toServiceItemDrillRow(item)),
    };
  }

  private async pendingRenewals(filters: DashboardFilters) {
    const warningDays = await this.parametersService.getServiceDueWarningDays();
    const renewalSql = this.renewalStatusSql('item', warningDays);
    const baseCondition = `${renewalSql} = :renewalStatus`;
    const countQb = this.applyServiceFilters(
      this.serviceItemRepository
        .createQueryBuilder('item')
        .select('COUNT(item.id)', 'count')
        .where(baseCondition, { renewalStatus: '待续签' }),
      'item',
      filters,
    );
    const rowsQb = this.applyServiceFilters(
      this.serviceItemRepository
        .createQueryBuilder('item')
        .where(baseCondition, { renewalStatus: '待续签' })
        .orderBy('item.serviceEndDate', 'ASC')
        .addOrderBy('item.id', 'DESC')
        .limit(8),
      'item',
      filters,
    );
    const [countRaw, rows] = await Promise.all([
      countQb.getRawOne<{ count: string }>(),
      rowsQb.getMany(),
    ]);
    return {
      total: Number(countRaw?.count || 0),
      rows: rows.map(item => this.toServiceItemDrillRow(item)),
    };
  }

  private async unpaidInvoices(filters: DashboardFilters) {
    const amountSql = 'GREATEST(SUM(line.amount) - COALESCE(SUM(allocation_sum.allocatedAmount), 0), 0)';
    const countQb = this.applyServiceFilters(
      this.withAllocationSum(
        this.invoiceLineRepository
          .createQueryBuilder('line')
          .innerJoin('line.invoice', 'invoice')
          .innerJoin('line.serviceItem', 'item')
          .select('invoice.id', 'id')
          .where('invoice.status <> :voidStatus', { voidStatus: VOID_INVOICE_STATUS })
          .groupBy('invoice.id')
          .having(`${amountSql} > 0`),
      ),
      'item',
      filters,
    );
    const rowsQb = this.applyServiceFilters(
      this.withAllocationSum(
        this.invoiceLineRepository
          .createQueryBuilder('line')
          .innerJoin('line.invoice', 'invoice')
          .innerJoin('line.serviceItem', 'item')
          .select('invoice.id', 'id')
          .addSelect('invoice.invoiceNo', 'invoiceNo')
          .addSelect('invoice.clientName', 'clientName')
          .addSelect('invoice.invoiceDate', 'invoiceDate')
          .addSelect('invoice.deliveryStatus', 'deliveryStatus')
          .addSelect('invoice.paymentStatus', 'paymentStatus')
          .addSelect('SUM(line.amount)', 'invoiceAmount')
          .addSelect('COALESCE(SUM(allocation_sum.allocatedAmount), 0)', 'matchedAmount')
          .addSelect(amountSql, 'unmatchedAmount')
          .where('invoice.status <> :voidStatus', { voidStatus: VOID_INVOICE_STATUS })
          .groupBy('invoice.id')
          .addGroupBy('invoice.invoiceNo')
          .addGroupBy('invoice.clientName')
          .addGroupBy('invoice.invoiceDate')
          .addGroupBy('invoice.deliveryStatus')
          .addGroupBy('invoice.paymentStatus')
          .having('unmatchedAmount > 0')
          .orderBy('invoice.invoiceDate', 'ASC')
          .addOrderBy('invoice.id', 'DESC')
          .limit(8),
      ),
      'item',
      filters,
    );
    const [countRows, rows] = await Promise.all([
      countQb.getRawMany<{ id: string }>(),
      rowsQb.getRawMany<{
        id: string;
        invoiceNo: string;
        clientName: string;
        invoiceDate: string;
        deliveryStatus: string;
        paymentStatus: string;
        invoiceAmount: string;
        matchedAmount: string;
        unmatchedAmount: string;
      }>(),
    ]);
    return {
      total: countRows.length,
      rows: rows.map(row => ({
        id: Number(row.id),
        invoiceNo: row.invoiceNo,
        clientName: row.clientName,
        invoiceDate: row.invoiceDate,
        deliveryStatus: row.deliveryStatus,
        paymentStatus: row.paymentStatus,
        invoiceAmount: this.money(row.invoiceAmount),
        matchedAmount: this.money(row.matchedAmount),
        unmatchedAmount: this.money(row.unmatchedAmount),
      })),
    };
  }

  private async unmatchedPayments(filters: DashboardFilters) {
    const countQb = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoin('payment.client', 'client')
      .select('COUNT(payment.id)', 'count')
      .where('payment.matchStatus <> :matchedStatus', { matchedStatus: MATCHED_PAYMENT_STATUS })
      .andWhere('payment.amount > payment.matchedAmount');
    const rowsQb = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.client', 'client')
      .where('payment.matchStatus <> :matchedStatus', { matchedStatus: MATCHED_PAYMENT_STATUS })
      .andWhere('payment.amount > payment.matchedAmount')
      .orderBy('payment.paymentDate', 'ASC')
      .addOrderBy('payment.id', 'DESC')
      .limit(8);

    this.applyPaymentFilters(countQb, filters);
    this.applyPaymentFilters(rowsQb, filters);

    const [countRaw, rows] = await Promise.all([
      countQb.getRawOne<{ count: string }>(),
      rowsQb.getMany(),
    ]);
    return {
      total: Number(countRaw?.count || 0),
      rows: rows.map(row => ({
        id: row.id,
        paymentDate: row.paymentDate,
        payerName: row.payerName,
        clientName: row.client?.unitName || row.clientName || null,
        amount: this.money(row.amount),
        matchedAmount: this.money(row.matchedAmount),
        unmatchedAmount: this.money(Number(row.amount || 0) - Number(row.matchedAmount || 0)),
        matchStatus: row.matchStatus,
        bankRemark: row.bankRemark || null,
      })),
    };
  }

  private async invoiceOutstandingAmount(filters: DashboardFilters) {
    const raw = await this.applyServiceFilters(
      this.withAllocationSum(
        this.invoiceLineRepository
          .createQueryBuilder('line')
          .innerJoin('line.invoice', 'invoice')
          .innerJoin('line.serviceItem', 'item')
          .select('COALESCE(SUM(GREATEST(line.amount - COALESCE(allocation_sum.allocatedAmount, 0), 0)), 0)', 'amount')
          .where('invoice.status <> :voidStatus', { voidStatus: VOID_INVOICE_STATUS }),
      ),
      'item',
      filters,
    ).getRawOne<{ amount: string }>();
    return this.money(raw?.amount);
  }

  private withAllocationSum(qb: SelectQueryBuilder<FinanceInvoiceLine>) {
    return qb.leftJoin(
      subQuery => subQuery
        .select('allocation.invoiceLineId', 'invoiceLineId')
        .addSelect('SUM(allocation.allocatedAmount)', 'allocatedAmount')
        .from(PaymentServiceAllocation, 'allocation')
        .groupBy('allocation.invoiceLineId'),
      'allocation_sum',
      'allocation_sum.invoiceLineId = line.id',
    );
  }

  private applyServiceFilters(qb: SelectQueryBuilder<any>, alias: string, filters: DashboardFilters) {
    if (filters.serviceYear)
      qb.andWhere(`${alias}.serviceYear = :serviceYear`, { serviceYear: filters.serviceYear });
    if (filters.regionCode)
      qb.andWhere(`${alias}.regionCode = :regionCode`, { regionCode: filters.regionCode });
    if (filters.serviceCode)
      qb.andWhere(`${alias}.serviceCode = :serviceCode`, { serviceCode: filters.serviceCode });
    if (filters.receiverId)
      qb.andWhere(`${alias}.receiverId = :receiverId`, { receiverId: filters.receiverId });
    if (filters.performerId)
      qb.andWhere(`${alias}.performerId = :performerId`, { performerId: filters.performerId });
    if (filters.ownerUserId)
      qb.andWhere(`(${alias}.receiverId = :ownerUserId OR ${alias}.performerId = :ownerUserId)`, { ownerUserId: filters.ownerUserId });
    return qb;
  }

  private applyPaymentFilters(qb: SelectQueryBuilder<any>, filters: DashboardFilters) {
    if (filters.serviceYear)
      qb.andWhere('YEAR(payment.paymentDate) = :paymentYear', { paymentYear: filters.serviceYear });
    if (filters.regionCode)
      qb.andWhere('client.regionCode = :paymentRegionCode', { paymentRegionCode: filters.regionCode });
    return qb;
  }

  private parseFilters(query: DashboardQuery): DashboardFilters {
    return {
      serviceYear: this.parseOptionalYear(query.serviceYear),
      regionCode: this.optionalText(query.regionCode),
      serviceCode: this.optionalText(query.serviceCode),
      receiverId: this.parseOptionalPositiveInt(query.receiverId, '接单人ID'),
      performerId: this.parseOptionalPositiveInt(query.performerId, '完成人ID'),
      ownerUserId: this.parseOptionalPositiveInt(query.ownerUserId, '当前用户ID'),
    };
  }

  private parseOptionalYear(value?: string | number) {
    if (value === undefined || value === null || value === '')
      return null;
    const year = Number(value);
    if (!Number.isInteger(year) || year < 2000 || year > 2100)
      throw new BadRequestException('服务年度无效');
    return year;
  }

  private parseOptionalPositiveInt(value: string | number | undefined, label: string) {
    if (value === undefined || value === null || value === '')
      return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0)
      throw new BadRequestException(`${label}无效`);
    return parsed;
  }

  private optionalText(value?: string | null) {
    const text = value?.trim();
    return text || null;
  }

  private money(value?: string | number | null) {
    return Number(Number(value || 0).toFixed(2));
  }

  private percent(part: number, total: number) {
    if (!total)
      return 0;
    return Number((part * 100 / total).toFixed(2));
  }

  private serviceStatusSql(alias: string) {
    return `CASE WHEN ${alias}.status = '已上报' THEN '待确认' ELSE ${alias}.status END`;
  }

  private renewalStatusSql(alias: string, warningDays: number) {
    return `
      CASE
        WHEN ${alias}.renewedByServiceItemId IS NOT NULL THEN '已续签'
        WHEN ${alias}.renewalStatus IN ('无需续签', '已续签', '不续签', '已终止') THEN ${alias}.renewalStatus
        WHEN COALESCE(${alias}.renewalReminderDate, DATE_SUB(${alias}.serviceEndDate, INTERVAL ${warningDays} DAY)) <= CURRENT_DATE() THEN '待续签'
        ELSE '未到期'
      END
    `;
  }

  private toServiceItemDrillRow(item: ServiceItem) {
    const billableAmount = this.money(item.billableAmount);
    const receivedAmount = this.money(item.receivedAmount);
    return {
      id: item.id,
      orderId: item.orderId,
      orderNo: item.orderNo,
      clientId: item.clientId,
      clientName: item.unitName,
      regionName: item.regionName,
      serviceName: item.serviceName,
      serviceYear: item.serviceYear,
      receiverName: item.receiverName,
      performerName: item.performerName,
      serviceEndDate: item.serviceEndDate || null,
      renewalReminderDate: item.renewalReminderDate || null,
      status: item.status,
      billableAmount,
      receivedAmount,
      unreceivedAmount: this.money(billableAmount - receivedAmount),
      problemDescription: item.problemDescription || null,
    };
  }
}
