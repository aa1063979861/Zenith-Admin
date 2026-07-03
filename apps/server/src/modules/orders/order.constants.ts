export const ORDER_STATUSES = ['已确认', '履约中', '部分完成', '已完成', '已取消'] as const;
export const ORDER_STATUS = {
  CONFIRMED: '已确认',
  IN_PROGRESS: '履约中',
  PARTIAL_DONE: '部分完成',
  DONE: '已完成',
  CANCELLED: '已取消',
} as const;

export const SERVICE_ITEM_STATUSES = ['待分配', '待开始', '进行中', '待客户资料', '待确认', '已完成', '已取消'] as const;
export const SERVICE_ITEM_STATUS = {
  PENDING_ASSIGNMENT: '待分配',
  PENDING_START: '待开始',
  IN_PROGRESS: '进行中',
  WAITING_CLIENT_MATERIAL: '待客户资料',
  PENDING_CONFIRMATION: '待确认',
  DONE: '已完成',
  CANCELLED: '已取消',
} as const;

export const DONE_SERVICE_ITEM_STATUSES = [SERVICE_ITEM_STATUS.DONE, SERVICE_ITEM_STATUS.CANCELLED] as const;

export const ORDER_CONTRACT_STATUS = {
  NOT_CREATED: '未建合同',
  DRAFT: '草稿',
  PARTIAL_SIGNED: '部分签订',
  SIGNED: '已签订',
} as const;

export const ORDER_INVOICE_STATUS = {
  NOT_ISSUED: '未开具',
  ISSUED: '已开具',
  PARTIAL_ISSUED: '部分开票',
} as const;

export type OrderStatus = typeof ORDER_STATUSES[number];
export type ServiceItemStatus = typeof SERVICE_ITEM_STATUSES[number];
export type OrderContractStatus = typeof ORDER_CONTRACT_STATUS[keyof typeof ORDER_CONTRACT_STATUS];
export type OrderInvoiceStatus = typeof ORDER_INVOICE_STATUS[keyof typeof ORDER_INVOICE_STATUS];
