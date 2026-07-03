<template>
  <CommonPage title="操作日志" class="operation-log-page zenith-data-page">
    <section class="operation-log-filter">
      <n-form class="zenith-filter-bar" data-filter-collapsed-rows="all" label-placement="left" label-width="64" :model="filters" :show-feedback="false">
        <n-grid cols="1 m:2 l:4 xl:6" :x-gap="14" :y-gap="12" responsive="screen">
          <n-form-item-gi label="模块">
            <n-select v-model:value="filters.module" clearable filterable :options="logOptions.modules" placeholder="全部模块" />
          </n-form-item-gi>
          <n-form-item-gi label="动作">
            <n-select v-model:value="filters.action" clearable filterable :options="logOptions.actions" placeholder="全部动作" />
          </n-form-item-gi>
          <n-form-item-gi label="操作人">
            <n-select v-model:value="filters.userId" clearable filterable :options="logOptions.users" placeholder="全部人员" />
          </n-form-item-gi>
          <n-form-item-gi label="类型">
            <n-select v-model:value="filters.targetType" clearable filterable :options="logOptions.targetTypes" placeholder="全部类型" />
          </n-form-item-gi>
          <n-form-item-gi label="目标ID">
            <n-input v-model:value="filters.targetId" clearable placeholder="精确目标ID" @keydown.enter="searchLogs" />
          </n-form-item-gi>
          <n-form-item-gi label="关键词">
            <n-input v-model:value="filters.keyword" clearable placeholder="目标 / 用户 / 明细 / IP" @keydown.enter="searchLogs" />
          </n-form-item-gi>
          <n-form-item-gi label="开始">
            <AppDatePicker v-model:formatted-value="filters.startTime" clearable class="w-full" placeholder="开始日期" />
          </n-form-item-gi>
          <n-form-item-gi label="结束">
            <AppDatePicker v-model:formatted-value="filters.endTime" clearable class="w-full" placeholder="结束日期" />
          </n-form-item-gi>
          <n-form-item-gi class="zenith-filter-actions">
            <n-space>
              <n-button type="primary" @click="searchLogs">
                <i class="i-fe:search mr-4" />
                查询
              </n-button>
              <n-button secondary @click="resetFilters">
                重置
              </n-button>
              <n-button secondary @click="exportCurrentPage">
                导出当前页
              </n-button>
            </n-space>
          </n-form-item-gi>
        </n-grid>
      </n-form>
    </section>

    <EnhancedDataTable
      storage-key="system.operation-logs"
      :loading="loading"
      :columns="enhancedColumns"
      :data="rows"
      :pagination="pagination"
      mobile-mode="table"
      mobile-primary-key="targetName"
      mobile-status-key="action"
      :mobile-secondary-keys="['module', 'username', 'createTime']"
      :row-action="openLogDetail"
      remote
      flex-height
      size="small"
      :show-toolbar="false"
      @update:page="handlePageChange"
      @update:page-size="handlePageSizeChange"
      @update:sorter="handleSorterChange"
    />

    <n-modal
      v-model:show="logDetailVisible"
      preset="card"
      title="操作详情"
      style="width: min(780px, 92vw)"
      closable
    >
      <n-descriptions v-if="selectedLog" label-placement="left" bordered :column="2" size="small">
        <n-descriptions-item label="时间">
          {{ formatDateTime(selectedLog.createTime) }}
        </n-descriptions-item>
        <n-descriptions-item label="模块">
          {{ selectedLog.module || '-' }}
        </n-descriptions-item>
        <n-descriptions-item label="动作">
          {{ selectedLog.action || '-' }}
        </n-descriptions-item>
        <n-descriptions-item label="操作人">
          {{ selectedLog.username || '-' }}
        </n-descriptions-item>
        <n-descriptions-item label="IP地址">
          {{ selectedLog.ipAddress || '-' }}
        </n-descriptions-item>
        <n-descriptions-item label="目标类型">
          {{ selectedLog.targetType || '-' }}
        </n-descriptions-item>
        <n-descriptions-item label="目标ID">
          {{ selectedLog.targetId || '-' }}
        </n-descriptions-item>
        <n-descriptions-item label="目标">
          {{ selectedLog.targetName || selectedLog.targetId || '-' }}
        </n-descriptions-item>
        <n-descriptions-item label="浏览器" :span="2">
          {{ selectedLog.userAgent || '-' }}
        </n-descriptions-item>
        <n-descriptions-item label="摘要" :span="2">
          {{ formatDetail(selectedLog.detailJson) }}
        </n-descriptions-item>
        <n-descriptions-item label="原始明细" :span="2">
          <pre class="operation-log-json">{{ formatDetailJson(selectedLog.detailJson) }}</pre>
        </n-descriptions-item>
      </n-descriptions>
    </n-modal>
  </CommonPage>
</template>

<script setup>
import { NTag } from 'naive-ui'
import { AppDatePicker, CommonPage, EnhancedDataTable } from '@/components/common'
import { createTablePagination, createTableSorter, DEFAULT_PAGE_SIZE, downloadCsv, enhanceTableColumns, formatDateTime, getTableSorterParams, normalizeTableSorter } from '@/utils'
import { businessApi } from '@/views/business/shared/api'

defineOptions({ name: 'OperationLogs' })

const route = useRoute()
const loading = ref(false)
const rows = ref([])
const selectedLog = ref(null)
const logDetailVisible = ref(false)
const filters = reactive(createEmptyFilters())
const logOptions = reactive({ modules: [], actions: [], targetTypes: [], users: [] })
const pagination = reactive(createTablePagination({ page: 1, pageSize: DEFAULT_PAGE_SIZE, itemCount: 0 }))
const sorter = ref(createTableSorter())
const enhancedColumns = computed(() => enhanceTableColumns(columns, { remote: true }))

const columns = [
  { title: '时间', key: 'createTime', width: 170, remoteSortable: true, render: row => formatDateTime(row.createTime) },
  { title: '模块', key: 'module', width: 110, remoteSortable: true },
  {
    title: '动作',
    key: 'action',
    width: 130,
    remoteSortable: true,
    render(row) {
      return h(NTag, { type: actionTagType(row.action), size: 'small', bordered: false }, { default: () => row.action || '-' })
    },
  },
  { title: '目标类型', key: 'targetType', width: 110, remoteSortable: true },
  { title: '目标', key: 'targetName', minWidth: 220, ellipsis: { tooltip: true }, remoteSortable: true, render: row => row.targetName || row.targetId || '-' },
  { title: '操作人', key: 'username', width: 120, remoteSortable: true, render: row => row.username || '-' },
  { title: 'IP', key: 'ipAddress', width: 130, render: row => row.ipAddress || '-' },
  { title: '摘要', key: 'detailJson', minWidth: 300, ellipsis: { tooltip: true }, render: row => formatDetail(row.detailJson) },
]

onMounted(async () => {
  filters.keyword = typeof route.query.keyword === 'string' ? route.query.keyword : ''
  filters.module = typeof route.query.module === 'string' ? route.query.module : null
  filters.action = typeof route.query.action === 'string' ? route.query.action : ''
  await Promise.all([loadOptions(), loadLogs()])
})

async function loadOptions() {
  const { data } = await businessApi.operationLogs.options()
  logOptions.modules = data?.modules || []
  logOptions.actions = data?.actions || []
  logOptions.targetTypes = data?.targetTypes || []
  logOptions.users = data?.users || []
}

async function loadLogs() {
  loading.value = true
  try {
    const { data } = await businessApi.operationLogs.page({
      pageNo: pagination.page,
      pageSize: pagination.pageSize,
      ...compactParams(filters),
      ...getTableSorterParams(sorter.value),
    })
    rows.value = data?.pageData || []
    pagination.itemCount = data?.total || 0
  }
  finally {
    loading.value = false
  }
}

async function searchLogs() {
  pagination.page = 1
  await loadLogs()
}

async function resetFilters() {
  Object.assign(filters, createEmptyFilters())
  pagination.page = 1
  await loadLogs()
}

async function handlePageChange(page) {
  pagination.page = page
  await loadLogs()
}

async function handlePageSizeChange(pageSize) {
  pagination.page = 1
  pagination.pageSize = pageSize
  await loadLogs()
}

async function handleSorterChange(nextSorter) {
  sorter.value = normalizeTableSorter(nextSorter)
  pagination.page = 1
  await loadLogs()
}

function createEmptyFilters() {
  return {
    module: null,
    action: null,
    targetType: null,
    targetId: '',
    userId: null,
    startTime: null,
    endTime: null,
    keyword: '',
  }
}

function compactParams(source) {
  return Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined && value !== null && value !== ''))
}

function openLogDetail(row) {
  selectedLog.value = row
  logDetailVisible.value = true
}

function exportCurrentPage() {
  const csvRows = rows.value.map(row => ({
    时间: formatDateTime(row.createTime),
    模块: row.module || '',
    动作: row.action || '',
    目标类型: row.targetType || '',
    目标ID: row.targetId || '',
    目标: row.targetName || '',
    操作人: row.username || '',
    IP: row.ipAddress || '',
    摘要: formatDetail(row.detailJson),
    浏览器: row.userAgent || '',
    原始明细: formatDetailJson(row.detailJson),
  }))
  if (!downloadCsv(`操作日志-${todayText()}.csv`, csvRows))
    window.$message?.warning('当前没有可导出的日志')
}

function formatDetail(detail) {
  if (!detail)
    return '-'
  const parts = []
  const labels = {
    reason: '原因',
    unitName: '单位',
    serviceYear: '年度',
    status: '状态',
    weekStart: '周开始',
    weekEnd: '周结束',
    sourceType: '来源',
    category: '分类',
    documentType: '资料类型',
    attachmentId: '附件ID',
  }
  Object.entries(labels).forEach(([key, label]) => {
    if (detail[key] !== undefined && detail[key] !== null && detail[key] !== '')
      parts.push(`${label}：${detail[key]}`)
  })
  if (Array.isArray(detail.changedFields) && detail.changedFields.length)
    parts.push(`字段：${detail.changedFields.join('、')}`)
  return parts.length ? parts.join('；') : JSON.stringify(detail)
}

function actionTagType(action) {
  if (!action)
    return 'default'
  if (action.includes('删除') || action.includes('废止') || action.includes('取消'))
    return 'error'
  if (action.includes('撤回') || action.includes('重置'))
    return 'warning'
  if (action.includes('创建') || action.includes('生成') || action.includes('提交') || action.includes('发布'))
    return 'success'
  return 'info'
}

function formatDetailJson(detail) {
  if (!detail)
    return '-'
  return JSON.stringify(detail, null, 2)
}

function todayText() {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}${month}${day}`
}
</script>

<style scoped>
.operation-log-page :deep(.common-page-body) {
  gap: 10px;
  padding: 12px !important;
}

.operation-log-filter {
  flex: 0 0 auto;
}

.operation-log-json {
  max-height: 280px;
  overflow: auto;
  margin: 0;
  border-radius: 6px;
  background: #f8fafc;
  color: #334155;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
  font-size: 12px;
  line-height: 1.6;
  padding: 10px 12px;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
