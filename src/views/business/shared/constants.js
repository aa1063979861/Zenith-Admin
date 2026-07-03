export const CLIENT_UNIT_STATUS = {
  NORMAL: 'NORMAL',
  CANCELLED: 'CANCELLED',
  MERGED: 'MERGED',
  DISABLED: 'DISABLED',
}

export const CLIENT_UNIT_STATUS_META = {
  [CLIENT_UNIT_STATUS.NORMAL]: { label: '正常', type: 'success' },
  [CLIENT_UNIT_STATUS.CANCELLED]: { label: '已撤销', type: 'warning' },
  [CLIENT_UNIT_STATUS.MERGED]: { label: '已合并', type: 'info' },
  [CLIENT_UNIT_STATUS.DISABLED]: { label: '停用', type: 'default' },
}

export const CUSTOMER_STAGE_META = {
  POTENTIAL: { label: '潜在客户', type: 'warning' },
  FORMAL: { label: '已成交客户', type: 'success' },
}

export const CUSTOMER_LEVEL = {
  NORMAL: 'NORMAL',
  IMPORTANT: 'IMPORTANT',
  CORE: 'CORE',
  STRATEGIC: 'STRATEGIC',
}

export const CUSTOMER_LEVEL_META = {
  [CUSTOMER_LEVEL.NORMAL]: { label: '普通客户', type: 'default' },
  [CUSTOMER_LEVEL.IMPORTANT]: { label: '重点客户', type: 'info' },
  [CUSTOMER_LEVEL.CORE]: { label: '核心客户', type: 'success' },
  [CUSTOMER_LEVEL.STRATEGIC]: { label: '战略客户', type: 'warning' },
}

export const CONTACT_ROLE = {
  LEGAL_PERSON: 'LEGAL_PERSON',
  FINANCE: 'FINANCE',
  ACCOUNTANT: 'ACCOUNTANT',
  ASSET_MANAGER: 'ASSET_MANAGER',
  REPORT_CONTACT: 'REPORT_CONTACT',
  HANDLER: 'HANDLER',
  UNIT_MANAGER: 'UNIT_MANAGER',
  OTHER: 'OTHER',
}

export const CONTACT_ROLE_LABELS = {
  [CONTACT_ROLE.LEGAL_PERSON]: '法人',
  [CONTACT_ROLE.FINANCE]: '财务联系人',
  [CONTACT_ROLE.ACCOUNTANT]: '会计',
  [CONTACT_ROLE.ASSET_MANAGER]: '资产负责人',
  [CONTACT_ROLE.REPORT_CONTACT]: '报表联系人',
  [CONTACT_ROLE.HANDLER]: '经办人',
  [CONTACT_ROLE.UNIT_MANAGER]: '单位负责人',
  [CONTACT_ROLE.OTHER]: '其他',
}

export const IMPORT_BATCH_STATUS = {
  PARSED: 'parsed',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
}

export const IMPORT_BATCH_STATUS_META = {
  [IMPORT_BATCH_STATUS.PARSED]: { label: '待确认', type: 'warning' },
  [IMPORT_BATCH_STATUS.CONFIRMED]: { label: '已确认', type: 'success' },
  [IMPORT_BATCH_STATUS.FAILED]: { label: '失败', type: 'error' },
}

export const IMPORT_ROW_STATUS = {
  VALID: 'valid',
  WARNING: 'warning',
  ERROR: 'error',
  IMPORTED: 'imported',
  SKIPPED: 'skipped',
}

export const IMPORT_ROW_STATUS_META = {
  [IMPORT_ROW_STATUS.VALID]: { label: '有效', type: 'success' },
  [IMPORT_ROW_STATUS.WARNING]: { label: '警告', type: 'warning' },
  [IMPORT_ROW_STATUS.ERROR]: { label: '错误', type: 'error' },
  [IMPORT_ROW_STATUS.IMPORTED]: { label: '已入库', type: 'success' },
  [IMPORT_ROW_STATUS.SKIPPED]: { label: '已跳过', type: 'default' },
}

export const CONTRACT_STATUS = {
  DRAFT: '草稿',
  SIGNED: '已签订',
  VOIDED: '已作废',
}

export const INVOICE_STATUS = {
  ISSUED: '已开具',
  VOIDED: '已作废',
}

export const INVOICE_DELIVERY_STATUS = {
  PENDING: '未送达',
  DELIVERED: '已送达',
  CONFIRMED: '单位已确认',
}

export const INVOICE_PAYMENT_STATUS = {
  PENDING: '待收款',
  PARTIAL: '部分收款',
  PAID: '已收齐',
}

export const SERVICE_COLLECTION_STATUS = {
  PENDING: '待收款',
  PARTIAL: '部分收款',
  PAID: '已收齐',
  NOT_REQUIRED: '无需收款',
}

export const PAYMENT_MATCH_STATUS = {
  PENDING: '待匹配',
  PARTIAL: '部分匹配',
  MATCHED: '已匹配',
}

export const COMMISSION_SETTLEMENT_STATUS = {
  DRAFT: 'draft',
  CONFIRMED: 'confirmed',
  PAID: 'paid',
  CANCELLED: 'cancelled',
}

export const COMMISSION_ITEM_SETTLEMENT_STATUS = {
  PENDING_COLLECTION: '待收款',
  SETTLEABLE: '可结算',
  SETTLED: '已结算',
}

export const COMMISSION_SETTLEMENT_STATUS_OPTIONS = [
  { label: '草稿', value: COMMISSION_SETTLEMENT_STATUS.DRAFT },
  { label: '已确认', value: COMMISSION_SETTLEMENT_STATUS.CONFIRMED },
  { label: '已发放', value: COMMISSION_SETTLEMENT_STATUS.PAID },
  { label: '已取消', value: COMMISSION_SETTLEMENT_STATUS.CANCELLED },
]

export const CONTRACT_STATUS_OPTIONS = Object.values(CONTRACT_STATUS).map(value => ({ label: value, value }))
export const INVOICE_STATUS_OPTIONS = Object.values(INVOICE_STATUS).map(value => ({ label: value, value }))
export const INVOICE_DELIVERY_STATUS_OPTIONS = Object.values(INVOICE_DELIVERY_STATUS).map(value => ({ label: value, value }))
export const INVOICE_PAYMENT_STATUS_OPTIONS = Object.values(INVOICE_PAYMENT_STATUS).map(value => ({ label: value, value }))
export const SERVICE_COLLECTION_STATUS_OPTIONS = Object.values(SERVICE_COLLECTION_STATUS).map(value => ({ label: value, value }))
export const PAYMENT_MATCH_STATUS_OPTIONS = Object.values(PAYMENT_MATCH_STATUS).map(value => ({ label: value, value }))

export function metaToOptions(meta) {
  return Object.entries(meta).map(([value, item]) => ({ label: item.label, value }))
}

export function labelMapToOptions(labels) {
  return Object.entries(labels).map(([value, label]) => ({ label, value }))
}
