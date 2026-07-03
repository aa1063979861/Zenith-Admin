export const CLIENT_UNIT_STATUSES = ['NORMAL', 'CANCELLED', 'MERGED', 'DISABLED'] as const;
export type ClientUnitStatus = typeof CLIENT_UNIT_STATUSES[number];
export const CLIENT_UNIT_STATUS = {
  NORMAL: 'NORMAL',
  CANCELLED: 'CANCELLED',
  MERGED: 'MERGED',
  DISABLED: 'DISABLED',
} as const;

export const CUSTOMER_LEVELS = ['NORMAL', 'IMPORTANT', 'CORE', 'STRATEGIC'] as const;
export type CustomerLevel = typeof CUSTOMER_LEVELS[number];
export const CUSTOMER_LEVEL = {
  NORMAL: 'NORMAL',
  IMPORTANT: 'IMPORTANT',
  CORE: 'CORE',
  STRATEGIC: 'STRATEGIC',
} as const;

export const CLIENT_CONTACT_ROLES = ['LEGAL_PERSON', 'FINANCE', 'ACCOUNTANT', 'ASSET_MANAGER', 'REPORT_CONTACT', 'HANDLER', 'UNIT_MANAGER', 'OTHER'] as const;
export type ClientContactRole = typeof CLIENT_CONTACT_ROLES[number];

export const IMPORT_BATCH_STATUSES = ['parsed', 'confirmed', 'failed'] as const;
export type ImportBatchStatus = typeof IMPORT_BATCH_STATUSES[number];
export const IMPORT_BATCH_STATUS = {
  PARSED: 'parsed',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
} as const;

export const IMPORT_ROW_STATUSES = ['valid', 'warning', 'error', 'imported', 'skipped'] as const;
export type ImportRowStatus = typeof IMPORT_ROW_STATUSES[number];
export const IMPORT_ROW_STATUS = {
  VALID: 'valid',
  WARNING: 'warning',
  ERROR: 'error',
  IMPORTED: 'imported',
  SKIPPED: 'skipped',
} as const;

export const IMPORT_CONFIRM_ACTIONS = ['import', 'skip'] as const;
export type ImportConfirmAction = typeof IMPORT_CONFIRM_ACTIONS[number];

export const CONTRACT_STATUSES = ['草稿', '已签订', '已作废'] as const;
export type ContractStatus = typeof CONTRACT_STATUSES[number];
export const CONTRACT_STATUS = {
  DRAFT: '草稿',
  SIGNED: '已签订',
  VOIDED: '已作废',
} as const;

export const INVOICE_STATUSES = ['已开具', '已作废'] as const;
export type InvoiceStatus = typeof INVOICE_STATUSES[number];
export const INVOICE_STATUS = {
  ISSUED: '已开具',
  VOIDED: '已作废',
} as const;

export const INVOICE_DELIVERY_STATUSES = ['未送达', '已送达', '单位已确认'] as const;
export type InvoiceDeliveryStatus = typeof INVOICE_DELIVERY_STATUSES[number];

export const INVOICE_PAYMENT_STATUSES = ['待收款', '部分收款', '已收齐'] as const;
export type InvoicePaymentStatus = typeof INVOICE_PAYMENT_STATUSES[number];
export const INVOICE_PAYMENT_STATUS = {
  PENDING: '待收款',
  PARTIAL: '部分收款',
  PAID: '已收齐',
} as const;

export const SERVICE_COLLECTION_STATUSES = ['待收款', '部分收款', '已收齐', '无需收款'] as const;
export type ServiceCollectionStatus = typeof SERVICE_COLLECTION_STATUSES[number];
export const SERVICE_COLLECTION_STATUS = {
  PENDING: '待收款',
  PARTIAL: '部分收款',
  PAID: '已收齐',
  NOT_REQUIRED: '无需收款',
} as const;

export const ARCHIVE_WEEKLY_REPORT_STATUSES = ['草稿', '已提交'] as const;
export type ArchiveWeeklyReportStatus = typeof ARCHIVE_WEEKLY_REPORT_STATUSES[number];
export const ARCHIVE_WEEKLY_REPORT_STATUS = {
  DRAFT: '草稿',
  SUBMITTED: '已提交',
} as const;

export const ARCHIVE_WEEKLY_REPORT_SOURCE_TYPE = {
  MANUAL: '手工填写',
  GENERATED: '系统生成',
} as const;

export const PAYMENT_MATCH_STATUSES = ['待匹配', '部分匹配', '已匹配'] as const;
export type PaymentMatchStatus = typeof PAYMENT_MATCH_STATUSES[number];
export const PAYMENT_MATCH_STATUS = {
  PENDING: '待匹配',
  PARTIAL: '部分匹配',
  MATCHED: '已匹配',
} as const;

export const COMMISSION_SETTLEMENT_STATUSES = ['draft', 'confirmed', 'paid', 'cancelled'] as const;
export type CommissionSettlementStatus = typeof COMMISSION_SETTLEMENT_STATUSES[number];
export const COMMISSION_SETTLEMENT_STATUS = {
  DRAFT: 'draft',
  CONFIRMED: 'confirmed',
  PAID: 'paid',
  CANCELLED: 'cancelled',
} as const;

export const COMMISSION_ITEM_SETTLEMENT_STATUS = {
  PENDING_COLLECTION: '待收款',
  SETTLEABLE: '可结算',
  SETTLED: '已结算',
} as const;
