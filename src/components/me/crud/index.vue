<!--------------------------------
 - @Author: Ronnie Zhang
 - @LastEditor: Ronnie Zhang
 - @LastEditTime: 2023/12/04 22:51:42
 - @Email: zclzone@outlook.com
 - Copyright © 2023 Ronnie Zhang(大脸怪) | https://isme.top
 --------------------------------->

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <div v-if="$slots.default" class="me-crud-query-shell">
      <form class="me-crud-query-form zenith-filter-bar flex justify-between" data-filter-collapsed-rows="all" @submit.prevent="handleSearch()">
        <div class="me-crud-query-fields">
          <n-space wrap :size="[12, 8]">
            <slot />
          </n-space>
        </div>
        <div class="me-crud-query-actions zenith-filter-actions flex-shrink-0">
          <n-space :size="8" justify="end">
            <n-button attr-type="submit" type="primary">
              <i class="i-fe:search mr-4" />
              查询
            </n-button>
            <n-button attr-type="button" secondary @click="handleReset">
              <i class="i-fe:rotate-ccw mr-4" />
              重置
            </n-button>
            <slot name="query-actions" />

            <template v-if="expand">
              <n-button v-if="!isExpanded" attr-type="button" type="primary" text @click="toggleExpand">
                <i class="i-fe:chevrons-down mr-4" />
                展开
              </n-button>
              <n-button v-else attr-type="button" text type="primary" @click="toggleExpand">
                <i class="i-fe:chevrons-up mr-4" />
                收起
              </n-button>
            </template>
          </n-space>
        </div>
      </form>
    </div>

    <EnhancedDataTable
      :storage-key="resolvedStorageKey"
      :remote="remote"
      :loading="loading"
      :min-scroll-x="scrollX"
      :columns="enhancedColumns"
      :data="tableData"
      :row-key="(row) => row[rowKey]"
      :row-action="rowAction"
      :row-action-disabled="rowActionDisabled"
      :pagination="isPagination ? pagination : false"
      :show-toolbar="false"
      flex-height
      class="flex-1"
      @update:checked-row-keys="onChecked"
      @update:sorter="onSorterChange"
    />
  </div>
</template>

<script setup>
import { EnhancedDataTable } from '@/components/common'
import { createTablePagination, downloadCsv, enhanceTableColumns } from '@/utils'

const props = defineProps({
  /**
   * @remote true: 后端分页  false： 前端分页
   */
  remote: {
    type: Boolean,
    default: true,
  },
  /**
   * @isPagination 是否分页
   */
  isPagination: {
    type: Boolean,
    default: true,
  },
  scrollX: {
    type: Number,
    default: 1200,
  },
  rowKey: {
    type: String,
    default: 'id',
  },
  columns: {
    type: Array,
    required: true,
  },
  storageKey: {
    type: String,
    default: '',
  },
  /** queryBar中的参数 */
  queryItems: {
    type: Object,
    default() {
      return {}
    },
  },
  /**
   * ! 约定接口入参出参
   * 分页模式需约定分页接口入参
   *    @pageSize 分页参数：一页展示多少条，默认50
   *    @pageNo   分页参数：页码，默认1
   * 需约定接口出参
   *    @pageData 分页模式必须,非分页模式如果没有pageData则取上一层data
   *    @total    分页模式必须，非分页模式如果没有total则取上一层data.length
   */
  getData: {
    type: Function,
    required: true,
  },
  /** 是否支持展开 */
  expand: Boolean,
  rowAction: {
    type: Function,
    default: undefined,
  },
  rowActionDisabled: {
    type: Function,
    default: undefined,
  },
})

const emit = defineEmits(['update:queryItems', 'onChecked', 'onDataChange'])
const loading = ref(false)
const initQuery = { ...props.queryItems }
const tableData = ref([])
const remoteSorter = ref({
  sortKey: '',
  sortOrder: false,
})
const pagination = reactive(createTablePagination({
  page: 1,
  onUpdatePage: onPageChange,
  onUpdatePageSize: onPageSizeChange,
}))
const enhancedColumns = computed(() => enhanceTableColumns(props.columns, {
  index: !props.columns.some(column => column.key === '__index' || column.title === '序号'),
  remote: props.remote,
  remoteSortable: props.remote,
}))
const resolvedStorageKey = computed(() => props.storageKey || `me-crud.${props.rowKey}.${props.columns.map(column => column.key || column.type || column.title).join('.')}`)

// 是否展开
const isExpanded = ref(false)

function toggleExpand() {
  isExpanded.value = !isExpanded.value
}

async function handleQuery() {
  try {
    loading.value = true
    let paginationParams = {}
    // 如果非分页模式或者使用前端分页,则无需传分页参数
    if (props.isPagination && props.remote) {
      paginationParams = { pageNo: pagination.page, pageSize: pagination.pageSize }
    }
    const { data } = await props.getData({
      ...props.queryItems,
      ...paginationParams,
      ...resolveSorterParams(),
    })
    tableData.value = data?.pageData || data
    pagination.itemCount = data.total ?? data.length
    if (pagination.itemCount && !tableData.value.length && pagination.page > 1) {
      // 如果当前页数据为空，且总条数不为0，则返回上一页数据
      onPageChange(pagination.page - 1)
    }
  }
  catch (error) {
    console.error(error)
    tableData.value = []
    pagination.itemCount = 0
  }
  finally {
    emit('onDataChange', tableData.value)
    loading.value = false
  }
}

function handleSearch(keepCurrentPage = false) {
  if (keepCurrentPage || !props.remote) {
    handleQuery()
  }
  else {
    onPageChange(1)
  }
}
async function handleReset() {
  const queryItems = { ...props.queryItems }
  for (const key in queryItems) {
    queryItems[key] = null
  }
  emit('update:queryItems', { ...queryItems, ...initQuery })
  await nextTick()
  pagination.page = 1
  handleQuery()
}
function onPageChange(currentPage) {
  pagination.page = currentPage
  if (props.remote) {
    handleQuery()
  }
}
function onPageSizeChange(pageSize) {
  pagination.pageSize = pageSize
  pagination.page = 1
  handleQuery()
}
function onChecked(rowKeys) {
  if (props.columns.some(item => item.type === 'selection')) {
    emit('onChecked', rowKeys)
  }
}
function onSorterChange(sorter) {
  if (!props.remote)
    return
  const nextSorter = Array.isArray(sorter) ? sorter[0] : sorter
  remoteSorter.value = nextSorter?.order
    ? { sortKey: String(nextSorter.columnKey), sortOrder: nextSorter.order }
    : { sortKey: '', sortOrder: false }
  pagination.page = 1
  handleQuery()
}
function resolveSorterParams() {
  if (!props.remote || !remoteSorter.value.sortKey || !remoteSorter.value.sortOrder)
    return {}
  return {
    sortKey: remoteSorter.value.sortKey,
    sortOrder: remoteSorter.value.sortOrder,
  }
}
function handleExport(columns = props.columns, data = tableData.value) {
  if (!data?.length)
    return $message.warning('没有数据')
  const columnsData = columns.filter(item => !!item.title && !item.hideInExcel)
  const rows = data.map(item => Object.fromEntries(
    columnsData.map(column => [column.title, item[column.key]]),
  ))
  downloadCsv('数据报表.csv', rows)
}

defineExpose({
  handleSearch,
  handleReset,
  handleExport,
})
</script>

<style scoped>
.me-crud-query-shell {
  flex: 0 0 auto;
}

.me-crud-query-fields {
  min-width: 0;
  flex: 1;
}

.me-crud-query-actions {
  display: flex;
  align-self: flex-start;
  align-items: center;
  justify-content: flex-end;
  padding-left: 10px;
}

@media (max-width: 767px) {
  .me-crud-query-form {
    flex-direction: column;
    gap: 4px;
    padding: 0 !important;
  }

  .me-crud-query-actions {
    width: 100%;
    flex-wrap: wrap;
    justify-content: flex-start;
    padding-left: 0;
    padding-top: 0 !important;
  }

  .me-crud-query-fields :deep(.n-space),
  .me-crud-query-fields :deep(.n-space-item) {
    width: 100%;
  }

  .me-crud-query-fields :deep(.n-space) {
    flex-wrap: wrap !important;
  }
}
</style>
