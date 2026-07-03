const MIN_DATA_COLUMN_WIDTH = 88
const MAX_DATA_COLUMN_WIDTH = 280
const MIN_ACTION_COLUMN_WIDTH = 88
const MAX_ACTION_COLUMN_WIDTH = 220
const HEADER_BASE_EXTRA_WIDTH = 44
const SORTER_EXTRA_WIDTH = 24

export function createIndexColumn(options = {}) {
  return {
    title: options.title || '序号',
    key: options.key || '__index',
    width: options.width || 64,
    align: 'center',
    fixed: options.fixed === undefined ? 'left' : options.fixed,
    render(_row, index) {
      return index + 1
    },
  }
}

export function createDefaultSorter(key) {
  return (left, right) => compareTableValues(getTableCellValue(left, key), getTableCellValue(right, key))
}

export function enhanceTableColumns(columns, options = {}) {
  const tableColumns = columns.map((sourceColumn) => {
    const column = withDefaultColumnPresentation(sourceColumn)
    if (column.type || column.key === 'actions')
      return column
    if (column.sortable === false)
      return finalizeDataColumn(column)
    if (options.remote) {
      if (options.remoteSortable === true || column.remoteSortable === true || column.sorter) {
        return finalizeDataColumn({
          sorter: 'default',
          ...column,
          resizable: column.resizable !== false,
        })
      }
      return finalizeDataColumn({
        ...column,
        resizable: column.resizable !== false,
      })
    }
    return finalizeDataColumn({
      sorter: createDefaultSorter(column.key),
      resizable: column.resizable !== false,
      ...column,
    })
  })

  const controlColumns = []
  if (options.selection) {
    controlColumns.push({
      type: 'selection',
      width: options.selectionWidth || 48,
      fixed: options.selectionFixed === undefined ? 'left' : options.selectionFixed,
      disabled: options.selectionDisabled,
    })
  }

  if (options.index !== false)
    controlColumns.push(createIndexColumn(options.indexOptions))

  return [...controlColumns, ...tableColumns]
}

export function createTableSummary(numberColumns, options = {}) {
  return (pageData) => {
    const summary = {}
    const labelKey = options.labelKey || findFirstDataColumnKey(options.columns) || 'summary'
    summary[labelKey] = {
      value: options.label || '合计',
    }

    for (const column of numberColumns) {
      const key = typeof column === 'string' ? column : column.key
      const formatter = typeof column === 'string' ? options.formatter : column.formatter
      const value = pageData.reduce((sum, row) => sum + Number(getTableCellValue(row, key) || 0), 0)
      summary[key] = {
        value: formatter ? formatter(value) : value,
      }
    }

    return summary
  }
}

export function getColumnIdentity(column) {
  if (column.key !== undefined)
    return String(column.key)
  if (column.type)
    return `type:${column.type}`
  return ''
}

function withDefaultColumnPresentation(column) {
  if (column.type)
    return { ...column }

  const key = String(column.key || '')
  const title = typeof column.title === 'string' ? column.title : ''
  const nextColumn = { ...column }

  if (nextColumn.key === 'actions') {
    if (nextColumn.width === undefined && nextColumn.minWidth === undefined)
      nextColumn.width = 112
    if (nextColumn.align === undefined)
      nextColumn.align = 'center'
    if (nextColumn.titleAlign === undefined)
      nextColumn.titleAlign = nextColumn.align
    if (nextColumn.fixed === undefined)
      nextColumn.fixed = 'right'
    return clampTableColumnSize(nextColumn, {
      minWidth: MIN_ACTION_COLUMN_WIDTH,
      maxWidth: MAX_ACTION_COLUMN_WIDTH,
    })
  }

  if (nextColumn.width === undefined && nextColumn.minWidth === undefined) {
    const size = resolveDefaultColumnSize(key, title)
    nextColumn[size.type] = size.value
  }

  if (nextColumn.align === undefined) {
    const align = resolveDefaultColumnAlign(key, title)
    if (align)
      nextColumn.align = align
  }
  if (nextColumn.titleAlign === undefined && nextColumn.align)
    nextColumn.titleAlign = nextColumn.align

  if (nextColumn.ellipsis === undefined && shouldUseEllipsis(key, title))
    nextColumn.ellipsis = { tooltip: true }

  return nextColumn
}

function finalizeDataColumn(column) {
  const nextColumn = { ...column }
  ensureReadableHeaderWidth(nextColumn, resolveColumnTitleText(nextColumn))
  return clampTableColumnSize(nextColumn)
}

function ensureReadableHeaderWidth(column, title) {
  if (!title)
    return
  const headerMinWidth = getHeaderMinWidth(title, column)
  column.minWidth = maxFiniteWidth(column.minWidth, headerMinWidth)
  if (column.width !== undefined)
    column.width = maxFiniteWidth(column.width, headerMinWidth)
}

export function clampTableColumnSize(column, options = {}) {
  const minWidth = options.minWidth ?? MIN_DATA_COLUMN_WIDTH
  const maxWidth = options.maxWidth ?? MAX_DATA_COLUMN_WIDTH
  const nextColumn = { ...column }
  if (nextColumn.width !== undefined)
    nextColumn.width = clampColumnWidth(nextColumn.width, minWidth, maxWidth)
  if (nextColumn.minWidth !== undefined)
    nextColumn.minWidth = clampColumnWidth(nextColumn.minWidth, minWidth, maxWidth)
  if (nextColumn.minWidth === undefined)
    nextColumn.minWidth = minWidth
  if (nextColumn.width === undefined && nextColumn.minWidth !== undefined)
    nextColumn.width = nextColumn.minWidth
  nextColumn.maxWidth = normalizeColumnMaxWidth(nextColumn, minWidth, maxWidth)
  return nextColumn
}

function getHeaderMinWidth(title, column) {
  const extraWidth = HEADER_BASE_EXTRA_WIDTH + (isSortableColumn(column) ? SORTER_EXTRA_WIDTH : 0)
  return Math.min(getTextDisplayWidth(title) + extraWidth, MAX_DATA_COLUMN_WIDTH)
}

function isSortableColumn(column) {
  return !!column.sorter && column.sorter !== false
}

function resolveColumnTitleText(column) {
  if (typeof column.title === 'string')
    return column.title
  if (typeof column.rawTitle === 'string')
    return column.rawTitle
  return ''
}

function getTextDisplayWidth(text) {
  return Array.from(String(text)).reduce((width, char) => {
    if (/[\u4E00-\u9FFF]/.test(char))
      return width + 14
    if (/[A-Z0-9]/.test(char))
      return width + 8
    return width + 7
  }, 0)
}

function maxFiniteWidth(value, minWidth) {
  const width = Number(value)
  if (!Number.isFinite(width) || width <= 0)
    return minWidth
  return Math.max(width, minWidth)
}

function clampColumnWidth(value, minWidth, maxWidth) {
  const width = Number(value)
  if (!Number.isFinite(width) || width <= 0)
    return value
  return Math.min(Math.max(Math.round(width), minWidth), maxWidth)
}

function normalizeColumnMaxWidth(column, minWidth, maxWidth) {
  const max = column.maxWidth === undefined
    ? maxWidth
    : clampColumnWidth(column.maxWidth, minWidth, maxWidth)
  const numericMax = Number(max)
  if (!Number.isFinite(numericMax))
    return max
  return [column.width, column.minWidth]
    .map(Number)
    .filter(width => Number.isFinite(width) && width > 0)
    .reduce((currentMax, width) => Math.max(currentMax, width), numericMax)
}

function resolveDefaultColumnSize(key, title) {
  if (matchesAny(key, title, ['amount', 'price', 'fee', 'money', 'base', '金额', '价格', '收款', '应收', '已收', '基数', '总价']))
    return { type: 'width', value: 120 }
  if (matchesAny(key, title, ['createTime', 'updateTime', 'updatedAt', 'createdAt', '时间']))
    return { type: 'width', value: 170 }
  if (matchesAny(key, title, ['date', 'Date', '日期']))
    return { type: 'width', value: 120 }
  if (matchesAny(key, title, ['status', 'enable', 'enabled', 'builtIn', 'bound', 'authorized', '状态', '启用', '停用', '内置', '生效']))
    return { type: 'width', value: 96 }
  if (matchesAny(key, title, ['count', 'sort', 'order', 'year', 'month', 'gender', 'index', '数量', '排序', '年度', '月数', '性别', '序号']))
    return { type: 'width', value: 88 }
  if (matchesAny(key, title, ['phone', 'tel', '联系电话', '手机号', '电话']))
    return { type: 'width', value: 136 }
  if (matchesAny(key, title, ['unitCode', '单位编码', '单位代码']))
    return { type: 'width', value: 112 }
  if (matchesAny(key, title, ['employeeNo', '工号']))
    return { type: 'width', value: 96 }
  if (matchesAny(key, title, ['departmentName', 'positionName', '部门', '职位']))
    return { type: 'width', value: 140 }
  if (matchesAny(key, title, ['orderNo', 'invoiceNo', '编号', '单号', '发票号', '订单号']))
    return { type: 'width', value: 150 }
  if (matchesAny(key, title, ['username', '登录账号', '账号']))
    return { type: 'width', value: 140 }
  if (matchesAny(key, title, ['code', '编码']))
    return { type: 'width', value: 160 }
  if (matchesAny(key, title, ['clientName', 'unitName', 'payerName', 'fileName', 'name', 'title', '单位名称', '客户', '付款方', '文件名', '名称']))
    return { type: 'width', value: 220 }
  if (matchesAny(key, title, ['address', 'remark', 'note', 'message', 'url', 'scope', 'scene', '地址', '备注', '说明', '范围', '位置']))
    return { type: 'width', value: 220 }
  return { type: 'width', value: 120 }
}

function resolveDefaultColumnAlign(key, title) {
  if (matchesAny(key, title, ['amount', 'price', 'fee', 'money', 'base', '金额', '价格', '收款', '应收', '已收', '基数', '总价']))
    return 'right'
  if (matchesAny(key, title, ['count', 'sort', 'year', 'month', 'gender', 'status', 'enable', 'enabled', 'builtIn', 'bound', 'authorized', 'date', 'Date', 'code', 'unitCode', 'orderNo', 'invoiceNo', 'employeeNo', 'phone', '数量', '排序', '年度', '月数', '性别', '状态', '启用', '停用', '内置', '生效', '日期', '编码', '工号', '电话', '手机号']))
    return 'center'
  return undefined
}

function shouldUseEllipsis(key, title) {
  return matchesAny(key, title, ['name', 'title', 'code', 'address', 'remark', 'note', 'message', 'url', 'scope', 'scene', '名称', '编码', '地址', '备注', '说明', '范围', '位置'])
}

function matchesAny(key, title, patterns) {
  const source = `${key} ${title}`.toLowerCase()
  return patterns.some(pattern => source.includes(String(pattern).toLowerCase()))
}

export function compareTableValues(left, right) {
  const leftValue = normalizeComparableValue(left)
  const rightValue = normalizeComparableValue(right)
  if (typeof leftValue === 'number' && typeof rightValue === 'number')
    return leftValue - rightValue
  return String(leftValue).localeCompare(String(rightValue), 'zh-CN', { numeric: true })
}

export function getTableCellValue(row, key) {
  if (!row || key === undefined || key === null)
    return undefined
  if (Object.hasOwn(row, key))
    return row[key]
  const keyPath = String(key)
  if (!keyPath.includes('.'))
    return row[keyPath]
  return keyPath.split('.').reduce((value, segment) => {
    if (value === null || value === undefined)
      return undefined
    return value[segment]
  }, row)
}

function normalizeComparableValue(value) {
  if (value === null || value === undefined)
    return ''
  if (typeof value === 'number')
    return value
  if (typeof value === 'boolean')
    return value ? 1 : 0
  const text = String(value).trim()
  if (text && /^-?\d+(?:\.\d+)?$/.test(text))
    return Number(text)
  return text
}

function findFirstDataColumnKey(columns = []) {
  return columns.find(column => !column.type && column.key && column.key !== '__index' && column.key !== 'actions')?.key
}
