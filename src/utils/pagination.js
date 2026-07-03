export const DEFAULT_PAGE_SIZE = 50
export const ALL_PAGE_SIZE = 100000

export const pageSizeOptions = [
  { label: '50条/页', value: 50 },
  { label: '100条/页', value: 100 },
  { label: '200条/页', value: 200 },
  { label: '500条/页', value: 500 },
  { label: '1000条/页', value: 1000 },
  { label: '2000条/页', value: 2000 },
  { label: '5000条/页', value: 5000 },
  { label: '全部', value: ALL_PAGE_SIZE },
]

// NPagination 会把 selectProps 透传给内部 NSelect，分页条数菜单统一挂到 body 并向上展开，避免页面底部裁切。
export const pageSizeSelectProps = {
  to: 'body',
  placement: 'top-start',
  menuProps: {
    class: 'zenith-page-size-menu',
    style: {
      maxHeight: '280px',
    },
  },
}

export function getTableScrollX(columns, minWidth = 720) {
  const totalWidth = columns.reduce((sum, column) => {
    if (column.type)
      return sum + Number(column.width || 48)
    return sum + Number(column.width || column.minWidth || 120)
  }, 0)
  return Math.max(totalWidth, minWidth)
}

export function createTablePagination(options = {}) {
  const pageSize = options.pageSize || options.defaultPageSize || DEFAULT_PAGE_SIZE
  return {
    defaultPageSize: pageSize,
    pageSize,
    showSizePicker: true,
    showQuickJumper: true,
    pageSizes: options.pageSizes || pageSizeOptions,
    selectProps: options.selectProps || pageSizeSelectProps,
    pageSlot: options.pageSlot || 4,
    prefix({ itemCount }) {
      return `共 ${itemCount || 0} 条记录`
    },
    ...options,
  }
}

export function createTableSorter() {
  return {
    sortKey: '',
    sortOrder: false,
  }
}

export function normalizeTableSorter(sorter) {
  const nextSorter = Array.isArray(sorter) ? sorter[0] : sorter
  return nextSorter?.order
    ? { sortKey: String(nextSorter.columnKey), sortOrder: nextSorter.order }
    : createTableSorter()
}

export function getTableSorterParams(sorter) {
  if (!sorter?.sortKey || !sorter?.sortOrder)
    return {}
  return {
    sortKey: sorter.sortKey,
    sortOrder: sorter.sortOrder,
  }
}
