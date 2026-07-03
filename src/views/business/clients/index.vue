<template>
  <CommonPage title="客户管理" class="client-hub-page zenith-data-page">
    <div class="client-hub">
      <section class="client-hub-filter zenith-filter-bar" data-filter-collapsed-rows="all">
        <n-form label-placement="left" label-width="76" :model="filters" :show-feedback="false">
          <n-grid cols="1 m:2 l:4" :x-gap="12" :y-gap="12" responsive="screen">
            <n-form-item-gi label="区划">
              <n-select v-model:value="filters.regionCode" clearable filterable :options="store.regionOptions" placeholder="全部区划" />
            </n-form-item-gi>
            <n-form-item-gi label="关键词">
              <n-input v-model:value="filters.keyword" clearable placeholder="单位名称 / 编码 / 信用代码" @keydown.enter="loadClients" />
            </n-form-item-gi>
            <n-form-item-gi label="客户等级">
              <n-select v-model:value="filters.customerLevel" clearable :options="customerLevelFilterOptions" placeholder="全部等级" />
            </n-form-item-gi>
            <n-form-item-gi label="客户阶段">
              <n-select v-model:value="filters.customerStage" clearable :options="customerStageOptions" placeholder="全部阶段" />
            </n-form-item-gi>
            <n-form-item-gi label="单位状态">
              <n-select v-model:value="filters.unitStatus" clearable :options="unitStatusOptions" placeholder="全部状态" />
            </n-form-item-gi>
            <n-form-item-gi label="联系人">
              <n-input v-model:value="filters.contact" clearable placeholder="联系人或联系电话" @keydown.enter="loadClients" />
            </n-form-item-gi>
            <n-form-item-gi label="订单">
              <n-select v-model:value="filters.hasOrders" clearable :options="hasOrderOptions" placeholder="全部单位" />
            </n-form-item-gi>
            <n-form-item-gi class="zenith-filter-actions">
              <n-space justify="end" class="w-full">
                <NButton type="primary" @click="loadClients">
                  <i class="i-fe:search mr-4" />
                  查询
                </NButton>
                <NButton secondary @click="resetFilters">
                  <i class="i-fe:rotate-ccw mr-4" />
                  重置
                </NButton>
                <NButton v-if="canImportClient" secondary @click="openImportDrawer">
                  <template #icon>
                    <i class="i-fe:upload" />
                  </template>
                  导入
                </NButton>
                <NButton v-if="canAddClient" type="primary" @click="openCreateDrawer">
                  <template #icon>
                    <i class="i-fe:plus" />
                  </template>
                  新增客户
                </NButton>
              </n-space>
            </n-form-item-gi>
          </n-grid>
        </n-form>
      </section>

      <section class="client-hub-table">
        <EnhancedDataTable
          storage-key="business.clients.hub"
          :columns="columns"
          :data="store.clients"
          :pagination="pagination"
          :loading="store.loading"
          :flex-height="!isMobile"
          mobile-primary-key="unitName"
          mobile-status-key="customerLevel"
          :mobile-secondary-keys="['regionName', 'unitCode', 'primaryContactName', 'primaryContactPhone']"
          :mobile-meta-keys="['orderCount', 'unpaidAmount']"
          :row-action="openDetail"
          remote
          @update:page="handlePageChange"
          @update:page-size="handlePageSizeChange"
          @update:sorter="handleSorterChange"
        />
      </section>
    </div>

    <n-drawer v-model:show="showClientDrawer" :width="formDrawerWidth" placement="right">
      <n-drawer-content :title="editingClient ? '编辑客户' : '新增客户'" closable>
        <n-form :model="clientForm" label-placement="top" :show-feedback="false">
          <n-grid cols="1 m:2" :x-gap="12" :y-gap="12" responsive="screen">
            <n-form-item-gi label="区划" required>
              <n-select v-if="!editingClient" v-model:value="clientForm.regionCode" filterable :options="store.regionOptions" placeholder="选择区划" />
              <n-input v-else :value="editingClient.regionName" disabled />
            </n-form-item-gi>
            <n-form-item-gi label="单位编码" required>
              <n-input v-if="!editingClient" v-model:value="clientForm.unitCode" maxlength="6" placeholder="6位数字" />
              <n-input v-else :value="editingClient.unitCode" disabled />
            </n-form-item-gi>
            <n-form-item-gi span="1 m:2" label="单位名称" required>
              <n-input v-if="!editingClient" v-model:value="clientForm.unitName" placeholder="单位全称" />
              <n-input v-else :value="editingClient.unitName" disabled />
            </n-form-item-gi>
            <n-form-item-gi span="1 m:2" label="单位地址">
              <n-input v-model:value="clientForm.address" placeholder="单位地址" />
            </n-form-item-gi>
            <n-form-item-gi label="统一社会信用代码">
              <n-input v-model:value="clientForm.unifiedSocialCreditCode" placeholder="统一社会信用代码" />
            </n-form-item-gi>
            <n-form-item-gi v-if="canMaintainClientLevel" label="客户等级">
              <n-select v-model:value="clientForm.customerLevel" :options="customerLevelOptions" />
            </n-form-item-gi>
            <n-form-item-gi v-if="canMaintainClientLevel" label="单位状态">
              <n-select v-model:value="clientForm.unitStatus" :options="unitStatusOptions" />
            </n-form-item-gi>
            <n-form-item-gi span="1 m:2" label="备注">
              <n-input v-model:value="clientForm.remark" type="textarea" :autosize="{ minRows: 3, maxRows: 5 }" />
            </n-form-item-gi>
          </n-grid>
        </n-form>
        <template #footer>
          <n-space justify="end">
            <NButton @click="showClientDrawer = false">
              取消
            </NButton>
            <NButton type="primary" :loading="submitting" @click="submitClient">
              保存
            </NButton>
          </n-space>
        </template>
      </n-drawer-content>
    </n-drawer>

    <n-drawer v-model:show="showImportDrawer" :width="importDrawerWidth" placement="right">
      <n-drawer-content title="导入单位基础库" closable>
        <n-tabs v-model:value="importActiveTab" type="line" animated>
          <n-tab-pane name="upload" tab="上传解析">
            <div class="client-import-panel">
              <div class="client-import-native">
                <div class="client-import-icon">
                  <i class="i-fe:file-plus" />
                </div>
                <input ref="importFileInput" class="client-import-input" type="file" accept=".xlsx,.xls" @change="handleImportFileChange">
                <p>{{ importFile ? importFile.name : '未选择文件' }}</p>
              </div>
            </div>
          </n-tab-pane>
          <n-tab-pane name="records" tab="导入记录">
            <EnhancedDataTable
              storage-key="business.clients.import.batches"
              :columns="importBatchColumns"
              :data="importBatches"
              :pagination="importBatchPagination"
              :loading="importBatchLoading"
              :row-action="openImportDetail"
              :max-height="360"
              mobile-primary-key="sourceFileName"
              mobile-status-key="status"
              :mobile-secondary-keys="['totalRows', 'validRows', 'warningRows', 'errorRows']"
              :mobile-meta-keys="['importedRows', 'importedAt']"
              remote
              @update:page="handleImportBatchPageChange"
              @update:page-size="handleImportBatchPageSizeChange"
            />
          </n-tab-pane>
        </n-tabs>
        <template #footer>
          <n-space justify="end">
            <NButton @click="showImportDrawer = false">
              关闭
            </NButton>
            <NButton v-if="importActiveTab === 'upload'" type="primary" :loading="importing" :disabled="!importFile" @click="submitImport">
              解析导入
            </NButton>
            <NButton v-else secondary :loading="importBatchLoading" @click="loadImportBatches">
              刷新记录
            </NButton>
          </n-space>
        </template>
      </n-drawer-content>
    </n-drawer>

    <n-drawer v-model:show="showImportDetailDrawer" :width="importDetailDrawerWidth" placement="right">
      <n-drawer-content :title="selectedImportBatch ? `导入明细：${selectedImportBatch.sourceFileName}` : '导入明细'" closable>
        <template v-if="selectedImportBatch">
          <n-form class="zenith-filter-bar mb-12 mt-12" data-filter-collapsed-rows="all" label-placement="left" :show-feedback="false">
            <n-grid cols="1 m:3" :x-gap="12" responsive="screen">
              <n-form-item-gi label="校验状态">
                <n-select v-model:value="importRowStatusFilter" clearable :options="importRowStatusOptions" placeholder="全部" @update:value="loadImportDetail" />
              </n-form-item-gi>
            </n-grid>
          </n-form>
          <EnhancedDataTable
            storage-key="business.clients.import.rows"
            :columns="importRowColumns"
            :data="importRows"
            :pagination="importRowPagination"
            :loading="importDetailLoading"
            :max-height="520"
            mobile-primary-key="unitName"
            mobile-status-key="validationStatus"
            :mobile-secondary-keys="['rowNo', 'regionName', 'unitCode', 'contactPhone']"
            :mobile-meta-keys="['validationMessage']"
            remote
            @update:page="handleImportRowPageChange"
            @update:page-size="handleImportRowPageSizeChange"
          />
        </template>
      </n-drawer-content>
    </n-drawer>
  </CommonPage>
</template>

<script setup>
import { NButton, NTag } from 'naive-ui'
import { h } from 'vue'
import { CommonPage, EnhancedDataTable } from '@/components/common'
import { useResponsiveLayout } from '@/composables'
import { hasPermission } from '@/directives'
import { createTablePagination, createTableSorter, DEFAULT_PAGE_SIZE, enhanceTableColumns, formatDate, getTableSorterParams, normalizeTableSorter } from '@/utils'
import {
  CLIENT_UNIT_STATUS,
  CLIENT_UNIT_STATUS_META,
  CUSTOMER_LEVEL,
  CUSTOMER_LEVEL_META,
  CUSTOMER_STAGE_META,
  IMPORT_BATCH_STATUS,
  IMPORT_BATCH_STATUS_META,
  IMPORT_ROW_STATUS_META,
  metaToOptions,
} from '../shared/constants'
import { useBusinessStore } from '../shared/useBusinessStore'

const router = useRouter()
const store = useBusinessStore()
const { isMobile } = useResponsiveLayout()

const canAddClient = computed(() => hasPermission('AddClient'))
const canEditClient = computed(() => hasPermission('EditClient'))
const canDeleteClient = computed(() => hasPermission('DeleteClient'))
const canImportClient = computed(() => hasPermission('ImportClient'))
const canViewClientImport = computed(() => hasPermission('ViewClientImport') || canImportClient.value)
const canConfirmClientImport = computed(() => hasPermission('ConfirmClientImport'))
const canDeleteClientImport = computed(() => hasPermission('DeleteClientImport'))
const canMaintainClientLevel = computed(() => hasPermission('MaintainClientLevel'))

const pagination = reactive(createTablePagination({ page: 1 }))
const importBatchPagination = reactive(createTablePagination({ page: 1, pageSize: DEFAULT_PAGE_SIZE }))
const importRowPagination = reactive(createTablePagination({ page: 1, pageSize: DEFAULT_PAGE_SIZE }))
const clientSorter = ref(createTableSorter())
const showClientDrawer = ref(false)
const showImportDrawer = ref(false)
const showImportDetailDrawer = ref(false)
const submitting = ref(false)
const importing = ref(false)
const importBatchLoading = ref(false)
const importDetailLoading = ref(false)
const importFileInput = ref(null)
const importFile = ref(null)
const editingClient = ref(null)
const importActiveTab = ref('upload')
const importBatches = ref([])
const selectedImportBatch = ref(null)
const importRows = ref([])
const importRowStatusFilter = ref(null)

const filters = reactive(createEmptyFilters())
const clientForm = reactive(createEmptyClientForm())
const formDrawerWidth = computed(() => (isMobile.value ? '100%' : 760))
const importDrawerWidth = computed(() => (isMobile.value ? '100%' : 980))
const importDetailDrawerWidth = computed(() => (isMobile.value ? '100%' : 1180))

const unitStatusMap = CLIENT_UNIT_STATUS_META
const customerStageMap = CUSTOMER_STAGE_META
const customerLevelMap = CUSTOMER_LEVEL_META

const unitStatusOptions = metaToOptions(unitStatusMap)
const customerStageOptions = metaToOptions(customerStageMap)
const customerLevelFilterOptions = metaToOptions(customerLevelMap)
const customerLevelOptions = Object.values(CUSTOMER_LEVEL).map(value => ({ label: customerLevelMap[value].label, value }))
const hasOrderOptions = [
  { label: '有订单', value: 'yes' },
  { label: '无订单', value: 'no' },
]
const importBatchStatusMap = IMPORT_BATCH_STATUS_META
const importRowStatusMap = IMPORT_ROW_STATUS_META
const importRowStatusOptions = metaToOptions(importRowStatusMap)

const columns = computed(() => enhanceTableColumns([
  { title: '区划', key: 'regionName', width: 96, remoteSortable: true },
  { title: '单位编码', key: 'unitCode', width: 112, remoteSortable: true },
  { title: '单位名称', key: 'unitName', minWidth: 280, ellipsis: { tooltip: true }, remoteSortable: true },
  { title: '客户阶段', key: 'customerStage', width: 112, render: row => renderTag(customerStageMap, row.customerStage) },
  { title: '客户等级', key: 'customerLevel', width: 112, remoteSortable: true, render: row => renderTag(customerLevelMap, row.customerLevel) },
  { title: '单位状态', key: 'unitStatus', width: 104, remoteSortable: true, render: row => renderTag(unitStatusMap, row.unitStatus) },
  { title: '主要联系人', key: 'primaryContactName', width: 120, remoteSortable: true, render: row => row.primaryContactName || '-' },
  { title: '联系电话', key: 'primaryContactPhone', width: 136, remoteSortable: true, render: row => row.primaryContactPhone || '-' },
  { title: '订单数', key: 'orderCount', width: 90, align: 'center', remoteSortable: true, render: row => h(NButton, { text: true, type: 'primary', onClick: () => openClientServices(row) }, { default: () => String(row.orderCount || 0) }) },
  { title: '最近订单日期', key: 'latestOrderDate', width: 132, remoteSortable: true, render: row => row.latestOrderDate ? formatDate(row.latestOrderDate) : '-' },
  { title: '累计应收', key: 'receivableAmount', width: 120, align: 'right', remoteSortable: true, render: row => `￥${formatMoney(row.receivableAmount)}` },
  { title: '已收金额', key: 'receivedAmount', width: 120, align: 'right', remoteSortable: true, render: row => `￥${formatMoney(row.receivedAmount)}` },
  { title: '未收金额', key: 'unpaidAmount', width: 120, align: 'right', remoteSortable: true, render: row => `￥${formatMoney(row.unpaidAmount)}` },
  {
    title: '操作',
    key: 'actions',
    width: 210,
    fixed: 'right',
    render(row) {
      return [
        h(NButton, { size: 'small', type: 'primary', secondary: true, onClick: () => openDetail(row) }, { default: () => '详情' }),
        canEditClient.value
          ? h(NButton, { size: 'small', secondary: true, onClick: () => openEditDrawer(row) }, { default: () => '编辑' })
          : null,
        canDeleteClient.value
          ? h(NButton, { size: 'small', text: true, type: 'error', onClick: () => deleteClient(row) }, { default: () => '删除' })
          : null,
      ].filter(Boolean)
    },
  },
], { remote: true }))

const importBatchColumns = computed(() => enhanceTableColumns([
  { title: '文件名', key: 'sourceFileName', minWidth: 220, ellipsis: { tooltip: true } },
  { title: '状态', key: 'status', width: 100, render: row => renderTag(importBatchStatusMap, row.status) },
  { title: '总行数', key: 'totalRows', width: 90 },
  { title: '有效', key: 'validRows', width: 80 },
  { title: '警告', key: 'warningRows', width: 80 },
  { title: '错误', key: 'errorRows', width: 80 },
  { title: '已入库', key: 'importedRows', width: 90 },
  { title: '导入人', key: 'importedByName', width: 120, render: row => row.importedByName || '-' },
  { title: '导入时间', key: 'importedAt', width: 120, render: row => formatDate(row.importedAt) },
  {
    title: '操作',
    key: 'actions',
    width: 250,
    fixed: 'right',
    render(row) {
      return [
        h(NButton, { size: 'small', secondary: true, onClick: () => openImportDetail(row) }, { default: () => '明细' }),
        canConfirmClientImport.value && row.status !== IMPORT_BATCH_STATUS.CONFIRMED
          ? h(NButton, { size: 'small', type: 'primary', secondary: true, onClick: () => confirmImportBatch(row) }, { default: () => '确认入库' })
          : null,
        canImportClient.value && row.status !== IMPORT_BATCH_STATUS.CONFIRMED
          ? h(NButton, { size: 'small', secondary: true, onClick: () => revalidateImportBatch(row) }, { default: () => '重校验' })
          : null,
        canDeleteClientImport.value && row.status !== IMPORT_BATCH_STATUS.CONFIRMED
          ? h(NButton, { size: 'small', text: true, type: 'error', onClick: () => deleteImportBatch(row) }, { default: () => '删除' })
          : null,
      ].filter(Boolean)
    },
  },
], { remote: true }))

const importRowColumns = computed(() => enhanceTableColumns([
  { title: '行号', key: 'rowNo', width: 80 },
  { title: '状态', key: 'validationStatus', width: 90, render: row => renderTag(importRowStatusMap, row.validationStatus) },
  { title: '区划', key: 'regionName', width: 100, render: row => row.normalizedJson?.regionName || '-' },
  { title: '单位编码', key: 'unitCode', width: 110, render: row => row.normalizedJson?.unitCode || '-' },
  { title: '单位名称', key: 'unitName', minWidth: 240, ellipsis: { tooltip: true }, render: row => row.normalizedJson?.unitName || '-' },
  { title: '联系电话', key: 'contactPhone', width: 140, render: row => row.normalizedJson?.contactPhone || '-' },
  { title: '说明', key: 'validationMessage', minWidth: 260, ellipsis: { tooltip: true }, render: row => row.validationMessage || '-' },
], { remote: true }))

onMounted(async () => {
  await Promise.all([
    store.loadDictionaries(),
    store.loadServiceCatalog(),
    loadClients(),
  ])
})

function createEmptyFilters() {
  return {
    regionCode: null,
    keyword: '',
    customerStage: null,
    customerLevel: null,
    unitStatus: null,
    contact: '',
    hasOrders: null,
  }
}

function createEmptyClientForm() {
  return {
    regionCode: null,
    unitCode: '',
    unitName: '',
    unitStatus: CLIENT_UNIT_STATUS.NORMAL,
    customerLevel: CUSTOMER_LEVEL.NORMAL,
    unifiedSocialCreditCode: '',
    address: '',
    remark: '',
  }
}

function getListParams() {
  return {
    pageNo: pagination.page,
    pageSize: pagination.pageSize,
    regionCode: filters.regionCode || undefined,
    keyword: filters.keyword.trim() || undefined,
    customerStage: filters.customerStage || undefined,
    customerLevel: filters.customerLevel || undefined,
    unitStatus: filters.unitStatus || undefined,
    contact: filters.contact.trim() || undefined,
    hasOrders: filters.hasOrders || undefined,
    ...getTableSorterParams(clientSorter.value),
  }
}

async function loadClients() {
  store.loading = true
  try {
    const data = await store.loadClients(getListParams())
    pagination.itemCount = data?.total || 0
  }
  finally {
    store.loading = false
  }
}

async function handlePageChange(page) {
  pagination.page = page
  await loadClients()
}

async function handlePageSizeChange(pageSize) {
  pagination.page = 1
  pagination.pageSize = pageSize
  await loadClients()
}

async function handleSorterChange(sorter) {
  clientSorter.value = normalizeTableSorter(sorter)
  pagination.page = 1
  await loadClients()
}

async function resetFilters() {
  Object.assign(filters, createEmptyFilters())
  pagination.page = 1
  await loadClients()
}

async function openImportDrawer() {
  showImportDrawer.value = true
  importActiveTab.value = 'upload'
  if (canViewClientImport.value)
    await loadImportBatches()
}

function openCreateDrawer() {
  editingClient.value = null
  Object.assign(clientForm, createEmptyClientForm())
  showClientDrawer.value = true
}

function openEditDrawer(row) {
  editingClient.value = row
  Object.assign(clientForm, {
    ...createEmptyClientForm(),
    regionCode: row.regionCode,
    unitCode: row.unitCode,
    unitName: row.unitName,
    unitStatus: row.unitStatus || CLIENT_UNIT_STATUS.NORMAL,
    customerLevel: row.customerLevel || CUSTOMER_LEVEL.NORMAL,
    unifiedSocialCreditCode: row.unifiedSocialCreditCode || '',
    address: row.address || '',
    remark: row.remark || '',
  })
  showClientDrawer.value = true
}

function openDetail(row) {
  router.push(`/clients/${row.id}`)
}

function openClientServices(row) {
  router.push({ path: `/clients/${row.id}`, query: { tab: 'services' } })
}

async function submitClient() {
  const error = validateClientForm()
  if (error) {
    $message.warning(error)
    return
  }
  submitting.value = true
  try {
    const payload = createClientPayload()
    if (!canMaintainClientLevel.value) {
      delete payload.customerLevel
      delete payload.unitStatus
    }
    if (editingClient.value)
      await store.updateClient(editingClient.value.id, payload, getListParams(), { refreshOrders: false })
    else
      await store.addClient(payload, getListParams())
    $message.success('客户已保存')
    showClientDrawer.value = false
    await loadClients()
  }
  finally {
    submitting.value = false
  }
}

function validateClientForm() {
  if (editingClient.value)
    return ''
  if (!clientForm.regionCode)
    return '请选择区划'
  if (!/^\d{6}$/.test(clientForm.unitCode.trim()))
    return '单位编码必须是 6 位数字'
  if (!clientForm.unitName.trim())
    return '请填写单位名称'
  return ''
}

function createClientPayload() {
  const payload = {
    unitStatus: clientForm.unitStatus,
    customerLevel: clientForm.customerLevel,
    unifiedSocialCreditCode: clientForm.unifiedSocialCreditCode,
    address: clientForm.address,
    remark: clientForm.remark,
  }
  if (!editingClient.value) {
    payload.regionCode = clientForm.regionCode
    payload.unitCode = clientForm.unitCode.trim()
    payload.unitName = clientForm.unitName.trim()
  }
  return payload
}

async function deleteClient(row) {
  $dialog.warning({
    title: '删除客户',
    content: `确认删除「${row.unitName}」？已有订单或服务项的客户不会被删除。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      await store.deleteClient(row.id, getListParams())
      $message.success('客户已删除')
      await loadClients()
    },
  })
}

function handleImportFileChange(event) {
  importFile.value = event.target.files?.[0] || null
}

async function submitImport() {
  if (!importFile.value)
    return
  importing.value = true
  try {
    await store.importClientUnitDirectory(importFile.value, 'client_unit_directory')
    $message.success('导入文件已解析，请确认入库')
    importFile.value = null
    if (importFileInput.value)
      importFileInput.value.value = ''
    importActiveTab.value = 'records'
    await loadImportBatches()
    await loadClients()
  }
  finally {
    importing.value = false
  }
}

async function loadImportBatches() {
  importBatchLoading.value = true
  try {
    const data = await store.clientImportBatches({
      pageNo: importBatchPagination.page,
      pageSize: importBatchPagination.pageSize,
      sourceType: 'client_unit_directory',
    })
    importBatches.value = data?.pageData || data || []
    importBatchPagination.itemCount = data?.total || importBatches.value.length
  }
  finally {
    importBatchLoading.value = false
  }
}

async function handleImportBatchPageChange(page) {
  importBatchPagination.page = page
  await loadImportBatches()
}

async function handleImportBatchPageSizeChange(pageSize) {
  importBatchPagination.page = 1
  importBatchPagination.pageSize = pageSize
  await loadImportBatches()
}

async function openImportDetail(row) {
  selectedImportBatch.value = row
  importRowStatusFilter.value = null
  importRowPagination.page = 1
  showImportDetailDrawer.value = true
  await loadImportDetail()
}

async function loadImportDetail() {
  if (!selectedImportBatch.value)
    return
  importDetailLoading.value = true
  try {
    const data = await store.clientImportBatchDetail(selectedImportBatch.value.id, {
      pageNo: importRowPagination.page,
      pageSize: importRowPagination.pageSize,
      validationStatus: importRowStatusFilter.value || undefined,
    })
    selectedImportBatch.value = data
    importRows.value = data?.rows || []
    importRowPagination.itemCount = data?.rowTotal || 0
  }
  finally {
    importDetailLoading.value = false
  }
}

async function handleImportRowPageChange(page) {
  importRowPagination.page = page
  await loadImportDetail()
}

async function handleImportRowPageSizeChange(pageSize) {
  importRowPagination.page = 1
  importRowPagination.pageSize = pageSize
  await loadImportDetail()
}

async function revalidateImportBatch(row) {
  await store.revalidateClientImport(row.id)
  $message.success('导入批次已重新校验')
  await Promise.all([loadImportBatches(), selectedImportBatch.value?.id === row.id ? loadImportDetail() : Promise.resolve()])
}

async function confirmImportBatch(row) {
  $dialog.warning({
    title: '确认入库',
    content: `确认将「${row.sourceFileName}」中的有效和警告行写入客户库？`,
    positiveText: '确认入库',
    negativeText: '取消',
    onPositiveClick: async () => {
      const rowIds = await store.clientImportableRowIds(row.id)
      if (!rowIds.length) {
        $message.warning('没有可入库的行')
        return
      }
      await store.confirmClientImport(row.id, rowIds)
      $message.success('客户已确认入库')
      await Promise.all([loadImportBatches(), loadClients()])
      if (selectedImportBatch.value?.id === row.id)
        await loadImportDetail()
    },
  })
}

async function deleteImportBatch(row) {
  $dialog.warning({
    title: '删除导入暂存',
    content: `确认删除「${row.sourceFileName}」的导入暂存？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      await store.deleteClientImportBatch(row.id)
      $message.success('导入暂存已删除')
      if (selectedImportBatch.value?.id === row.id) {
        showImportDetailDrawer.value = false
        selectedImportBatch.value = null
      }
      await loadImportBatches()
    },
  })
}

function renderTag(map, value) {
  const meta = map[value] || { label: value || '-', type: 'default' }
  return h(NTag, { type: meta.type, size: 'small', bordered: false }, { default: () => meta.label })
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
</script>

<style scoped>
.client-hub {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 0;
}

.client-hub-filter {
  margin-bottom: 0 !important;
  border-color: #e5ebf0;
  border-bottom-color: #edf1f5;
  border-radius: 6px 6px 0 0;
}

.client-hub-table {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e5ebf0;
  border-top: 0;
  border-radius: 0 0 6px 6px;
  background: #fff;
  box-shadow: none;
}

.client-hub-table :deep(.enhanced-table) {
  min-height: 0;
  flex: 1 1 auto;
}

.client-hub-table :deep(.n-data-table-wrapper) {
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.client-import-panel p {
  margin: 4px 0 0;
  color: #607089;
  font-size: 13px;
}

.client-import-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.client-import-native {
  display: grid;
  gap: 10px;
  justify-items: center;
  border: 1px dashed rgba(var(--zenith-primary-color), 0.32);
  border-radius: 8px;
  background: #f8fbfb;
  padding: 28px 18px;
}

.client-import-input {
  max-width: 100%;
}

.client-import-icon {
  margin-bottom: 8px;
  color: #2f7f84;
  font-size: 32px;
}
</style>
