<template>
  <div class="enhanced-table" :class="{ 'enhanced-table--flex-height': shouldUseFlexHeight }">
    <div v-if="shouldShowToolbar" class="enhanced-table-toolbar">
      <div class="enhanced-table-selection">
        <n-input
          v-if="shouldShowCurrentPageSearch"
          v-model:value="keyword"
          class="enhanced-table-search"
          clearable
          size="small"
          :placeholder="searchPlaceholder"
        >
          <template #prefix>
            <i class="i-fe:search" />
          </template>
        </n-input>
        <template v-if="selectable">
          <n-tag size="small" :bordered="false">
            已选 {{ checkedKeys.length }} 条
          </n-tag>
          <n-button
            v-if="batchDelete"
            size="small"
            secondary
            type="error"
            :disabled="!checkedKeys.length"
            @click="$emit('batchDelete', checkedKeys)"
          >
            <i class="i-fe:trash-2 mr-4" />
            批量删除
          </n-button>
        </template>
      </div>
    </div>

    <n-data-table
      v-if="!shouldUseMobileList"
      v-bind="dataTableAttrs"
      :table-layout="resolvedTableLayout"
      :columns="resolvedColumns"
      :data="displayData"
      :row-key="rowKey"
      :remote="remote"
      :checked-row-keys="checkedKeys"
      :scroll-x="resolvedScrollX"
      :summary="summary"
      :row-props="resolvedRowProps"
      @update:checked-row-keys="handleCheckedRowKeys"
      @update:sorter="handleSorterChange"
      @update:page="handlePageChange"
      @update:page-size="handlePageSizeChange"
    />
    <div v-else class="enhanced-mobile-list">
      <n-empty v-if="!displayData.length" class="enhanced-mobile-empty" description="暂无数据" />
      <div
        v-for="(row, index) in displayData"
        :key="rowKey(row)"
        class="enhanced-mobile-row"
        :class="{ 'enhanced-mobile-row--actionable': isRowActionEnabled(row, index) }"
        @click="handleMobileRowClick(row, $event)"
      >
        <div class="enhanced-mobile-row-header">
          <div class="enhanced-mobile-primary">
            <MobileCell v-if="mobilePrimaryColumn" :column="mobilePrimaryColumn" :row="row" :index="index" />
          </div>
          <div v-if="mobileStatusColumn" class="enhanced-mobile-status">
            <MobileCell :column="mobileStatusColumn" :row="row" :index="index" />
          </div>
        </div>

        <div v-if="mobileSecondaryColumns.length" class="enhanced-mobile-fields">
          <div
            v-for="column in mobileSecondaryColumns"
            :key="getColumnIdentity(column)"
            class="enhanced-mobile-field"
          >
            <span>{{ resolveColumnTitle(column) }}</span>
            <strong>
              <MobileCell :column="column" :row="row" :index="index" />
            </strong>
          </div>
        </div>

        <div v-if="mobileMetaColumns.length" class="enhanced-mobile-meta">
          <div
            v-for="column in mobileMetaColumns"
            :key="getColumnIdentity(column)"
            class="enhanced-mobile-meta-item"
          >
            <span>{{ resolveColumnTitle(column) }}</span>
            <MobileCell :column="column" :row="row" :index="index" />
          </div>
        </div>

        <div v-if="mobileActionColumn" class="enhanced-mobile-actions">
          <MobileCell :column="mobileActionColumn" :row="row" :index="index" />
        </div>
      </div>

      <n-pagination
        v-if="mobilePagination"
        class="enhanced-mobile-pagination"
        v-bind="mobilePagination"
        @update:page="handleMobilePageChange"
        @update:page-size="handleMobilePageSizeChange"
      />
    </div>
  </div>
</template>

<script setup>
import { useResponsiveLayout } from '@/composables'
import { clampTableColumnSize, getColumnIdentity, getTableCellValue, getTableScrollX } from '@/utils'

defineOptions({
  name: 'EnhancedDataTable',
  inheritAttrs: false,
})

const props = defineProps({
  storageKey: {
    type: String,
    default: '',
  },
  columns: {
    type: Array,
    required: true,
  },
  data: {
    type: Array,
    default: () => [],
  },
  rowKey: {
    type: Function,
    default: row => row.id,
  },
  checkedRowKeys: {
    type: Array,
    default: () => [],
  },
  selectable: Boolean,
  batchDelete: Boolean,
  summary: {
    type: Function,
    default: undefined,
  },
  remote: Boolean,
  searchable: Boolean,
  currentPageSearch: Boolean,
  searchPlaceholder: {
    type: String,
    default: '查询当前列表',
  },
  minScrollX: {
    type: [Number, String],
    default: 720,
  },
  showToolbar: {
    type: Boolean,
    default: false,
  },
  mobileMode: {
    type: String,
    default: 'auto',
    validator: value => ['auto', 'table', 'list'].includes(value),
  },
  mobilePrimaryKey: {
    type: String,
    default: '',
  },
  mobileStatusKey: {
    type: String,
    default: '',
  },
  mobileSecondaryKeys: {
    type: Array,
    default: () => [],
  },
  mobileMetaKeys: {
    type: Array,
    default: () => [],
  },
  rowAction: {
    type: Function,
    default: undefined,
  },
  rowActionDisabled: {
    type: Function,
    default: undefined,
  },
})

const emit = defineEmits([
  'update:checked-row-keys',
  'update:sorter',
  'update:page',
  'update:page-size',
  'batchDelete',
])
const attrs = useAttrs()
const { isMobile } = useResponsiveLayout()
const keyword = ref('')
const frozenColumnKeys = ref([])

const checkedKeys = computed(() => props.checkedRowKeys)
const externalRowProps = computed(() => attrs.rowProps || attrs['row-props'])
const resolvedRowProps = computed(() => (row, index) => {
  const source = typeof externalRowProps.value === 'function'
    ? externalRowProps.value(row, index) || {}
    : {}
  if (!isRowActionEnabled(row, index))
    return source
  return {
    ...source,
    class: mergeClassName(source.class, 'enhanced-table-row--actionable'),
    onClick(event) {
      source.onClick?.(event)
      if (event.defaultPrevented || isRowActionIgnored(event))
        return
      props.rowAction(row, event)
    },
  }
})
const dataTableAttrs = computed(() => {
  const { rowProps: _rowProps, 'row-props': _rowPropsKebab, ...rest } = attrs
  return rest
})
const resolvedTableLayout = computed(() => attrs.tableLayout || attrs['table-layout'] || 'fixed')

const shouldShowCurrentPageSearch = computed(() => {
  if (!props.searchable)
    return false
  return !props.remote || props.currentPageSearch
})

const shouldShowToolbar = computed(() => {
  return props.showToolbar && (shouldShowCurrentPageSearch.value || props.selectable)
})

const resolvedColumns = computed(() => {
  const hiddenKeys = resolveDefaultHiddenKeys(props.columns)
  return props.columns
    .filter(Boolean)
    .filter(column => isControlColumn(column) || !hiddenKeys.includes(getColumnIdentity(column)))
    .map((column) => {
      if (isControlColumn(column))
        return normalizeControlColumn(column)
      const nextColumn = normalizeResolvedColumn({
        ...column,
        resizable: column.resizable !== false,
      })
      return nextColumn
    })
})

const displayData = computed(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase()
  if (!shouldShowCurrentPageSearch.value || !normalizedKeyword)
    return props.data
  const searchableKeys = resolvedColumns.value
    .filter(column => !isControlColumn(column) && column.key && column.key !== 'actions')
    .map(column => column.key)

  return props.data.filter((row) => {
    return searchableKeys.some((key) => {
      const value = getTableCellValue(row, key)
      return value !== null && value !== undefined && String(value).toLowerCase().includes(normalizedKeyword)
    })
  })
})

const resolvedScrollX = computed(() => {
  return getTableScrollX(resolvedColumns.value, Number(props.minScrollX || 720))
})

const shouldUseFlexHeight = computed(() => {
  const value = attrs.flexHeight ?? attrs['flex-height']
  return value === true || value === ''
})

const dataColumns = computed(() => {
  return resolvedColumns.value.filter(column => !isControlColumn(column) && column.key !== 'actions')
})

const mobilePrimaryColumn = computed(() => {
  return findColumnByKey(props.mobilePrimaryKey, dataColumns.value) || dataColumns.value[0] || null
})

const mobileStatusColumn = computed(() => {
  return findColumnByKey(props.mobileStatusKey, dataColumns.value)
})

const mobileSecondaryColumns = computed(() => {
  const explicitColumns = resolveColumnsByKeys(props.mobileSecondaryKeys, dataColumns.value)
  if (explicitColumns.length)
    return explicitColumns
  return dataColumns.value
    .filter(column => column !== mobilePrimaryColumn.value && column !== mobileStatusColumn.value)
    .slice(0, 4)
})

const mobileMetaColumns = computed(() => resolveColumnsByKeys(props.mobileMetaKeys, dataColumns.value))

const mobileActionColumn = computed(() => resolvedColumns.value.find(column => column.key === 'actions') || null)

const mobilePagination = computed(() => {
  const pagination = attrs.pagination
  if (!pagination || typeof pagination !== 'object')
    return null
  return {
    ...pagination,
    pageSlot: 3,
    showQuickJumper: false,
    showSizePicker: false,
    prefix: undefined,
  }
})

const shouldUseMobileList = computed(() => {
  if (props.mobileMode === 'table')
    return false
  if (props.mobileMode === 'list')
    return true
  return isMobile.value && dataColumns.value.length > 4
})

const MobileCell = defineComponent({
  name: 'EnhancedMobileCell',
  props: {
    column: {
      type: Object,
      required: true,
    },
    row: {
      type: Object,
      required: true,
    },
    index: {
      type: Number,
      required: true,
    },
  },
  setup(cellProps) {
    return () => renderColumnCell(cellProps.column, cellProps.row, cellProps.index)
  },
})

function resolveDefaultHiddenKeys(columns) {
  return columns
    .filter(column => column.defaultHidden === true)
    .map(getColumnIdentity)
    .filter(Boolean)
}

function resolveColumnTitle(column) {
  if (typeof column.rawTitle === 'string' && column.rawTitle)
    return column.rawTitle
  if (typeof column.title === 'string')
    return column.title
  return String(column.key || column.type || '列')
}

function isControlColumn(column) {
  return !!column.type || column.key === '__index'
}

function normalizeControlColumn(column) {
  if (column.key === '__index')
    return normalizeIndexColumn(column)
  if (column.type === 'selection') {
    return clampTableColumnSize({
      ...column,
      width: column.width || 48,
      fixed: column.fixed === undefined ? 'left' : column.fixed,
    }, { minWidth: 40, maxWidth: 56 })
  }
  if (column.type === 'expand') {
    return clampTableColumnSize({
      ...column,
      width: column.width || 48,
    }, { minWidth: 40, maxWidth: 56 })
  }
  return column
}

function normalizeResolvedColumn(column) {
  if (column.key === '__index')
    return normalizeIndexColumn(column)
  if (column.key !== 'actions')
    return withFreezeControl(clampTableColumnSize(column))

  return clampTableColumnSize({
    ...column,
    titleAlign: 'center',
    align: 'center',
    className: mergeClassName(column.className, 'enhanced-table-actions-column'),
    render: wrapActionsRender(column.render),
  }, { minWidth: 88, maxWidth: 220 })
}

function withFreezeControl(column) {
  const key = getColumnIdentity(column)
  if (!key)
    return column
  const frozen = frozenColumnKeys.value.includes(key)
  const sourceTitle = column.title
  return {
    ...column,
    fixed: frozen ? 'left' : column.fixed,
    rawTitle: typeof sourceTitle === 'string' ? sourceTitle : column.rawTitle,
    title: () => h('span', {
      class: ['enhanced-table-title', frozen ? 'enhanced-table-title--frozen' : ''],
    }, [
      h('span', { class: 'enhanced-table-title__text' }, renderColumnTitle(sourceTitle, column)),
      h('button', {
        'class': 'enhanced-table-freeze-button',
        'type': 'button',
        'title': frozen ? '取消冻结列' : '冻结列',
        'aria-label': frozen ? '取消冻结列' : '冻结列',
        onClick(event) {
          event.stopPropagation()
          toggleFrozenColumn(key)
        },
      }, h('i', { class: frozen ? 'i-fe:lock' : 'i-fe:unlock' })),
    ]),
  }
}

function renderColumnTitle(title, column) {
  return typeof title === 'function' ? title(column) : title
}

function toggleFrozenColumn(key) {
  frozenColumnKeys.value = frozenColumnKeys.value.includes(key)
    ? frozenColumnKeys.value.filter(item => item !== key)
    : [...frozenColumnKeys.value, key]
}

function normalizeIndexColumn(column) {
  const nextColumn = clampTableColumnSize({
    ...column,
    width: column.width || 64,
    align: column.align || 'center',
    titleAlign: column.titleAlign || column.align || 'center',
    fixed: column.fixed === undefined ? 'left' : column.fixed,
  }, { minWidth: 56, maxWidth: 88 })
  return {
    ...nextColumn,
    render(_row, index) {
      return getCurrentPageOffset() + index + 1
    },
  }
}

function getCurrentPageOffset() {
  const pagination = attrs.pagination
  if (!pagination || typeof pagination !== 'object')
    return 0
  const page = Number(pagination.page || 1)
  const pageSize = Number(pagination.pageSize || pagination.defaultPageSize || 0)
  if (!Number.isFinite(page) || !Number.isFinite(pageSize) || page < 1 || pageSize < 1)
    return 0
  return (page - 1) * pageSize
}

function wrapActionsRender(render) {
  if (typeof render !== 'function')
    return render
  return (...args) => {
    const nodes = normalizeActionNodes(render(...args))
    return h('div', {
      class: [
        'enhanced-table-actions',
        nodes.length === 1 ? 'enhanced-table-actions--single' : '',
      ],
      onClick(event) {
        event.stopPropagation()
      },
    }, nodes)
  }
}

function normalizeActionNodes(nodes) {
  if (Array.isArray(nodes))
    return nodes.filter(Boolean)
  return nodes ? [nodes] : []
}

function mergeClassName(source, className) {
  if (!source)
    return className
  if (Array.isArray(source))
    return [...source, className]
  return `${source} ${className}`
}

function handleMobileRowClick(row, event) {
  if (!isRowActionEnabled(row) || isRowActionIgnored(event))
    return
  props.rowAction(row, event)
}

function isRowActionEnabled(row, index) {
  return typeof props.rowAction === 'function' && !props.rowActionDisabled?.(row, index)
}

function isRowActionIgnored(event) {
  return event.target?.closest?.('button,a,input,textarea,.n-base-selection,.n-pagination,.n-data-table-resize-button,.n-checkbox,.n-switch,.enhanced-table-actions,[role="button"]')
}

function handleCheckedRowKeys(keys) {
  emit('update:checked-row-keys', keys)
}

function handleSorterChange(sorter) {
  emit('update:sorter', sorter)
}

function handlePageChange(page) {
  emit('update:page', page)
}

function handlePageSizeChange(pageSize) {
  emit('update:page-size', pageSize)
}

function findColumnByKey(key, columns) {
  if (!key)
    return null
  return columns.find(column => getColumnIdentity(column) === key) || null
}

function resolveColumnsByKeys(keys, columns) {
  if (!Array.isArray(keys) || !keys.length)
    return []
  return keys
    .map(key => findColumnByKey(String(key), columns))
    .filter(Boolean)
}

function renderColumnCell(column, row, index) {
  if (typeof column.render === 'function')
    return column.render(row, index)
  const value = getTableCellValue(row, column.key)
  if (value === null || value === undefined || value === '')
    return '-'
  return String(value)
}

function handleMobilePageChange(page) {
  if (typeof mobilePagination.value?.onUpdatePage === 'function')
    mobilePagination.value.onUpdatePage(page)
  emit('update:page', page)
}

function handleMobilePageSizeChange(pageSize) {
  if (typeof mobilePagination.value?.onUpdatePageSize === 'function')
    mobilePagination.value.onUpdatePageSize(pageSize)
  emit('update:page-size', pageSize)
}
</script>

<style scoped>
.enhanced-table {
  display: flex;
  min-width: 0;
  min-height: 0;
  height: auto;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 10px;
}

.enhanced-table--flex-height {
  height: 100%;
  flex: 1 1 auto;
}

.enhanced-table-toolbar {
  display: flex;
  min-width: 0;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.enhanced-table-selection {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.enhanced-table-search {
  width: min(260px, 40vw);
  flex: 0 1 260px;
}

.enhanced-table :deep(.n-data-table) {
  flex: 0 0 auto;
  min-width: 0;
  min-height: 0;
}

.enhanced-table--flex-height :deep(.n-data-table) {
  height: 100%;
  flex: 1 1 auto;
}

.enhanced-table :deep(.n-data-table-wrapper) {
  --n-box-shadow-after: none !important;
  --n-box-shadow-before: none !important;
  --n-merged-border-color: #edf1f5;
  --n-td-color: #fff;
  --n-td-color-hover: color-mix(in srgb, #f7fafb 92%, rgb(var(--zenith-primary-color)) 8%);
  --n-th-color: #f7f9fb;
  --n-th-color-hover: #f1f5f9;
}

.enhanced-table :deep(.n-data-table-wrapper),
.enhanced-table :deep(.n-data-table-base-table),
.enhanced-table :deep(.n-data-table-base-table-body) {
  min-height: 0;
}

.enhanced-table :deep(.n-data-table-wrapper) {
  overflow: hidden;
  border: 1px solid #e5ebf0;
  border-radius: 6px;
  background: #fff;
  box-shadow: none;
}

.enhanced-table :deep(.n-data-table__pagination) {
  margin-top: 10px;
}

.enhanced-table :deep(.n-data-table-th) {
  background: #f7f9fb;
  color: #334256;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0;
  box-shadow: inset 0 -1px 0 #dfe6ee;
}

.enhanced-table :deep(.n-data-table-th--sortable:hover) {
  background: #f1f5f9;
  color: #1f2d3d;
}

.enhanced-table :deep(.n-data-table-th),
.enhanced-table :deep(.n-data-table-td) {
  border-color: #edf1f5;
  vertical-align: middle;
}

.enhanced-table :deep(.n-data-table-td) {
  color: #263545;
  transition:
    background-color 0.16s ease,
    box-shadow 0.16s ease;
}

.enhanced-table :deep(.n-data-table-tr:hover .n-data-table-td) {
  background: var(--n-td-color-hover);
}

.enhanced-table :deep(.enhanced-table-row--actionable) {
  cursor: pointer;
}

.enhanced-table :deep(.enhanced-table-row--actionable:hover .n-data-table-td:first-child) {
  box-shadow: inset 3px 0 0 rgba(var(--zenith-primary-color), 0.7);
}

.enhanced-table :deep(.n-data-table-tr--checked .n-data-table-td:first-child),
.enhanced-table :deep(.department-row--selected .n-data-table-td:first-child),
.enhanced-table :deep(.settings-definition-row--current .n-data-table-td:first-child) {
  box-shadow: inset 3px 0 0 rgb(var(--zenith-primary-color));
}

.enhanced-table :deep(.n-data-table-th--fixed-left::after),
.enhanced-table :deep(.n-data-table-td--fixed-left::after) {
  box-shadow: 10px 0 16px -16px rgb(15 23 42 / 45%) !important;
}

.enhanced-table :deep(.n-data-table-th--fixed-right::before),
.enhanced-table :deep(.n-data-table-td--fixed-right::before) {
  box-shadow: -10px 0 16px -16px rgb(15 23 42 / 45%) !important;
}

.enhanced-table :deep(.enhanced-table-title) {
  display: inline-flex;
  max-width: 100%;
  min-width: 0;
  align-items: center;
  gap: 4px;
  line-height: 18px;
  vertical-align: middle;
}

.enhanced-table :deep(.enhanced-table-title__text) {
  min-width: 0;
  overflow: visible;
  overflow-wrap: anywhere;
  text-overflow: clip;
  white-space: normal;
}

.enhanced-table :deep(.enhanced-table-freeze-button) {
  display: inline-flex;
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 4px;
  padding: 0;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  opacity: 0;
}

.enhanced-table :deep(.enhanced-table-title:hover .enhanced-table-freeze-button),
.enhanced-table :deep(.enhanced-table-freeze-button:focus-visible),
.enhanced-table :deep(.enhanced-table-title--frozen .enhanced-table-freeze-button) {
  color: rgb(var(--zenith-primary-color));
  opacity: 1;
}

.enhanced-table :deep(.enhanced-table-freeze-button:hover) {
  background: rgba(var(--zenith-primary-color), 0.075);
}

.enhanced-table :deep(.enhanced-table-actions-column) {
  padding-left: 10px;
  padding-right: 10px;
}

.enhanced-table :deep(.enhanced-table-actions) {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  justify-content: center;
  gap: 8px;
  white-space: nowrap;
}

.enhanced-table :deep(.enhanced-table-actions--single .n-button) {
  min-width: 0;
  padding-left: 6px;
  padding-right: 6px;
}

.enhanced-table :deep(.enhanced-table-actions--single .n-button__content) {
  font-weight: 500;
}

.enhanced-mobile-list {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 10px;
}

.enhanced-mobile-empty {
  border: 1px solid #dfe7f0;
  border-radius: 8px;
  padding: 36px 0;
  background: #fff;
  box-shadow: 0 1px 2px rgb(15 23 42 / 5%);
}

.enhanced-mobile-row {
  border: 1px solid #dfe7f0;
  border-radius: 8px;
  background: #fff;
  padding: 10px 12px;
  box-shadow: 0 1px 2px rgb(15 23 42 / 5%);
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease;
}

.enhanced-mobile-row:hover {
  border-color: #cfdbea;
  box-shadow: 0 8px 18px rgb(15 23 42 / 7%);
}

.enhanced-mobile-row--actionable {
  cursor: pointer;
}

.enhanced-mobile-row-header {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.enhanced-mobile-primary {
  min-width: 0;
  flex: 1;
  color: #0f172a;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
  overflow-wrap: anywhere;
}

.enhanced-mobile-status {
  flex: 0 0 auto;
}

.enhanced-mobile-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
  margin-top: 10px;
}

.enhanced-mobile-field,
.enhanced-mobile-meta-item {
  min-width: 0;
}

.enhanced-mobile-field span,
.enhanced-mobile-meta-item span {
  display: block;
  color: #64748b;
  font-size: 12px;
  line-height: 18px;
}

.enhanced-mobile-field strong {
  display: block;
  min-width: 0;
  color: #1e293b;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  overflow-wrap: anywhere;
}

.enhanced-mobile-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-top: 10px;
}

.enhanced-mobile-meta-item {
  flex: 1 1 120px;
  color: #334155;
  font-size: 13px;
  line-height: 20px;
}

.enhanced-mobile-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
  padding-top: 4px;
  border-top: 0;
}

.enhanced-mobile-actions :deep(.enhanced-table-actions) {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.enhanced-mobile-pagination {
  margin-top: 2px;
  align-self: flex-start;
}

@media (max-width: 767px) {
  .enhanced-table-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .enhanced-table-search {
    width: 100%;
    flex-basis: auto;
  }

  .enhanced-mobile-fields {
    grid-template-columns: 1fr;
  }
}
</style>
