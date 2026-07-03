import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  COMMISSION_SETTLEMENT_STATUS,
  CONTRACT_STATUS,
  CONTRACT_STATUSES,
  IMPORT_BATCH_STATUS,
  IMPORT_ROW_STATUS,
  IMPORT_ROW_STATUSES,
  INVOICE_DELIVERY_STATUSES,
  INVOICE_PAYMENT_STATUS,
  INVOICE_STATUS,
  INVOICE_STATUSES,
  PAYMENT_MATCH_STATUS,
} from '../../common/business.constants';
import { normalizePage, pageResult } from '../../common/page';
import { parseOptionalPositiveInt } from '../../common/query';
import { resolveSort } from '../../common/sort';
import { SpreadsheetService, SpreadsheetSheetRows } from '../../common/spreadsheet/spreadsheet.service';
import { normalizeUploadFileName } from '../../common/upload-file-name';
import { Client } from '../../entities/client.entity';
import { CommissionLine } from '../../entities/commission-line.entity';
import { FinanceContractLine } from '../../entities/finance-contract-line.entity';
import { FinanceContract } from '../../entities/finance-contract.entity';
import { FinanceInvoiceLine } from '../../entities/finance-invoice-line.entity';
import { FinanceInvoice } from '../../entities/finance-invoice.entity';
import { FinancePaymentImportRow, FinancePaymentImportRowStatus } from '../../entities/finance-payment-import-row.entity';
import { FinancePaymentImport } from '../../entities/finance-payment-import.entity';
import { FinancePayment } from '../../entities/finance-payment.entity';
import { PaymentInvoiceMatch } from '../../entities/payment-invoice-match.entity';
import { PaymentServiceAllocation } from '../../entities/payment-service-allocation.entity';
import { ServiceItem } from '../../entities/service-item.entity';
import { User } from '../../entities/user.entity';
import { ConfirmPaymentImportDto } from './dto/confirm-payment-import.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { FinanceServiceItemLineDto } from './dto/finance-line.dto';
import { MatchPaymentDto } from './dto/match-payment.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

type FinanceQuery = {
  pageNo?: number;
  pageSize?: number;
  clientId?: string | number;
  keyword?: string;
  status?: string;
  paymentStatus?: string;
  deliveryStatus?: string;
  matchStatus?: string;
  sortKey?: string;
  sortOrder?: string;
};

type FinanceLinePatch = {
  orderServiceItemId: number;
  amount: string;
  description?: string | null;
};

type AllocationRefreshScope = {
  invoiceIds: number[];
  serviceItemIds: number[];
};

type PaymentImportQuery = {
  pageNo?: number;
  pageSize?: number;
  validationStatus?: string | null;
};

type ParsedBankStatementRow = {
  sheetName: string;
  rowNo: number;
  raw: Record<string, unknown>;
};

type NormalizedPaymentImportRow = {
  paymentDate: string;
  amount: number;
  payerName: string;
  bankAccount: string | null;
  bankRemark: string | null;
  bankSerialNo: string | null;
  clientId: number | null;
  clientName: string | null;
};

type PaymentImportValidation = {
  status: FinancePaymentImportRowStatus;
  messages: string[];
  normalized: NormalizedPaymentImportRow | null;
};

const IMPORTABLE_PAYMENT_ROW_STATUSES: readonly FinancePaymentImportRowStatus[] = [IMPORT_ROW_STATUS.VALID, IMPORT_ROW_STATUS.WARNING];
const MANUAL_PAYMENT_ROW_STATUSES: readonly FinancePaymentImportRowStatus[] = [IMPORT_ROW_STATUS.VALID, IMPORT_ROW_STATUS.WARNING, IMPORT_ROW_STATUS.ERROR];
const UNMATCHED_PAYMENT_STATUSES = [PAYMENT_MATCH_STATUS.PENDING, PAYMENT_MATCH_STATUS.PARTIAL] as const;
const SETTLED_COMMISSION_STATUSES = [COMMISSION_SETTLEMENT_STATUS.CONFIRMED, COMMISSION_SETTLEMENT_STATUS.PAID] as const;

const BANK_STATEMENT_HEADER_ALIASES = {
  paymentDate: ['交易日期', '交易时间', '记账日期', '收款日期', '日期', '入账日期'],
  amount: ['收入金额', '贷方金额', '贷方发生额', '收入', '金额', '交易金额', '发生额'],
  payerName: ['付款方户名', '付款方', '对方户名', '对方账户名称', '对方名称', '对方单位', '户名'],
  bankAccount: ['收款账户', '收款账号', '本方账号', '本方账户', '账号', '账户'],
  bankRemark: ['摘要', '备注', '用途', '附言', '交易附言', '交易摘要'],
  bankSerialNo: ['流水号', '交易流水号', '银行流水号', '凭证号', '回单编号'],
};

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(FinanceContract) private readonly contractRepository: Repository<FinanceContract>,
    @InjectRepository(FinanceContractLine) private readonly contractLineRepository: Repository<FinanceContractLine>,
    @InjectRepository(FinanceInvoice) private readonly invoiceRepository: Repository<FinanceInvoice>,
    @InjectRepository(FinanceInvoiceLine) private readonly invoiceLineRepository: Repository<FinanceInvoiceLine>,
    @InjectRepository(FinancePayment) private readonly paymentRepository: Repository<FinancePayment>,
    @InjectRepository(FinancePaymentImport) private readonly paymentImportRepository: Repository<FinancePaymentImport>,
    @InjectRepository(FinancePaymentImportRow) private readonly paymentImportRowRepository: Repository<FinancePaymentImportRow>,
    @InjectRepository(PaymentInvoiceMatch) private readonly matchRepository: Repository<PaymentInvoiceMatch>,
    @InjectRepository(PaymentServiceAllocation) private readonly allocationRepository: Repository<PaymentServiceAllocation>,
    @InjectRepository(Client) private readonly clientRepository: Repository<Client>,
    @InjectRepository(ServiceItem) private readonly serviceItemRepository: Repository<ServiceItem>,
    @InjectRepository(CommissionLine) private readonly commissionLineRepository: Repository<CommissionLine>,
    private readonly dataSource: DataSource,
    private readonly spreadsheetService: SpreadsheetService,
  ) {}

  async summary() {
    const [contractRaw, invoiceRaw, invoiceMatchedRaw, paymentRaw, paymentMatchedRaw, receivableRaw, receivedRaw, unmatchedCount] = await Promise.all([
      this.contractRepository.createQueryBuilder('contract').select('SUM(contract.totalAmount)', 'amount').where('contract.status <> :status', { status: CONTRACT_STATUS.VOIDED }).getRawOne<{ amount: string | null }>(),
      this.invoiceRepository.createQueryBuilder('invoice').select('SUM(invoice.invoiceAmount)', 'amount').where('invoice.status <> :status', { status: INVOICE_STATUS.VOIDED }).getRawOne<{ amount: string | null }>(),
      this.invoiceRepository.createQueryBuilder('invoice').select('SUM(invoice.matchedAmount)', 'amount').where('invoice.status <> :status', { status: INVOICE_STATUS.VOIDED }).getRawOne<{ amount: string | null }>(),
      this.paymentRepository.createQueryBuilder('payment').select('SUM(payment.amount)', 'amount').getRawOne<{ amount: string | null }>(),
      this.paymentRepository.createQueryBuilder('payment').select('SUM(payment.matchedAmount)', 'amount').getRawOne<{ amount: string | null }>(),
      this.serviceItemRepository.createQueryBuilder('item').select('SUM(item.billableAmount)', 'amount').getRawOne<{ amount: string | null }>(),
      this.serviceItemRepository.createQueryBuilder('item').select('SUM(item.receivedAmount)', 'amount').getRawOne<{ amount: string | null }>(),
      this.paymentRepository.count({ where: { matchStatus: In([...UNMATCHED_PAYMENT_STATUSES]) } }),
    ]);

    const invoiceAmount = Number(invoiceRaw?.amount || 0);
    const invoiceMatchedAmount = Number(invoiceMatchedRaw?.amount || 0);
    const paymentAmount = Number(paymentRaw?.amount || 0);
    const paymentMatchedAmount = Number(paymentMatchedRaw?.amount || 0);
    const receivableAmount = Number(receivableRaw?.amount || 0);
    const receivedAmount = Number(receivedRaw?.amount || 0);

    return {
      contractAmount: Number(contractRaw?.amount || 0),
      invoiceAmount,
      invoiceMatchedAmount,
      invoiceUnmatchedAmount: this.money(invoiceAmount - invoiceMatchedAmount),
      paymentAmount,
      paymentMatchedAmount,
      paymentUnmatchedAmount: this.money(paymentAmount - paymentMatchedAmount),
      receivableAmount,
      receivedAmount,
      unreceivedAmount: this.money(receivableAmount - receivedAmount),
      unmatchedPaymentCount: unmatchedCount,
    };
  }

  async contracts(query: FinanceQuery) {
    const { pageSize, skip } = normalizePage(query);
    const clientId = parseOptionalPositiveInt(query.clientId, '客户ID');
    const qb = this.contractRepository
      .createQueryBuilder('contract')
      .leftJoinAndSelect('contract.client', 'client')
      .loadRelationCountAndMap('contract.lineCount', 'contract.lines')
      .skip(skip)
      .take(pageSize);

    if (clientId)
      qb.andWhere('contract.clientId = :clientId', { clientId });
    if (query.status)
      qb.andWhere('contract.status = :status', { status: query.status });
    if (query.keyword?.trim()) {
      const keyword = `%${query.keyword.trim()}%`;
      qb.andWhere(new Brackets((builder) => {
        builder
          .where('contract.contractNo LIKE :keyword', { keyword })
          .orWhere('contract.title LIKE :keyword', { keyword })
          .orWhere('contract.clientName LIKE :keyword', { keyword })
          .orWhere('client.unitName LIKE :keyword', { keyword });
      }));
    }

    const sort = resolveSort(query.sortKey, query.sortOrder, {
      contractNo: 'contract.contractNo',
      clientName: 'client.unitName',
      title: 'contract.title',
      totalAmount: 'contract.totalAmount',
      signedAt: 'contract.signedAt',
      status: 'contract.status',
      createTime: 'contract.createTime',
      updateTime: 'contract.updateTime',
    });
    if (sort)
      qb.orderBy(sort.column, sort.direction).addOrderBy('contract.id', 'DESC');
    else
      qb.orderBy('contract.id', 'DESC');

    const [rows, total] = await qb.getManyAndCount();
    return pageResult(rows.map(row => this.toContractRow(row)), total);
  }

  async contractDetail(id: number) {
    return this.loadContractDetail(this.dataSource.manager, id);
  }

  async createContract(dto: CreateContractDto) {
    return this.dataSource.transaction(async (manager) => {
      const client = await this.resolveClient(manager.getRepository(Client), dto.clientId);
      const linePatches = await this.resolveServiceItemLines(manager.getRepository(ServiceItem), dto.clientId, dto.lines);
      this.assertAmountEquals(this.sumLinePatches(linePatches), dto.totalAmount, '合同明细合计必须等于合同金额');
      this.assertDateRange(dto.startsAt, dto.endsAt, '合同服务日期');

      const contractRepository = manager.getRepository(FinanceContract);
      const contract = await contractRepository.save(contractRepository.create({
        contractNo: dto.contractNo.trim(),
        clientId: client.id,
        clientName: client.unitName,
        title: dto.title.trim(),
        totalAmount: String(this.money(dto.totalAmount)),
        signedAt: dto.signedAt || null,
        startsAt: dto.startsAt || null,
        endsAt: dto.endsAt || null,
        status: (dto.status || CONTRACT_STATUS.SIGNED) as FinanceContract['status'],
        remark: this.trimNullable(dto.remark),
      }));
      await manager.getRepository(FinanceContractLine).save(linePatches.map(line => manager.getRepository(FinanceContractLine).create({
        ...line,
        contractId: contract.id,
      })));
      return this.loadContractDetail(manager, contract.id);
    });
  }

  async updateContract(id: number, dto: UpdateContractDto) {
    return this.dataSource.transaction(async (manager) => {
      const contractRepository = manager.getRepository(FinanceContract);
      const contract = await contractRepository.findOne({ where: { id } });
      if (!contract)
        throw new NotFoundException('合同不存在');

      const invoiceCount = await manager.getRepository(FinanceInvoice).count({ where: { contractId: id } });
      const changesAccountingScope = this.hasOwn(dto, 'clientId') || this.hasOwn(dto, 'totalAmount') || this.hasOwn(dto, 'lines');
      if (invoiceCount > 0 && changesAccountingScope)
        throw new BadRequestException('合同已关联发票，不能修改客户、金额或明细');

      const clientId = dto.clientId ?? contract.clientId;
      const client = this.hasOwn(dto, 'clientId')
        ? await this.resolveClient(manager.getRepository(Client), clientId)
        : null;
      const totalAmount = dto.totalAmount ?? Number(contract.totalAmount || 0);
      const linePatches = this.hasOwn(dto, 'lines')
        ? await this.resolveServiceItemLines(manager.getRepository(ServiceItem), clientId, dto.lines || [])
        : null;

      if (linePatches)
        this.assertAmountEquals(this.sumLinePatches(linePatches), totalAmount, '合同明细合计必须等于合同金额');
      this.assertDateRange(dto.startsAt ?? contract.startsAt, dto.endsAt ?? contract.endsAt, '合同服务日期');

      Object.assign(contract, {
        contractNo: this.hasOwn(dto, 'contractNo') ? dto.contractNo?.trim() : contract.contractNo,
        clientId,
        clientName: client?.unitName || contract.clientName,
        title: this.hasOwn(dto, 'title') ? dto.title?.trim() : contract.title,
        totalAmount: String(this.money(totalAmount)),
        signedAt: this.hasOwn(dto, 'signedAt') ? dto.signedAt || null : contract.signedAt,
        startsAt: this.hasOwn(dto, 'startsAt') ? dto.startsAt || null : contract.startsAt,
        endsAt: this.hasOwn(dto, 'endsAt') ? dto.endsAt || null : contract.endsAt,
        status: dto.status || contract.status,
        remark: this.hasOwn(dto, 'remark') ? this.trimNullable(dto.remark) : contract.remark,
      });
      this.assertIn(contract.status, CONTRACT_STATUSES, '合同状态');
      await contractRepository.save(contract);

      if (linePatches) {
        await manager.getRepository(FinanceContractLine).softDelete({ contractId: id });
        await manager.getRepository(FinanceContractLine).save(linePatches.map(line => manager.getRepository(FinanceContractLine).create({
          ...line,
          contractId: id,
        })));
      }
      return this.loadContractDetail(manager, id);
    });
  }

  async invoices(query: FinanceQuery) {
    const { pageSize, skip } = normalizePage(query);
    const clientId = parseOptionalPositiveInt(query.clientId, '客户ID');
    const qb = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.client', 'client')
      .leftJoinAndSelect('invoice.contract', 'contract')
      .loadRelationCountAndMap('invoice.lineCount', 'invoice.lines')
      .skip(skip)
      .take(pageSize);

    if (clientId)
      qb.andWhere('invoice.clientId = :clientId', { clientId });
    if (query.status)
      qb.andWhere('invoice.status = :status', { status: query.status });
    if (query.paymentStatus)
      qb.andWhere('invoice.paymentStatus = :paymentStatus', { paymentStatus: query.paymentStatus });
    if (query.deliveryStatus)
      qb.andWhere('invoice.deliveryStatus = :deliveryStatus', { deliveryStatus: query.deliveryStatus });
    if (query.keyword?.trim()) {
      const keyword = `%${query.keyword.trim()}%`;
      qb.andWhere(new Brackets((builder) => {
        builder
          .where('invoice.invoiceNo LIKE :keyword', { keyword })
          .orWhere('invoice.clientName LIKE :keyword', { keyword })
          .orWhere('client.unitName LIKE :keyword', { keyword })
          .orWhere('contract.contractNo LIKE :keyword', { keyword });
      }));
    }
    const sort = resolveSort(query.sortKey, query.sortOrder, {
      invoiceNo: 'invoice.invoiceNo',
      invoiceDate: 'invoice.invoiceDate',
      clientName: 'client.unitName',
      invoiceAmount: 'invoice.invoiceAmount',
      matchedAmount: 'invoice.matchedAmount',
      paymentStatus: 'invoice.paymentStatus',
      deliveryStatus: 'invoice.deliveryStatus',
      status: 'invoice.status',
      createTime: 'invoice.createTime',
      updateTime: 'invoice.updateTime',
    });
    if (sort)
      qb.orderBy(sort.column, sort.direction).addOrderBy('invoice.id', 'DESC');
    else
      qb.orderBy('invoice.invoiceDate', 'DESC').addOrderBy('invoice.id', 'DESC');

    const [rows, total] = await qb.getManyAndCount();
    return pageResult(rows.map(row => this.toInvoiceRow(row)), total);
  }

  async invoiceDetail(id: number) {
    return this.loadInvoiceDetail(this.dataSource.manager, id);
  }

  async createInvoice(dto: CreateInvoiceDto) {
    return this.dataSource.transaction(async (manager) => {
      const client = await this.resolveClient(manager.getRepository(Client), dto.clientId);
      const contract = dto.contractId
        ? await this.resolveContractForInvoice(manager.getRepository(FinanceContract), dto.contractId, dto.clientId, dto.invoiceAmount)
        : null;
      const linePatches = await this.resolveServiceItemLines(manager.getRepository(ServiceItem), dto.clientId, dto.lines);
      this.assertAmountEquals(this.sumLinePatches(linePatches), dto.invoiceAmount, '发票明细合计必须等于发票金额');

      const invoiceRepository = manager.getRepository(FinanceInvoice);
      const invoice = await invoiceRepository.save(invoiceRepository.create({
        invoiceNo: dto.invoiceNo.trim(),
        clientId: client.id,
        contractId: contract?.id || null,
        clientName: client.unitName,
        buyerName: this.trimNullable(dto.buyerName) || client.unitName,
        invoiceDate: dto.invoiceDate,
        invoiceAmount: String(this.money(dto.invoiceAmount)),
        matchedAmount: '0',
        deliveryStatus: (dto.deliveryStatus || INVOICE_DELIVERY_STATUSES[0]) as FinanceInvoice['deliveryStatus'],
        paymentStatus: INVOICE_PAYMENT_STATUS.PENDING,
        status: (dto.status || INVOICE_STATUS.ISSUED) as FinanceInvoice['status'],
        remark: this.trimNullable(dto.remark),
      }));
      await manager.getRepository(FinanceInvoiceLine).save(linePatches.map(line => manager.getRepository(FinanceInvoiceLine).create({
        ...line,
        invoiceId: invoice.id,
      })));
      return this.loadInvoiceDetail(manager, invoice.id);
    });
  }

  async updateInvoice(id: number, dto: UpdateInvoiceDto) {
    return this.dataSource.transaction(async (manager) => {
      const invoiceRepository = manager.getRepository(FinanceInvoice);
      const invoice = await invoiceRepository.findOne({ where: { id } });
      if (!invoice)
        throw new NotFoundException('发票不存在');
      const hasMatched = Number(invoice.matchedAmount || 0) > 0;
      const changesAccountingScope = this.hasOwn(dto, 'clientId') || this.hasOwn(dto, 'contractId') || this.hasOwn(dto, 'invoiceAmount') || this.hasOwn(dto, 'lines') || dto.status === INVOICE_STATUS.VOIDED;
      if (hasMatched && changesAccountingScope)
        throw new BadRequestException('发票已匹配收款，不能修改客户、合同、金额、明细或作废');

      const clientId = dto.clientId ?? invoice.clientId;
      const client = this.hasOwn(dto, 'clientId')
        ? await this.resolveClient(manager.getRepository(Client), clientId)
        : null;
      const invoiceAmount = dto.invoiceAmount ?? Number(invoice.invoiceAmount || 0);
      const contractId = this.hasOwn(dto, 'contractId') ? dto.contractId || null : invoice.contractId || null;
      const contract = contractId
        ? await this.resolveContractForInvoice(manager.getRepository(FinanceContract), contractId, clientId, invoiceAmount)
        : null;
      const linePatches = this.hasOwn(dto, 'lines')
        ? await this.resolveServiceItemLines(manager.getRepository(ServiceItem), clientId, dto.lines || [])
        : null;
      if (linePatches)
        this.assertAmountEquals(this.sumLinePatches(linePatches), invoiceAmount, '发票明细合计必须等于发票金额');

      Object.assign(invoice, {
        invoiceNo: this.hasOwn(dto, 'invoiceNo') ? dto.invoiceNo?.trim() : invoice.invoiceNo,
        clientId,
        contractId: contract?.id || null,
        clientName: client?.unitName || invoice.clientName,
        buyerName: this.hasOwn(dto, 'buyerName') ? this.trimNullable(dto.buyerName) : invoice.buyerName,
        invoiceDate: dto.invoiceDate || invoice.invoiceDate,
        invoiceAmount: String(this.money(invoiceAmount)),
        deliveryStatus: dto.deliveryStatus || invoice.deliveryStatus,
        status: dto.status || invoice.status,
        remark: this.hasOwn(dto, 'remark') ? this.trimNullable(dto.remark) : invoice.remark,
      });
      this.assertIn(invoice.status, INVOICE_STATUSES, '发票状态');
      await invoiceRepository.save(invoice);

      if (linePatches) {
        await manager.getRepository(FinanceInvoiceLine).softDelete({ invoiceId: id });
        await manager.getRepository(FinanceInvoiceLine).save(linePatches.map(line => manager.getRepository(FinanceInvoiceLine).create({
          ...line,
          invoiceId: id,
        })));
      }
      await this.refreshInvoiceStatus(manager, id);
      return this.loadInvoiceDetail(manager, id);
    });
  }

  async payments(query: FinanceQuery) {
    const { pageSize, skip } = normalizePage(query);
    const clientId = parseOptionalPositiveInt(query.clientId, '客户ID');
    const qb = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.client', 'client')
      .loadRelationCountAndMap('payment.matchCount', 'payment.invoiceMatches')
      .skip(skip)
      .take(pageSize);

    if (clientId)
      qb.andWhere('payment.clientId = :clientId', { clientId });
    if (query.matchStatus)
      qb.andWhere('payment.matchStatus = :matchStatus', { matchStatus: query.matchStatus });
    if (query.keyword?.trim()) {
      const keyword = `%${query.keyword.trim()}%`;
      qb.andWhere(new Brackets((builder) => {
        builder
          .where('payment.payerName LIKE :keyword', { keyword })
          .orWhere('payment.clientName LIKE :keyword', { keyword })
          .orWhere('client.unitName LIKE :keyword', { keyword })
          .orWhere('payment.bankSerialNo LIKE :keyword', { keyword })
          .orWhere('payment.bankRemark LIKE :keyword', { keyword });
      }));
    }
    const sort = resolveSort(query.sortKey, query.sortOrder, {
      paymentDate: 'payment.paymentDate',
      payerName: 'payment.payerName',
      clientName: 'client.unitName',
      amount: 'payment.amount',
      matchedAmount: 'payment.matchedAmount',
      matchStatus: 'payment.matchStatus',
      bankSerialNo: 'payment.bankSerialNo',
      createTime: 'payment.createTime',
      updateTime: 'payment.updateTime',
    });
    if (sort)
      qb.orderBy(sort.column, sort.direction).addOrderBy('payment.id', 'DESC');
    else
      qb.orderBy('payment.paymentDate', 'DESC').addOrderBy('payment.id', 'DESC');

    const [rows, total] = await qb.getManyAndCount();
    return pageResult(rows.map(row => this.toPaymentRow(row)), total);
  }

  async paymentDetail(id: number) {
    return this.loadPaymentDetail(this.dataSource.manager, id);
  }

  async createPayment(dto: CreatePaymentDto) {
    const client = dto.clientId ? await this.resolveClient(this.clientRepository, dto.clientId) : null;
    const payment = await this.paymentRepository.save(this.paymentRepository.create({
      paymentDate: dto.paymentDate,
      clientId: client?.id || null,
      clientName: client?.unitName || null,
      payerName: dto.payerName.trim(),
      bankAccount: this.trimNullable(dto.bankAccount),
      bankRemark: this.trimNullable(dto.bankRemark),
      bankSerialNo: this.trimNullable(dto.bankSerialNo),
      amount: String(this.money(dto.amount)),
      matchedAmount: '0',
      matchStatus: PAYMENT_MATCH_STATUS.PENDING,
      remark: this.trimNullable(dto.remark),
    }));
    return this.toPaymentRow(payment);
  }

  async updatePayment(id: number, dto: UpdatePaymentDto) {
    const payment = await this.paymentRepository.findOne({ where: { id } });
    if (!payment)
      throw new NotFoundException('收款不存在');
    const hasMatched = Number(payment.matchedAmount || 0) > 0;
    const changesAccountingScope = this.hasOwn(dto, 'clientId') || this.hasOwn(dto, 'amount');
    if (hasMatched && changesAccountingScope)
      throw new BadRequestException('收款已匹配发票，不能修改客户或金额');

    const client = this.hasOwn(dto, 'clientId') && dto.clientId
      ? await this.resolveClient(this.clientRepository, dto.clientId)
      : null;
    Object.assign(payment, {
      paymentDate: dto.paymentDate || payment.paymentDate,
      clientId: this.hasOwn(dto, 'clientId') ? client?.id || null : payment.clientId,
      clientName: this.hasOwn(dto, 'clientId') ? client?.unitName || null : payment.clientName,
      payerName: this.hasOwn(dto, 'payerName') ? dto.payerName?.trim() : payment.payerName,
      bankAccount: this.hasOwn(dto, 'bankAccount') ? this.trimNullable(dto.bankAccount) : payment.bankAccount,
      bankRemark: this.hasOwn(dto, 'bankRemark') ? this.trimNullable(dto.bankRemark) : payment.bankRemark,
      bankSerialNo: this.hasOwn(dto, 'bankSerialNo') ? this.trimNullable(dto.bankSerialNo) : payment.bankSerialNo,
      amount: this.hasOwn(dto, 'amount') ? String(this.money(dto.amount || 0)) : payment.amount,
      remark: this.hasOwn(dto, 'remark') ? this.trimNullable(dto.remark) : payment.remark,
    });
    await this.paymentRepository.save(payment);
    await this.refreshPaymentStatus(this.dataSource.manager, id);
    return this.paymentDetail(id);
  }

  async matchPayment(id: number, dto: MatchPaymentDto, userId: number) {
    return this.dataSource.transaction(async (manager) => {
      const paymentRepository = manager.getRepository(FinancePayment);
      const payment = await paymentRepository.findOne({ where: { id } });
      if (!payment)
        throw new NotFoundException('收款不存在');

      const normalizedMatches = this.normalizePaymentMatches(dto.matches);
      const totalMatched = this.money(normalizedMatches.reduce((sum, match) => sum + match.matchedAmount, 0));
      if (totalMatched > Number(payment.amount || 0))
        throw new BadRequestException('匹配金额合计不能超过收款金额');

      const previousScope = await this.loadPaymentAllocationScope(manager, id);
      if (previousScope.serviceItemIds.length)
        await this.assertNoConfirmedCommission(manager, previousScope.serviceItemIds);

      const previousMatchIds = await manager.getRepository(PaymentInvoiceMatch)
        .createQueryBuilder('match')
        .select('match.id', 'id')
        .where('match.paymentId = :paymentId', { paymentId: id })
        .getRawMany<{ id: number }>();
      const previousIds = previousMatchIds.map(row => row.id);
      if (previousIds.length) {
        await manager.getRepository(PaymentServiceAllocation).softDelete({ paymentInvoiceMatchId: In(previousIds) });
        await manager.getRepository(PaymentInvoiceMatch).softDelete(previousIds);
      }

      const nextInvoiceIds: number[] = [];
      const nextServiceItemIds: number[] = [];
      for (const matchInput of normalizedMatches) {
        const invoice = await manager.getRepository(FinanceInvoice).findOne({
          where: { id: matchInput.invoiceId },
          relations: { lines: true },
        });
        if (!invoice)
          throw new NotFoundException(`发票不存在：${matchInput.invoiceId}`);
        if (invoice.status === INVOICE_STATUS.VOIDED)
          throw new BadRequestException(`发票 ${invoice.invoiceNo} 已作废，不能匹配收款`);

        const alreadyMatched = await this.sumInvoiceMatchedAmount(manager, invoice.id, payment.id);
        if (this.money(alreadyMatched + matchInput.matchedAmount) > Number(invoice.invoiceAmount || 0))
          throw new BadRequestException(`发票 ${invoice.invoiceNo} 累计匹配金额不能超过发票金额`);
        if (!invoice.lines?.length)
          throw new BadRequestException(`发票 ${invoice.invoiceNo} 没有明细，不能匹配收款`);

        const match = await manager.getRepository(PaymentInvoiceMatch).save(manager.getRepository(PaymentInvoiceMatch).create({
          paymentId: payment.id,
          invoiceId: invoice.id,
          matchedAmount: String(this.money(matchInput.matchedAmount)),
          matchedBy: userId,
          matchedAt: new Date(),
          remark: this.trimNullable(matchInput.remark),
        }));

        const allocations = this.allocatePaymentToInvoiceLines(invoice, matchInput.matchedAmount);
        await manager.getRepository(PaymentServiceAllocation).save(allocations.map(allocation => manager.getRepository(PaymentServiceAllocation).create({
          paymentInvoiceMatchId: match.id,
          invoiceLineId: allocation.invoiceLineId,
          orderServiceItemId: allocation.orderServiceItemId,
          allocatedAmount: String(allocation.allocatedAmount),
        })));
        nextInvoiceIds.push(invoice.id);
        nextServiceItemIds.push(...allocations.map(allocation => allocation.orderServiceItemId));
      }

      const affectedInvoiceIds = this.unique([...previousScope.invoiceIds, ...nextInvoiceIds]);
      const affectedServiceItemIds = this.unique([...previousScope.serviceItemIds, ...nextServiceItemIds]);
      await this.refreshPaymentStatus(manager, payment.id);
      for (const invoiceId of affectedInvoiceIds)
        await this.refreshInvoiceStatus(manager, invoiceId);
      await this.refreshServiceItemReceivedAmounts(manager, affectedServiceItemIds);
      return this.loadPaymentDetail(manager, payment.id);
    });
  }

  async importBankStatement(file: { originalname: string; buffer: Buffer }, user: User) {
    const parsedRows = await this.parseBankStatementFile(file);
    if (!parsedRows.length)
      throw new BadRequestException('未读取到可导入的银行流水');

    const clients = await this.clientRepository.find({ order: { unitName: 'ASC', id: 'ASC' } });
    const existingSerials = await this.loadExistingBankSerials();
    const seenSerials = new Set<string>();
    const batch = await this.paymentImportRepository.save(this.paymentImportRepository.create({
      sourceFileName: normalizeUploadFileName(file.originalname),
      importedBy: user.id,
      importedByName: this.resolveUserDisplayName(user),
      importedAt: new Date(),
      status: IMPORT_BATCH_STATUS.PARSED,
      totalRows: parsedRows.length,
      validRows: 0,
      warningRows: 0,
      errorRows: 0,
      importedRows: 0,
      remark: '银行流水导入',
    }));

    const rows = parsedRows.map((parsedRow) => {
      const validation = this.validateBankStatementRow(parsedRow.raw, clients, existingSerials, seenSerials);
      if (validation.normalized?.bankSerialNo)
        seenSerials.add(validation.normalized.bankSerialNo);
      return this.paymentImportRowRepository.create({
        batchId: batch.id,
        sheetName: parsedRow.sheetName,
        rowNo: parsedRow.rowNo,
        rawJson: parsedRow.raw,
        normalizedJson: validation.normalized,
        validationStatus: validation.status,
        validationMessage: validation.messages.join('；') || null,
        clientId: validation.normalized?.clientId || null,
      });
    });

    const savedRows = await this.paymentImportRowRepository.save(rows);
    await this.refreshPaymentImportBatchSummary(batch.id);
    return this.paymentImportDetail(batch.id, savedRows);
  }

  async paymentImportBatches(query: { pageNo?: number; pageSize?: number }) {
    const { pageSize, skip } = normalizePage(query);
    const [rows, total] = await this.paymentImportRepository.findAndCount({
      order: { id: 'DESC' },
      skip,
      take: pageSize,
    });
    return pageResult(rows.map(row => this.toPaymentImportBatchRow(row)), total);
  }

  async paymentImportDetail(batchId: number, rows?: FinancePaymentImportRow[], query: PaymentImportQuery = {}) {
    const batch = await this.paymentImportRepository.findOne({ where: { id: batchId } });
    if (!batch)
      throw new NotFoundException('银行流水导入批次不存在');
    const { pageSize, skip } = normalizePage(query);
    const validationStatus = this.normalizePaymentImportRowStatus(query.validationStatus);
    let importRows: FinancePaymentImportRow[];
    let rowTotal: number;
    if (rows) {
      const filteredRows = validationStatus ? rows.filter(row => row.validationStatus === validationStatus) : rows;
      rowTotal = filteredRows.length;
      importRows = filteredRows.slice(skip, skip + pageSize);
    }
    else {
      const where = validationStatus ? { batchId, validationStatus } : { batchId };
      [importRows, rowTotal] = await this.paymentImportRowRepository.findAndCount({
        where,
        order: { rowNo: 'ASC', id: 'ASC' },
        skip,
        take: pageSize,
      });
    }
    return {
      ...this.toPaymentImportBatchRow(batch),
      rows: importRows.map(row => this.toPaymentImportRow(row)),
      rowTotal,
    };
  }

  async confirmPaymentImport(batchId: number, dto: ConfirmPaymentImportDto = {}) {
    return this.dataSource.transaction(async (manager) => {
      const batchRepository = manager.getRepository(FinancePaymentImport);
      const rowRepository = manager.getRepository(FinancePaymentImportRow);
      const paymentRepository = manager.getRepository(FinancePayment);
      const batch = await batchRepository.findOne({ where: { id: batchId } });
      if (!batch)
        throw new NotFoundException('银行流水导入批次不存在');
      if (batch.status === IMPORT_BATCH_STATUS.CONFIRMED)
        throw new BadRequestException('该批次已确认入库');

      const decisions = new Map((dto.rows || []).map(row => [Number(row.rowId), row]));
      const rowIds = decisions.size
        ? [...decisions.keys()]
        : this.unique((dto.rowIds || []).map(id => Number(id)));
      const qb = rowRepository
        .createQueryBuilder('row')
        .where('row.batchId = :batchId', { batchId })
        .andWhere('row.validationStatus IN (:...statuses)', { statuses: decisions.size ? [...MANUAL_PAYMENT_ROW_STATUSES] : [...IMPORTABLE_PAYMENT_ROW_STATUSES] });
      if (rowIds.length)
        qb.andWhere('row.id IN (:...rowIds)', { rowIds });
      const rows = await qb.orderBy('row.rowNo', 'ASC').addOrderBy('row.id', 'ASC').getMany();
      if (!rows.length)
        throw new BadRequestException('没有可入库的银行流水明细');

      let importedRows = 0;
      for (const row of rows) {
        const decision = decisions.get(row.id);
        if (decision?.action === 'skip') {
          row.validationStatus = IMPORT_ROW_STATUS.SKIPPED;
          row.validationMessage = this.trimNullable(decision.remark) || '人工跳过';
          await rowRepository.save(row);
          continue;
        }
        if (!IMPORTABLE_PAYMENT_ROW_STATUSES.includes(row.validationStatus))
          continue;
        let normalized = row.normalizedJson as NormalizedPaymentImportRow | null;
        if (!normalized) {
          row.validationStatus = IMPORT_ROW_STATUS.ERROR;
          row.validationMessage = '缺少标准化收款数据';
          await rowRepository.save(row);
          continue;
        }
        if (decision?.clientId) {
          const client = await this.resolveClient(manager.getRepository(Client), decision.clientId);
          normalized = { ...normalized, clientId: client.id, clientName: client.unitName };
          row.normalizedJson = normalized;
          row.clientId = client.id;
        }
        if (normalized.bankSerialNo && await this.bankSerialExists(paymentRepository, normalized.bankSerialNo)) {
          row.validationStatus = IMPORT_ROW_STATUS.SKIPPED;
          row.validationMessage = '银行流水号已存在，已跳过';
          await rowRepository.save(row);
          continue;
        }
        const payment = await paymentRepository.save(paymentRepository.create({
          paymentDate: normalized.paymentDate,
          clientId: normalized.clientId,
          clientName: normalized.clientName,
          payerName: normalized.payerName,
          bankAccount: normalized.bankAccount,
          bankRemark: normalized.bankRemark,
          bankSerialNo: normalized.bankSerialNo,
          amount: String(this.money(normalized.amount)),
          matchedAmount: '0',
          matchStatus: PAYMENT_MATCH_STATUS.PENDING,
          remark: this.buildPaymentImportRemark(normalizeUploadFileName(batch.sourceFileName), decision?.remark),
        }));
        row.validationStatus = IMPORT_ROW_STATUS.IMPORTED;
        row.paymentId = payment.id;
        row.clientId = normalized.clientId;
        row.validationMessage = '已生成收款';
        await rowRepository.save(row);
        importedRows += 1;
      }

      const remainingRows = await rowRepository.count({ where: { batchId, validationStatus: In([...IMPORTABLE_PAYMENT_ROW_STATUSES]) } });
      batch.status = remainingRows > 0 ? IMPORT_BATCH_STATUS.PARSED : IMPORT_BATCH_STATUS.CONFIRMED;
      batch.importedRows = Number(batch.importedRows || 0) + importedRows;
      await batchRepository.save(batch);
      await this.refreshPaymentImportBatchSummary(batch.id, manager);
      return this.paymentImportDetail(batch.id);
    });
  }

  private async parseBankStatementFile(file: { originalname: string; buffer: Buffer }) {
    const sheets = await this.spreadsheetService.readSheets(file, {
      allowedExtensions: ['.xlsx'],
      parseErrorMessage: '无法解析银行流水 Excel，请确认文件未损坏且为 xlsx 格式',
    });
    return sheets.flatMap(sheet => this.parseBankStatementSheet(sheet));
  }

  private parseBankStatementSheet(sheet: SpreadsheetSheetRows): ParsedBankStatementRow[] {
    const headerIndex = this.findBankStatementHeaderIndex(sheet.rows);
    if (headerIndex < 0)
      return [];
    const headers = sheet.rows[headerIndex];
    return sheet.rows.slice(headerIndex + 1).map((values, index) => ({
      sheetName: sheet.sheetName,
      rowNo: headerIndex + index + 2,
      raw: this.mapSpreadsheetRow(headers, values),
    })).filter(row => Object.values(row.raw).some(value => String(value || '').trim()));
  }

  private findBankStatementHeaderIndex(rows: string[][]) {
    let bestIndex = -1;
    let bestScore = 0;
    rows.forEach((row, index) => {
      const headers = row.map(cell => this.normalizeHeader(cell));
      const score = Object.values(BANK_STATEMENT_HEADER_ALIASES).reduce((sum, aliases) => (
        sum + (aliases.some(alias => headers.includes(this.normalizeHeader(alias))) ? 1 : 0)
      ), 0);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    return bestScore >= 2 ? bestIndex : -1;
  }

  private mapSpreadsheetRow(headers: string[], values: string[]) {
    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      const key = header?.trim() || `列${index + 1}`;
      row[key] = values[index] ?? '';
    });
    return row;
  }

  private validateBankStatementRow(
    raw: Record<string, unknown>,
    clients: Client[],
    existingSerials: Set<string>,
    seenSerials: Set<string>,
  ): PaymentImportValidation {
    const messages: string[] = [];
    const paymentDate = this.parsePaymentImportDate(this.pickImportText(raw, BANK_STATEMENT_HEADER_ALIASES.paymentDate));
    const amount = this.parsePaymentImportAmount(this.pickImportText(raw, BANK_STATEMENT_HEADER_ALIASES.amount));
    const payerName = this.pickImportText(raw, BANK_STATEMENT_HEADER_ALIASES.payerName);
    const bankAccount = this.trimNullable(this.pickImportText(raw, BANK_STATEMENT_HEADER_ALIASES.bankAccount));
    const bankRemark = this.trimNullable(this.pickImportText(raw, BANK_STATEMENT_HEADER_ALIASES.bankRemark));
    const bankSerialNo = this.trimNullable(this.pickImportText(raw, BANK_STATEMENT_HEADER_ALIASES.bankSerialNo));

    if (!paymentDate)
      messages.push('交易日期无效');
    if (amount <= 0)
      messages.push('收入金额必须大于0');
    if (!payerName)
      messages.push('付款方不能为空');
    if (bankSerialNo && existingSerials.has(bankSerialNo))
      messages.push('银行流水号已存在');
    if (bankSerialNo && seenSerials.has(bankSerialNo))
      messages.push('银行流水号在本文件中重复');

    if (!paymentDate || amount <= 0 || !payerName || (bankSerialNo && (existingSerials.has(bankSerialNo) || seenSerials.has(bankSerialNo)))) {
      return { status: IMPORT_ROW_STATUS.ERROR, messages, normalized: null };
    }

    const matchedClients = this.matchPaymentImportClient(payerName, clients);
    if (!matchedClients.length)
      messages.push('未自动匹配客户，可入库后人工补充客户');
    if (matchedClients.length > 1)
      messages.push('付款方匹配到多个客户，请入库后人工确认客户');
    const matchedClient = matchedClients.length === 1 ? matchedClients[0] : null;

    return {
      status: messages.length ? IMPORT_ROW_STATUS.WARNING : IMPORT_ROW_STATUS.VALID,
      messages,
      normalized: {
        paymentDate,
        amount,
        payerName,
        bankAccount,
        bankRemark,
        bankSerialNo,
        clientId: matchedClient?.id || null,
        clientName: matchedClient?.unitName || null,
      },
    };
  }

  private pickImportText(raw: Record<string, unknown>, aliases: string[]) {
    const entries = Object.entries(raw);
    for (const alias of aliases) {
      const normalizedAlias = this.normalizeHeader(alias);
      const entry = entries.find(([key]) => this.normalizeHeader(key) === normalizedAlias);
      if (entry)
        return String(entry[1] ?? '').trim();
    }
    return '';
  }

  private parsePaymentImportDate(value: string) {
    const text = value.trim();
    if (!text)
      return '';
    const serial = Number(text);
    if (Number.isFinite(serial) && serial > 20000 && serial < 60000) {
      const date = new Date(Date.UTC(1899, 11, 30 + Math.floor(serial)));
      return date.toISOString().slice(0, 10);
    }
    const match = text.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
    if (!match)
      return '';
    const month = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    return `${match[1]}-${month}-${day}`;
  }

  private parsePaymentImportAmount(value: string) {
    const text = value.replace(/[,\s￥¥]/g, '').trim();
    if (!text)
      return 0;
    const amount = Number(text);
    return Number.isFinite(amount) ? this.money(amount) : 0;
  }

  private matchPaymentImportClient(payerName: string, clients: Client[]) {
    const normalizedPayer = this.normalizeMatchText(payerName);
    if (!normalizedPayer)
      return [];
    return clients.filter((client) => {
      const normalizedUnitName = this.normalizeMatchText(client.unitName);
      return normalizedUnitName && (normalizedPayer.includes(normalizedUnitName) || normalizedUnitName.includes(normalizedPayer));
    });
  }

  private async loadExistingBankSerials() {
    const rows = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('payment.bankSerialNo', 'bankSerialNo')
      .where('payment.bankSerialNo IS NOT NULL')
      .andWhere("payment.bankSerialNo <> ''")
      .getRawMany<{ bankSerialNo: string }>();
    return new Set(rows.map(row => row.bankSerialNo));
  }

  private async bankSerialExists(repository: Repository<FinancePayment>, bankSerialNo: string) {
    return repository.exists({ where: { bankSerialNo } });
  }

  private async refreshPaymentImportBatchSummary(batchId: number, manager: EntityManager = this.dataSource.manager) {
    const rowRepository = manager.getRepository(FinancePaymentImportRow);
    const batchRepository = manager.getRepository(FinancePaymentImport);
    const rows = await rowRepository.find({ where: { batchId } });
    const batch = await batchRepository.findOne({ where: { id: batchId } });
    if (!batch)
      return;
    batch.totalRows = rows.length;
    batch.validRows = rows.filter(row => row.validationStatus === IMPORT_ROW_STATUS.VALID).length;
    batch.warningRows = rows.filter(row => row.validationStatus === IMPORT_ROW_STATUS.WARNING).length;
    batch.errorRows = rows.filter(row => row.validationStatus === IMPORT_ROW_STATUS.ERROR).length;
    batch.importedRows = rows.filter(row => row.validationStatus === IMPORT_ROW_STATUS.IMPORTED).length;
    await batchRepository.save(batch);
  }

  private normalizePaymentImportRowStatus(status?: string | null): FinancePaymentImportRowStatus | undefined {
    if (!status)
      return undefined;
    const allowed: readonly FinancePaymentImportRowStatus[] = IMPORT_ROW_STATUSES;
    if (!allowed.includes(status as FinancePaymentImportRowStatus))
      throw new BadRequestException('导入明细状态无效');
    return status as FinancePaymentImportRowStatus;
  }

  private toPaymentImportBatchRow(row: FinancePaymentImport) {
    return {
      id: row.id,
      sourceFileName: normalizeUploadFileName(row.sourceFileName),
      importedBy: row.importedBy,
      importedByName: row.importedByName,
      importedAt: row.importedAt,
      status: row.status,
      totalRows: row.totalRows,
      validRows: row.validRows,
      warningRows: row.warningRows,
      errorRows: row.errorRows,
      importedRows: row.importedRows,
      remark: row.remark,
      createTime: row.createTime,
      updateTime: row.updateTime,
    };
  }

  private toPaymentImportRow(row: FinancePaymentImportRow) {
    return {
      id: row.id,
      batchId: row.batchId,
      sheetName: row.sheetName,
      rowNo: row.rowNo,
      rawJson: row.rawJson,
      normalizedJson: row.normalizedJson,
      validationStatus: row.validationStatus,
      validationMessage: row.validationMessage,
      clientId: row.clientId,
      paymentId: row.paymentId,
      createTime: row.createTime,
      updateTime: row.updateTime,
    };
  }

  private buildPaymentImportRemark(sourceFileName: string, remark?: string | null) {
    const detail = this.trimNullable(remark);
    return detail ? `银行流水导入：${sourceFileName}；${detail}` : `银行流水导入：${sourceFileName}`;
  }

  private resolveUserDisplayName(user: User) {
    return user.employeeProfile?.name || user.nickName || user.username;
  }

  private normalizeHeader(value: string) {
    return String(value || '').replace(/[\s*：:]/g, '').trim();
  }

  private normalizeMatchText(value: string) {
    return String(value || '').replace(/\s/g, '').trim();
  }

  private normalizePaymentMatches(matches: MatchPaymentDto['matches']) {
    const seen = new Set<number>();
    return matches.map((match) => {
      if (seen.has(match.invoiceId))
        throw new BadRequestException('同一笔收款不能重复匹配同一张发票');
      seen.add(match.invoiceId);
      const matchedAmount = this.money(match.matchedAmount);
      if (matchedAmount <= 0)
        throw new BadRequestException('匹配金额必须大于0');
      return { invoiceId: match.invoiceId, matchedAmount, remark: match.remark };
    });
  }

  private allocatePaymentToInvoiceLines(invoice: FinanceInvoice, matchedAmount: number) {
    const invoiceAmount = Number(invoice.invoiceAmount || 0);
    if (invoiceAmount <= 0)
      throw new BadRequestException(`发票 ${invoice.invoiceNo} 金额必须大于0`);
    const lines = [...invoice.lines].sort((left, right) => left.id - right.id);
    let allocated = 0;
    return lines.map((line, index) => {
      const amount = index === lines.length - 1
        ? this.money(matchedAmount - allocated)
        : this.money(matchedAmount * Number(line.amount || 0) / invoiceAmount);
      allocated = this.money(allocated + amount);
      return {
        invoiceLineId: line.id,
        orderServiceItemId: line.orderServiceItemId,
        allocatedAmount: amount,
      };
    }).filter(allocation => allocation.allocatedAmount > 0);
  }

  private async loadContractDetail(manager: EntityManager, id: number) {
    const contract = await manager.getRepository(FinanceContract).findOne({
      where: { id },
      relations: { client: true, lines: { serviceItem: true } },
    });
    if (!contract)
      throw new NotFoundException('合同不存在');
    return this.toContractRow(contract, true);
  }

  private async loadInvoiceDetail(manager: EntityManager, id: number) {
    const invoice = await manager.getRepository(FinanceInvoice).findOne({
      where: { id },
      relations: {
        client: true,
        contract: true,
        lines: { serviceItem: true },
        paymentMatches: { payment: true, allocations: { serviceItem: true } },
      },
    });
    if (!invoice)
      throw new NotFoundException('发票不存在');
    return this.toInvoiceRow(invoice, true);
  }

  private async loadPaymentDetail(manager: EntityManager, id: number) {
    const payment = await manager.getRepository(FinancePayment).findOne({
      where: { id },
      relations: {
        client: true,
        invoiceMatches: { invoice: true, allocations: { serviceItem: true } },
      },
    });
    if (!payment)
      throw new NotFoundException('收款不存在');
    return this.toPaymentRow(payment, true);
  }

  private async loadPaymentAllocationScope(manager: EntityManager, paymentId: number): Promise<AllocationRefreshScope> {
    const rows = await manager.getRepository(PaymentServiceAllocation)
      .createQueryBuilder('allocation')
      .innerJoin('allocation.paymentInvoiceMatch', 'match')
      .where('match.paymentId = :paymentId', { paymentId })
      .select('match.invoiceId', 'invoiceId')
      .addSelect('allocation.orderServiceItemId', 'serviceItemId')
      .getRawMany<{ invoiceId: number; serviceItemId: number }>();
    return {
      invoiceIds: this.unique(rows.map(row => Number(row.invoiceId))),
      serviceItemIds: this.unique(rows.map(row => Number(row.serviceItemId))),
    };
  }

  private async assertNoConfirmedCommission(manager: EntityManager, serviceItemIds: number[]) {
    const line = await manager.getRepository(CommissionLine)
      .createQueryBuilder('line')
      .innerJoin('line.settlement', 'settlement')
      .where('line.orderServiceItemId IN (:...serviceItemIds)', { serviceItemIds })
      .andWhere('settlement.status IN (:...statuses)', { statuses: [...SETTLED_COMMISSION_STATUSES] })
      .getOne();
    if (line)
      throw new BadRequestException('相关服务项已有已确认或已发放提成，不能重做收款匹配');
  }

  private async refreshPaymentStatus(manager: EntityManager, paymentId: number) {
    const paymentRepository = manager.getRepository(FinancePayment);
    const payment = await paymentRepository.findOne({ where: { id: paymentId } });
    if (!payment)
      return;
    const matchedAmount = await manager.getRepository(PaymentInvoiceMatch)
      .createQueryBuilder('match')
      .select('SUM(match.matchedAmount)', 'amount')
      .where('match.paymentId = :paymentId', { paymentId })
      .getRawOne<{ amount: string | null }>();
    const amount = Number(payment.amount || 0);
    const matched = this.money(Number(matchedAmount?.amount || 0));
    payment.matchedAmount = String(matched);
    payment.matchStatus = matched <= 0 ? PAYMENT_MATCH_STATUS.PENDING : (matched < amount ? PAYMENT_MATCH_STATUS.PARTIAL : PAYMENT_MATCH_STATUS.MATCHED);
    const latestMatch = await manager.getRepository(PaymentInvoiceMatch).findOne({
      where: { paymentId },
      order: { id: 'ASC' },
    });
    payment.matchedInvoiceId = latestMatch?.invoiceId || null;
    await paymentRepository.save(payment);
  }

  private async refreshInvoiceStatus(manager: EntityManager, invoiceId: number) {
    const invoiceRepository = manager.getRepository(FinanceInvoice);
    const invoice = await invoiceRepository.findOne({ where: { id: invoiceId } });
    if (!invoice)
      return;
    const matchedAmount = await manager.getRepository(PaymentInvoiceMatch)
      .createQueryBuilder('match')
      .select('SUM(match.matchedAmount)', 'amount')
      .where('match.invoiceId = :invoiceId', { invoiceId })
      .getRawOne<{ amount: string | null }>();
    const amount = Number(invoice.invoiceAmount || 0);
    const matched = this.money(Number(matchedAmount?.amount || 0));
    invoice.matchedAmount = String(matched);
    invoice.paymentStatus = matched <= 0 ? INVOICE_PAYMENT_STATUS.PENDING : (matched < amount ? INVOICE_PAYMENT_STATUS.PARTIAL : INVOICE_PAYMENT_STATUS.PAID);
    await invoiceRepository.save(invoice);
  }

  private async refreshServiceItemReceivedAmounts(manager: EntityManager, serviceItemIds: number[]) {
    const uniqueIds = this.unique(serviceItemIds);
    for (const serviceItemId of uniqueIds) {
      const raw = await manager.getRepository(PaymentServiceAllocation)
        .createQueryBuilder('allocation')
        .select('SUM(allocation.allocatedAmount)', 'amount')
        .where('allocation.orderServiceItemId = :serviceItemId', { serviceItemId })
        .getRawOne<{ amount: string | null }>();
      await manager.getRepository(ServiceItem).update(serviceItemId, {
        receivedAmount: String(this.money(Number(raw?.amount || 0))),
      });
    }
  }

  private async sumInvoiceMatchedAmount(manager: EntityManager, invoiceId: number, excludedPaymentId: number) {
    const raw = await manager.getRepository(PaymentInvoiceMatch)
      .createQueryBuilder('match')
      .select('SUM(match.matchedAmount)', 'amount')
      .where('match.invoiceId = :invoiceId', { invoiceId })
      .andWhere('match.paymentId <> :excludedPaymentId', { excludedPaymentId })
      .getRawOne<{ amount: string | null }>();
    return this.money(Number(raw?.amount || 0));
  }

  private async resolveClient(repository: Repository<Client>, clientId: number) {
    const client = await repository.findOne({ where: { id: clientId } });
    if (!client)
      throw new NotFoundException('客户不存在');
    return client;
  }

  private async resolveContractForInvoice(repository: Repository<FinanceContract>, contractId: number, clientId: number, invoiceAmount: number) {
    const contract = await repository.findOne({ where: { id: contractId } });
    if (!contract)
      throw new NotFoundException('合同不存在');
    if (contract.status === CONTRACT_STATUS.VOIDED)
      throw new BadRequestException('已作废合同不能开票');
    if (contract.clientId !== clientId)
      throw new BadRequestException('发票客户必须与合同客户一致');
    this.assertAmountEquals(Number(contract.totalAmount || 0), invoiceAmount, '关联合同时发票金额必须等于合同金额');
    return contract;
  }

  private async resolveServiceItemLines(repository: Repository<ServiceItem>, clientId: number, lines: FinanceServiceItemLineDto[]) {
    if (!lines.length)
      throw new BadRequestException('至少需要一条服务项明细');
    const seen = new Set<number>();
    for (const line of lines) {
      if (seen.has(line.orderServiceItemId))
        throw new BadRequestException('同一单据不能重复选择同一个服务项');
      seen.add(line.orderServiceItemId);
      if (this.money(line.amount) <= 0)
        throw new BadRequestException('服务项明细金额必须大于0');
    }

    const serviceItems = await repository.findBy({ id: In(lines.map(line => line.orderServiceItemId)) });
    if (serviceItems.length !== lines.length)
      throw new BadRequestException('服务项明细包含不存在的服务项');
    const serviceItemMap = new Map(serviceItems.map(item => [item.id, item]));
    return lines.map((line): FinanceLinePatch => {
      const serviceItem = serviceItemMap.get(line.orderServiceItemId);
      if (!serviceItem)
        throw new BadRequestException('服务项明细包含不存在的服务项');
      if (serviceItem.clientId !== clientId)
        throw new BadRequestException(`服务项 ${serviceItem.orderNo} / ${serviceItem.serviceName} 不属于所选客户`);
      return {
        orderServiceItemId: serviceItem.id,
        amount: String(this.money(line.amount)),
        description: this.trimNullable(line.description) || serviceItem.serviceName,
      };
    });
  }

  private sumLinePatches(lines: FinanceLinePatch[]) {
    return this.money(lines.reduce((sum, line) => sum + Number(line.amount || 0), 0));
  }

  private toContractRow(row: FinanceContract, detail = false) {
    const rowWithCount = row as FinanceContract & { lineCount?: number };
    return {
      id: row.id,
      contractNo: row.contractNo,
      clientId: row.clientId,
      clientName: row.client?.unitName || row.clientName,
      historicalClientName: row.clientName,
      title: row.title,
      totalAmount: Number(row.totalAmount || 0),
      signedAt: row.signedAt,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      status: row.status,
      remark: row.remark,
      lineCount: rowWithCount.lineCount || row.lines?.length || 0,
      lines: detail ? (row.lines || []).map(line => this.toDocumentLineRow(line)) : undefined,
      createTime: row.createTime,
      updateTime: row.updateTime,
    };
  }

  private toInvoiceRow(row: FinanceInvoice, detail = false) {
    const rowWithCount = row as FinanceInvoice & { lineCount?: number };
    return {
      id: row.id,
      invoiceNo: row.invoiceNo,
      clientId: row.clientId,
      contractId: row.contractId,
      contractNo: row.contract?.contractNo || null,
      clientName: row.client?.unitName || row.clientName,
      currentClientName: row.client?.unitName || null,
      historicalClientName: row.clientName,
      buyerName: row.buyerName,
      invoiceDate: row.invoiceDate,
      invoiceAmount: Number(row.invoiceAmount || 0),
      matchedAmount: Number(row.matchedAmount || 0),
      unmatchedAmount: this.money(Number(row.invoiceAmount || 0) - Number(row.matchedAmount || 0)),
      deliveryStatus: row.deliveryStatus,
      paymentStatus: row.paymentStatus,
      status: row.status,
      remark: row.remark,
      lineCount: rowWithCount.lineCount || row.lines?.length || 0,
      lines: detail ? (row.lines || []).map(line => this.toDocumentLineRow(line)) : undefined,
      matches: detail ? (row.paymentMatches || []).map(match => this.toMatchRow(match)) : undefined,
      createTime: row.createTime,
      updateTime: row.updateTime,
    };
  }

  private toPaymentRow(row: FinancePayment, detail = false) {
    const rowWithCount = row as FinancePayment & { matchCount?: number };
    return {
      id: row.id,
      paymentDate: row.paymentDate,
      clientId: row.clientId,
      clientName: row.client?.unitName || row.clientName,
      currentClientName: row.client?.unitName || null,
      historicalClientName: row.clientName,
      payerName: row.payerName,
      bankAccount: row.bankAccount,
      bankRemark: row.bankRemark,
      bankSerialNo: row.bankSerialNo,
      amount: Number(row.amount || 0),
      matchedAmount: Number(row.matchedAmount || 0),
      unmatchedAmount: this.money(Number(row.amount || 0) - Number(row.matchedAmount || 0)),
      matchStatus: row.matchStatus,
      matchedInvoiceId: row.matchedInvoiceId,
      matchCount: rowWithCount.matchCount || row.invoiceMatches?.length || 0,
      remark: row.remark,
      matches: detail ? (row.invoiceMatches || []).map(match => this.toMatchRow(match)) : undefined,
      createTime: row.createTime,
      updateTime: row.updateTime,
    };
  }

  private toDocumentLineRow(line: FinanceContractLine | FinanceInvoiceLine) {
    return {
      id: line.id,
      orderServiceItemId: line.orderServiceItemId,
      orderNo: line.serviceItem?.orderNo,
      clientName: line.serviceItem?.unitName,
      serviceYear: line.serviceItem?.serviceYear,
      serviceCode: line.serviceItem?.serviceCode,
      serviceName: line.serviceItem?.serviceName,
      amount: Number(line.amount || 0),
      description: line.description,
    };
  }

  private toMatchRow(match: PaymentInvoiceMatch) {
    return {
      id: match.id,
      paymentId: match.paymentId,
      paymentDate: match.payment?.paymentDate,
      payerName: match.payment?.payerName,
      invoiceId: match.invoiceId,
      invoiceNo: match.invoice?.invoiceNo,
      matchedAmount: Number(match.matchedAmount || 0),
      matchedBy: match.matchedBy,
      matchedAt: match.matchedAt,
      remark: match.remark,
      allocations: (match.allocations || []).map(allocation => ({
        id: allocation.id,
        invoiceLineId: allocation.invoiceLineId,
        orderServiceItemId: allocation.orderServiceItemId,
        orderNo: allocation.serviceItem?.orderNo,
        clientName: allocation.serviceItem?.unitName,
        serviceName: allocation.serviceItem?.serviceName,
        allocatedAmount: Number(allocation.allocatedAmount || 0),
      })),
    };
  }

  private assertAmountEquals(actual: number, expected: number, message: string) {
    if (this.money(actual) !== this.money(expected))
      throw new BadRequestException(message);
  }

  private assertDateRange(start: string | null | undefined, end: string | null | undefined, label: string) {
    if (start && end && start > end)
      throw new BadRequestException(`${label}开始日期不能晚于结束日期`);
  }

  private assertIn(value: string, allowed: readonly string[], fieldName: string) {
    if (!allowed.includes(value))
      throw new BadRequestException(`${fieldName}取值无效`);
  }

  private money(value: number) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  private trimNullable(value?: string | null) {
    return value?.trim() || null;
  }

  private unique(values: number[]) {
    return [...new Set(values.filter(value => Number.isInteger(value) && value > 0))];
  }

  private hasOwn<T extends object>(target: T, key: keyof T) {
    return Object.prototype.hasOwnProperty.call(target, key) && target[key] !== undefined;
  }
}
