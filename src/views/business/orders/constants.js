import { SERVICE_COLLECTION_STATUS_OPTIONS } from '../shared/constants'

export const ORDER_STATUS = {
  CONFIRMED: '已确认',
  IN_PROGRESS: '履约中',
  PARTIAL_DONE: '部分完成',
  DONE: '已完成',
  CANCELLED: '已取消',
}

export const SERVICE_ITEM_STATUS = {
  PENDING_ASSIGNMENT: '待分配',
  PENDING_START: '待开始',
  IN_PROGRESS: '进行中',
  WAITING_CLIENT_MATERIAL: '待客户资料',
  PENDING_CONFIRMATION: '待确认',
  DONE: '已完成',
  CANCELLED: '已取消',
}

export const ORDER_CONTRACT_STATUS = {
  NOT_CREATED: '未建合同',
  DRAFT: '草稿',
  PARTIAL_SIGNED: '部分签订',
  SIGNED: '已签订',
}

export const ORDER_INVOICE_STATUS = {
  NOT_ISSUED: '未开具',
  ISSUED: '已开具',
  PARTIAL_ISSUED: '部分开票',
}

export const ORDER_STATUSES = Object.values(ORDER_STATUS)

export const SERVICE_ITEM_STATUSES = Object.values(SERVICE_ITEM_STATUS)

export const ORDER_STATUS_OPTIONS = ORDER_STATUSES.map(value => ({ label: value, value }))

export const SERVICE_ITEM_STATUS_OPTIONS = SERVICE_ITEM_STATUSES.map(value => ({ label: value, value }))

export function resolveOrderStatusByServiceStatuses(statuses = []) {
  if (!statuses.length)
    return ORDER_STATUS.CONFIRMED
  if (statuses.every(status => status === SERVICE_ITEM_STATUS.CANCELLED))
    return ORDER_STATUS.CANCELLED
  if (statuses.includes(SERVICE_ITEM_STATUS.DONE) && statuses.every(status => status === SERVICE_ITEM_STATUS.DONE || status === SERVICE_ITEM_STATUS.CANCELLED))
    return ORDER_STATUS.DONE
  if (statuses.some(status => status === SERVICE_ITEM_STATUS.DONE || status === SERVICE_ITEM_STATUS.PENDING_CONFIRMATION))
    return ORDER_STATUS.PARTIAL_DONE
  if (statuses.every(status => status === SERVICE_ITEM_STATUS.PENDING_ASSIGNMENT || status === SERVICE_ITEM_STATUS.PENDING_START))
    return ORDER_STATUS.CONFIRMED
  return ORDER_STATUS.IN_PROGRESS
}

export const DUE_STATE_OPTIONS = [
  { label: '即将到期', value: 'dueSoon' },
  { label: '已逾期', value: 'overdue' },
]

export const COLLECTION_STATUS_OPTIONS = SERVICE_COLLECTION_STATUS_OPTIONS
