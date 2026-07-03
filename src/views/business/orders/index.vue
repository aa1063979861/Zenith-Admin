<template>
  <CommonPage title="订单管理" class="order-workbench zenith-data-page">
    <n-alert v-if="lastActionMessage" type="success" :bordered="false" class="mb-12" closable @close="lastActionMessage = ''">
      {{ lastActionMessage }}
    </n-alert>

    <section class="order-filter-panel">
      <n-form class="zenith-filter-bar order-filter-form" data-filter-collapsed-rows="all" label-placement="left" label-width="76" :model="orderFilters" :show-feedback="false">
        <n-grid cols="1 m:2 l:5" :x-gap="14" :y-gap="12" responsive="screen">
          <n-form-item-gi label="关键词">
            <n-input v-model:value="orderFilters.keyword" clearable placeholder="订单号 / 单位 / 编码 / 备注" @keydown.enter="searchOrders" />
          </n-form-item-gi>
          <n-form-item-gi label="区划">
            <n-select v-model:value="orderFilters.regionCode" clearable filterable :options="store.regionOptions" placeholder="全部区划" />
          </n-form-item-gi>
          <n-form-item-gi label="年度">
            <AppDatePicker v-model:formatted-value="orderFilterYearText" type="year" value-format="yyyy" clearable placeholder="全部年度" />
          </n-form-item-gi>
          <n-form-item-gi label="汇总状态">
            <n-select v-model:value="orderFilters.status" clearable :options="ORDER_STATUS_OPTIONS" placeholder="全部状态" />
          </n-form-item-gi>
          <n-form-item-gi class="zenith-filter-actions" span="1 m:2 l:5">
            <n-space>
              <NButton type="primary" @click="searchOrders">
                <i class="i-fe:search mr-4" />
                查询
              </NButton>
              <NButton secondary @click="resetOrderFilters">
                重置
              </NButton>
              <NButton v-permission="'AddOrder'" type="primary" @click="openCreateDrawer">
                <i class="i-fe:plus mr-4" />
                新建订单
              </NButton>
              <NButton secondary :disabled="!store.orders.length" @click="exportVisibleOrders">
                <i class="i-fe:download mr-4" />
                导出
              </NButton>
              <NButton secondary @click="refreshAll">
                <i class="i-fe:refresh-cw mr-4" />
                刷新
              </NButton>
            </n-space>
          </n-form-item-gi>
        </n-grid>
      </n-form>
    </section>

    <section class="order-command-layout">
      <section class="order-list-panel">
        <EnhancedDataTable
          class="order-master-table"
          storage-key="business.orders"
          :loading="orderLoading"
          :columns="enhancedOrderColumns"
          :data="store.orders"
          :pagination="ordersPagination"
          :checked-row-keys="checkedOrderRowKeys"
          flex-height
          mobile-mode="table"
          mobile-primary-key="orderClientSummary"
          mobile-status-key="businessStatus"
          :mobile-secondary-keys="['serviceYear', 'serviceNames']"
          :mobile-meta-keys="['financeSummary', 'attachmentCount']"
          :row-action="canEditOrder ? openEditOrderDrawer : undefined"
          remote
          size="small"
          :show-toolbar="false"
          @update:checked-row-keys="handleCheckedOrderRows"
          @update:page="handleOrdersPageChange"
          @update:page-size="handleOrdersPageSizeChange"
          @update:sorter="handleOrdersSorterChange"
        />

        <div v-if="checkedOrderRows.length" class="selected-summary-bar">
          <span>已选 {{ checkedOrderRows.length }} 条</span>
          <strong>服务项 {{ selectedOrderSummary.serviceItemCount }}</strong>
          <strong>金额 ￥{{ formatCurrency(selectedOrderSummary.billableAmount) }}</strong>
          <strong>已收 ￥{{ formatCurrency(selectedOrderSummary.receivedAmount) }}</strong>
          <strong>未收 ￥{{ formatCurrency(selectedOrderSummary.unreceivedAmount) }}</strong>
        </div>
      </section>
    </section>

    <n-modal
      v-model:show="showCreateDrawer"
      preset="card"
      :title="orderDrawerTitle"
      class="order-edit-modal"
      style="width: min(980px, calc(100vw - 40px));"
      :mask-closable="false"
    >
      <n-alert v-if="createError" class="mb-12" type="error" :bordered="false">
        {{ createError }}
      </n-alert>
      <n-alert v-if="orderSetupMissingReason" class="mb-12" type="warning" :bordered="false">
        <div class="setup-alert">
          <span>{{ orderSetupMissingReason }}</span>
          <NButton v-if="canUseSetupAction" size="small" text type="primary" @click="goSetupAction">
            {{ setupAction.label }}
          </NButton>
        </div>
      </n-alert>

      <div class="order-modal-section-title">
        <span>基本信息</span>
      </div>
      <n-form class="order-basic-form" label-placement="top" :model="orderForm" :show-feedback="false">
        <n-grid class="order-basic-grid" cols="1 m:2 l:4" :x-gap="14" :y-gap="12" responsive="screen">
          <n-form-item-gi label="区划">
            <n-select
              v-model:value="orderForm.regionCode"
              data-testid="order-region-select"
              :disabled="isEditingOrderForm"
              :options="store.regionOptions"
              placeholder="选择区划"
              @update:value="handleRegionChange"
            />
          </n-form-item-gi>
          <n-form-item-gi span="1 m:2 l:2" label="单位名称">
            <n-select
              v-model:value="orderClientSelectValue"
              data-testid="order-client-select"
              :disabled="isEditingOrderForm || !orderForm.regionCode"
              :multiple="!isEditingOrderForm"
              :max-tag-count="2"
              :options="filteredClientOptions"
              filterable
              placeholder="选择单位，可多选"
            />
          </n-form-item-gi>
          <n-form-item-gi label="服务年度">
            <AppDatePicker v-model:formatted-value="orderFormYearText" class="w-full" type="year" value-format="yyyy" placeholder="选择年度" />
          </n-form-item-gi>
          <n-form-item-gi class="order-service-field" span="1 m:2 l:4" label="服务项目">
            <n-select
              class="order-service-select"
              :value="selectedServiceCodes"
              :options="serviceProjectOptions"
              :render-option="renderServiceProjectOption"
              multiple
              filterable
              placeholder="选择服务项目，可多选"
              @update:value="handleSelectedServiceCodesChange"
            />
          </n-form-item-gi>
          <n-form-item-gi label="接单日期">
            <AppDatePicker v-model:formatted-value="orderForm.orderDate" class="w-full" type="date" clearable value-format="yyyy-MM-dd" />
          </n-form-item-gi>
          <n-form-item-gi label="接单人">
            <n-select :value="orderForm.receiverId" data-testid="order-receiver-select" :options="store.employeeOptions" filterable placeholder="选择员工" @update:value="handleOrderReceiverChange" />
          </n-form-item-gi>
          <n-form-item-gi label="订单金额">
            <n-input-number
              :value="orderAmount"
              class="order-readonly-number w-full"
              data-testid="order-amount"
              :precision="2"
              :show-button="false"
              disabled
            />
          </n-form-item-gi>
          <n-form-item-gi label="汇总状态">
            <div class="order-summary-status">
              <NTag :type="resolveStatusType(draftOrderStatus, 'order')" size="small" :bordered="false">
                {{ draftOrderStatus }}
              </NTag>
            </div>
          </n-form-item-gi>
          <n-form-item-gi span="1 m:2 l:4" label="订单备注">
            <n-input v-model:value="orderForm.remark" type="textarea" clearable :autosize="{ minRows: 1, maxRows: 4 }" placeholder="备注" />
          </n-form-item-gi>
        </n-grid>
      </n-form>

      <div class="order-modal-section-title order-modal-section-title--with-actions mt-16">
        <span>服务项信息</span>
        <small>{{ orderForm.items.length }} 项</small>
      </div>

      <n-empty v-if="!orderForm.items.length" class="service-draft-empty" description="请先选择服务项目" />
      <div v-else class="service-draft-list">
        <section v-for="(item, index) in orderForm.items" :key="item.localId" class="service-draft">
          <header class="service-draft__header">
            <div class="service-draft__title">
              <span class="service-draft__index">{{ index + 1 }}</span>
              <strong>{{ item.serviceName || `服务项 ${index + 1}` }}</strong>
            </div>
            <div class="service-draft__badges">
              <NTag :type="resolveStatusType(item.status, 'service')" size="small" :bordered="false">
                {{ item.status || '未设置' }}
              </NTag>
              <NTag v-if="Number(item.receivedAmount || 0) > 0" size="small" type="success" :bordered="false">
                已收 ￥{{ formatCurrency(item.receivedAmount) }}
              </NTag>
            </div>
          </header>

          <n-grid class="service-draft__grid" cols="1 m:2 l:4" :x-gap="12" :y-gap="8" responsive="screen">
            <n-form-item-gi label="状态">
              <n-select :value="item.status" data-testid="service-status-select" :options="SERVICE_ITEM_STATUS_OPTIONS" placeholder="选择状态" @update:value="value => handleDraftStatusChange(item, value)" />
            </n-form-item-gi>
            <n-form-item-gi label="完成人">
              <n-select v-model:value="item.performerId" data-testid="performer-select" :options="store.employeeOptions" filterable placeholder="默认同接单人，可修改" />
            </n-form-item-gi>
            <n-form-item-gi label="金额">
              <n-input-number
                :value="getItemAmount(item)"
                class="w-full"
                data-testid="service-amount"
                :min="0"
                :precision="2"
                :show-button="false"
                @update:value="value => setItemAmount(item, value)"
              />
            </n-form-item-gi>
            <n-form-item-gi v-if="serviceNeedsDate(item.serviceCode)" label="服务开始日期">
              <AppDatePicker v-model:formatted-value="item.serviceStartDate" class="w-full" type="date" clearable value-format="yyyy-MM-dd" />
            </n-form-item-gi>
            <n-form-item-gi v-if="serviceNeedsDate(item.serviceCode)" label="服务到期日期">
              <AppDatePicker v-model:formatted-value="item.serviceEndDate" class="w-full" type="date" clearable value-format="yyyy-MM-dd" />
            </n-form-item-gi>
            <n-form-item-gi v-if="serviceNeedsDate(item.serviceCode)" label="最低服务期">
              <NTag v-if="getServiceMinMonths(item.serviceCode)" type="warning" size="small">
                {{ getServiceMinMonths(item.serviceCode) }} 个月
              </NTag>
              <span v-else class="text-13 color-#64748b">无固定期限</span>
            </n-form-item-gi>
            <n-form-item-gi label="备注">
              <n-input v-model:value="item.remark" clearable placeholder="备注" />
            </n-form-item-gi>
          </n-grid>
        </section>
      </div>

      <template #footer>
        <n-space justify="end">
          <NButton @click="showCreateDrawer = false">
            取消
          </NButton>
          <NButton type="primary" :disabled="Boolean(orderSetupMissingReason)" :loading="saving" @click="submitOrder">
            {{ isEditingOrderForm ? '保存修改' : '保存订单' }}
          </NButton>
        </n-space>
      </template>
    </n-modal>

    <n-modal v-model:show="showDeleteModal" preset="card" title="删除订单" class="order-delete-modal" style="width: min(520px, calc(100vw - 32px));">
      <n-alert v-if="deleteError" class="mb-12" type="error" :bordered="false">
        {{ deleteError }}
      </n-alert>
      <div class="delete-order-summary">
        <div class="delete-order-heading">
          <span>将删除订单</span>
          <strong>{{ deleteForm.orderNo }}</strong>
        </div>
        <dl class="delete-order-meta">
          <div>
            <dt>服务单位</dt>
            <dd>{{ deleteForm.clientName || '-' }}</dd>
          </div>
          <div>
            <dt>年度</dt>
            <dd>{{ deleteForm.serviceYear || '-' }}</dd>
          </div>
          <div>
            <dt>服务项目</dt>
            <dd>{{ deleteForm.serviceNames || '-' }}</dd>
          </div>
          <div>
            <dt>服务项</dt>
            <dd>{{ deleteForm.serviceItemCount }} 个</dd>
          </div>
          <div>
            <dt>应收金额</dt>
            <dd>￥{{ formatCurrency(deleteForm.billableAmount) }}</dd>
          </div>
          <div>
            <dt>当前状态</dt>
            <dd>{{ deleteForm.status || '-' }}</dd>
          </div>
        </dl>
      </div>
      <n-input
        v-model:value="deleteForm.reason"
        type="textarea"
        :autosize="{ minRows: 3, maxRows: 5 }"
        maxlength="500"
        show-count
        placeholder="填写删除原因"
      />
      <template #footer>
        <n-space justify="end">
          <NButton @click="showDeleteModal = false">
            返回
          </NButton>
          <NButton type="error" :loading="deleteSaving" @click="submitDeleteOrder">
            确认删除
          </NButton>
        </n-space>
      </template>
    </n-modal>

    <n-modal
      v-if="showAttachmentModal"
      v-model:show="showAttachmentModal"
      preset="card"
      title="订单附件"
      class="order-upload-modal"
      style="width: min(560px, calc(100vw - 32px));"
    >
      <n-alert v-if="attachmentError" class="mb-12" type="error" :bordered="false">
        {{ attachmentError }}
      </n-alert>
      <div class="order-modal-target">
        <span>目标订单</span>
        <strong>{{ attachmentForm.orderNo }}</strong>
      </div>
      <div class="order-attachment-list">
        <n-spin :show="attachmentLoading">
          <n-empty v-if="!attachmentRows.length" description="暂无附件" />
          <div v-else class="order-attachment-links">
            <a v-for="file in attachmentRows" :key="file.id" :href="file.fileUrl" target="_blank" rel="noopener">
              <span>{{ file.tag }}</span>
              <strong>{{ file.name }}</strong>
            </a>
          </div>
        </n-spin>
      </div>
      <n-select v-model:value="attachmentForm.tag" class="mb-12" :options="ORDER_ATTACHMENT_TAG_OPTIONS" placeholder="选择附件类型" />
      <n-upload :max="1" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" :default-upload="false" @change="handleAttachmentFileChange">
        <n-upload-dragger>
          <div class="order-upload-icon">
            <span class="order-upload-glyph" aria-hidden="true" />
          </div>
          <n-text>点击或拖拽文件到此处</n-text>
        </n-upload-dragger>
      </n-upload>
      <n-input v-model:value="attachmentForm.remark" class="mt-12" type="textarea" clearable :autosize="{ minRows: 2, maxRows: 4 }" placeholder="备注" />
      <template #footer>
        <n-space justify="end">
          <NButton @click="showAttachmentModal = false">
            取消
          </NButton>
          <NButton type="primary" :loading="attachmentSaving" :disabled="!attachmentFile" @click="submitAttachmentUpload">
            上传附件
          </NButton>
        </n-space>
      </template>
    </n-modal>
  </CommonPage>
</template>

<script setup>
import { NButton, NCheckbox, NTag } from 'naive-ui'
import { AppDatePicker, CommonPage, EnhancedDataTable } from '@/components/common'
import { hasPermission } from '@/directives'
import { useAppStore } from '@/store'
import { createTablePagination, createTableSorter, DEFAULT_PAGE_SIZE, downloadCsv, enhanceTableColumns, getTableSorterParams, normalizeTableSorter } from '@/utils'
import { businessApi } from '../shared/api'
import { formatCurrency } from '../shared/format'
import { useBusinessStore } from '../shared/useBusinessStore'
import { ORDER_CONTRACT_STATUS, ORDER_INVOICE_STATUS, ORDER_STATUS_OPTIONS, resolveOrderStatusByServiceStatuses, SERVICE_ITEM_STATUS_OPTIONS } from './constants'

defineOptions({ name: 'OrderService' })

const ORDER_ATTACHMENT_PAGE_SIZE = 100
const ORDER_SERVICE_NAME_VISIBLE_LIMIT = 2

const store = useBusinessStore()
const appStore = useAppStore()
const route = useRoute()
const router = useRouter()

const orderLoading = ref(false)
const saving = ref(false)
const deleteSaving = ref(false)
const attachmentSaving = ref(false)
const orderFormMode = ref('create')
const showCreateDrawer = ref(false)
const showDeleteModal = ref(false)
const showAttachmentModal = ref(false)
const createError = ref('')
const deleteError = ref('')
const attachmentError = ref('')
const lastActionMessage = ref('')
const attachmentFile = ref(null)
const attachmentRows = ref([])
const attachmentLoading = ref(false)
const checkedOrderRowKeys = ref([])
const filteredClientOptions = ref([])
const orderForm = reactive(createEmptyOrderForm())
const deleteForm = reactive(createEmptyDeleteForm())
const attachmentForm = reactive(createEmptyAttachmentForm())
const orderFilters = reactive(createEmptyOrderFilters())
const ordersPagination = reactive(createTablePagination({ page: 1, pageSize: DEFAULT_PAGE_SIZE, itemCount: 0 }))
const ordersSorter = ref(createTableSorter())
const ORDER_ATTACHMENT_TAG_OPTIONS = ['客户资料', '交付成果', '回执证明', '业务资料', '其他'].map(value => ({ label: value, value }))

const isEditingOrderForm = computed(() => orderFormMode.value === 'edit')
const orderDrawerTitle = computed(() => isEditingOrderForm.value ? `编辑订单：${orderForm.orderNo || ''}` : '新增订单')
const orderAmount = computed(() => roundMoney(orderForm.items.reduce((sum, item) => sum + getItemAmount(item), 0)))
const draftOrderStatus = computed(() => {
  if (orderForm.status === '已取消')
    return '已取消'
  return resolveOrderStatusByServiceStatuses(orderForm.items.map(item => item.status || '进行中'))
})
const orderSetupMissingReason = computed(() => {
  if (!store.regionOptions.length)
    return '请先在系统设置配置启用的区划。'
  if (!store.serviceOptions.length)
    return '请先在系统设置配置启用的服务项。'
  if (!store.employeeOptions.length)
    return '请先在组织管理维护在职员工。'
  return ''
})
const setupAction = computed(() => {
  if (!store.regionOptions.length) {
    return {
      label: '去基础设置',
      path: '/settings',
      permissions: ['MaintainDictionary', 'AddDictionaryItem', 'EditDictionaryItem', 'ToggleDictionaryItem'],
    }
  }
  if (!store.serviceOptions.length) {
    return {
      label: '去基础设置',
      path: '/settings',
      permissions: ['AddServiceCatalog', 'EditServiceCatalog', 'ToggleServiceCatalog'],
    }
  }
  if (!store.employeeOptions.length) {
    return {
      label: '去组织管理',
      path: '/team',
      permissions: ['EditTeamProfile', 'AddUser'],
    }
  }
  return null
})
const canUseSetupAction = computed(() => {
  return Boolean(setupAction.value?.permissions?.some(code => hasPermission(code)))
})
const orderFilterYearText = computed({
  get: () => orderFilters.serviceYear ? String(orderFilters.serviceYear) : null,
  set: value => orderFilters.serviceYear = parseYearValue(value),
})
const orderFormYearText = computed({
  get: () => orderForm.serviceYear ? String(orderForm.serviceYear) : null,
  set: value => orderForm.serviceYear = parseYearValue(value),
})
const orderClientSelectValue = computed({
  get: () => isEditingOrderForm.value ? orderForm.clientId : orderForm.clientIds,
  set(value) {
    if (isEditingOrderForm.value) {
      orderForm.clientId = value
      orderForm.clientIds = value ? [value] : []
      return
    }
    orderForm.clientIds = Array.isArray(value) ? value : []
    orderForm.clientId = orderForm.clientIds[0] || null
  },
})
const selectedServiceCodes = computed(() => orderForm.items.map(item => item.serviceCode).filter(Boolean))
const serviceProjectOptions = computed(() => {
  const currentOptions = orderForm.items
    .filter(item => item.serviceCode && item.serviceName && !store.serviceOptions.some(option => option.value === item.serviceCode))
    .map(item => ({ label: item.serviceName, value: item.serviceCode, disabled: true }))
  return [...store.serviceOptions, ...currentOptions]
})

function renderServiceProjectOption({ node, option, selected }) {
  return h('div', node.props, [
    h('div', { class: 'n-base-select-option__content', style: 'display: flex; align-items: center; gap: 8px;' }, [
      h(NCheckbox, {
        checked: selected,
        disabled: option.disabled,
        focusable: false,
        style: 'pointer-events: none;',
      }),
      h('span', option.label),
    ]),
  ])
}

const enhancedOrderColumns = computed(() => enhanceTableColumns(orderColumns, { remote: true, selection: true }))
const checkedOrderRows = computed(() => {
  const selectedIds = new Set(checkedOrderRowKeys.value.map(String))
  return store.orders.filter(row => selectedIds.has(String(row.id)))
})
const selectedOrderSummary = computed(() => {
  return checkedOrderRows.value.reduce((summary, row) => {
    summary.serviceItemCount += Number(row.serviceItemCount || 0)
    summary.billableAmount = roundMoney(summary.billableAmount + Number(row.billableAmount || 0))
    summary.receivedAmount = roundMoney(summary.receivedAmount + Number(row.receivedAmount || 0))
    summary.unreceivedAmount = roundMoney(summary.unreceivedAmount + Number(row.unreceivedAmount || 0))
    return summary
  }, {
    serviceItemCount: 0,
    billableAmount: 0,
    receivedAmount: 0,
    unreceivedAmount: 0,
  })
})
const canEditOrder = computed(() => hasPermission('EditOrder'))
const canDeleteOrder = computed(() => hasPermission('DeleteOrder'))
const StatusTag = defineComponent({
  name: 'OrderStatusTag',
  props: {
    status: { type: String, default: '' },
    mode: { type: String, default: 'service' },
  },
  setup(props) {
    return () => h(NTag, { type: resolveStatusType(props.status, props.mode), size: 'small', bordered: false }, { default: () => props.status || '-' })
  },
})

function tableActionButton({ label = '', icon, title, type, disabled = false, onClick }) {
  const buttonTitle = title || label
  const props = {
    'class': ['order-row-action', label ? '' : 'is-icon-only'],
    'size': 'tiny',
    'text': true,
    disabled,
    'title': buttonTitle,
    'aria-label': buttonTitle,
    onClick,
  }
  if (type)
    props.type = type
  return h(NButton, props, {
    icon: () => h('i', { class: icon }),
    default: () => label,
  })
}

const orderColumns = [
  { title: '订单/单位', key: 'orderClientSummary', width: 280, render: renderOrderClientSummary },
  { title: '年度', key: 'serviceYear', width: 88, remoteSortable: true },
  { title: '服务项目', key: 'serviceNames', width: 160, render: renderServiceNames },
  { title: '金额/收款', key: 'financeSummary', width: 136, render: renderFinanceSummary },
  { title: '业务状态', key: 'businessStatus', width: 210, render: renderBusinessStatus },
  { title: '订单号', key: 'orderNo', width: 154, remoteSortable: true, defaultHidden: true },
  { title: '区划', key: 'regionName', width: 100, remoteSortable: true, defaultHidden: true },
  { title: '服务单位', key: 'clientName', minWidth: 300, remoteSortable: true, render: renderServiceUnit, defaultHidden: true },
  { title: '附件', key: 'attachmentCount', width: 90, align: 'center', render: renderAttachmentCount, defaultHidden: true },
  moneyColumn('金额', 'billableAmount', { defaultHidden: true }),
  { title: '汇总状态', key: 'status', width: 110, remoteSortable: true, render: row => h(StatusTag, { status: row.status, mode: 'order' }), defaultHidden: true },
  statusColumn('合同状态', 'contractStatus', contractStatusType, { defaultHidden: true }),
  statusColumn('发票状态', 'invoiceStatus', invoiceStatusType, { defaultHidden: true }),
  { title: '收款状态', key: 'collectionStatus', width: 110, render: row => renderCollectionStatus(row.collectionStatus), defaultHidden: true },
  { title: '接单日期', key: 'orderDate', width: 122, remoteSortable: true, defaultHidden: true },
  { title: '单位编码', key: 'unitCode', width: 120, remoteSortable: true, defaultHidden: true },
  { title: '服务项数', key: 'serviceItemCount', width: 100, defaultHidden: true },
  { title: '备注', key: 'remark', minWidth: 200, ellipsis: { tooltip: true }, defaultHidden: true, render: row => row.remark || '-' },
  {
    title: '操作',
    key: 'actions',
    width: 120,
    fixed: 'right',
    render(row) {
      return [
        canEditOrder.value
          ? tableActionButton({ label: '编辑', icon: 'i-fe:edit-2', onClick: event => openEditOrderDrawer(row, event) })
          : null,
        canDeleteOrder.value
          ? tableActionButton({
              title: '删除订单',
              icon: 'i-fe:trash-2',
              type: 'error',
              onClick: event => openDeleteOrderModal(row, event),
            })
          : null,
        tableActionButton({ title: '附件', icon: 'i-fe:paperclip', onClick: event => openAttachmentManager(row, event) }),
      ].filter(Boolean)
    },
  },
]

onMounted(() => {
  void loadBootstrap()
})

watch(() => store.orderTotal, (total) => {
  ordersPagination.itemCount = total
}, { immediate: true })

watch(() => route.query, async () => {
  if (!isOrderRoute())
    return
  applyRouteQuery()
  ordersPagination.page = 1
  checkedOrderRowKeys.value = []
  await loadOrderRows()
  await openCreateDrawerFromRouteQuery()
})

function isOrderRoute() {
  return route.path === '/orders'
}

async function loadBootstrap() {
  orderLoading.value = true
  try {
    await Promise.all([
      store.loadDictionaryDefinitions(),
      store.loadDictionaries(),
      store.loadServiceCatalog(),
      store.loadEmployees(),
    ])
    applyRouteQuery()
    await loadOrderRows({ keepLoading: true })
    await openCreateDrawerFromRouteQuery()
  }
  finally {
    orderLoading.value = false
  }
}

async function refreshAll() {
  await loadOrderRows()
}

async function loadOrderRows(options = {}) {
  if (!options.keepLoading)
    orderLoading.value = true
  try {
    const data = await store.loadOrderRows(getOrdersPageParams())
    ordersPagination.itemCount = data?.total || 0
  }
  finally {
    if (!options.keepLoading)
      orderLoading.value = false
  }
}

function getOrdersPageParams() {
  return {
    pageNo: ordersPagination.page,
    pageSize: ordersPagination.pageSize,
    ...getOrderFilterParams(),
    ...getTableSorterParams(ordersSorter.value),
  }
}

function getOrderFilterParams() {
  return compactParams({
    regionCode: orderFilters.regionCode,
    serviceYear: orderFilters.serviceYear,
    status: orderFilters.status,
    keyword: orderFilters.keyword.trim(),
  })
}

function applyRouteQuery() {
  Object.assign(orderFilters, createEmptyOrderFilters())

  const keyword = String(route.query.keyword || '').trim()
  if (keyword)
    orderFilters.keyword = keyword

  const status = String(route.query.status || '').trim()
  if (status)
    orderFilters.status = status

  const regionCode = String(route.query.regionCode || '').trim()
  if (regionCode)
    orderFilters.regionCode = regionCode

  const serviceYear = parseYearValue(route.query.serviceYear)
  if (serviceYear)
    orderFilters.serviceYear = serviceYear
}

async function searchOrders() {
  ordersPagination.page = 1
  checkedOrderRowKeys.value = []
  await loadOrderRows()
}

async function handleOrdersPageChange(page) {
  ordersPagination.page = page
  checkedOrderRowKeys.value = []
  await loadOrderRows()
}

async function handleOrdersPageSizeChange(pageSize) {
  ordersPagination.page = 1
  ordersPagination.pageSize = pageSize
  checkedOrderRowKeys.value = []
  await loadOrderRows()
}

async function handleOrdersSorterChange(sorter) {
  ordersSorter.value = normalizeTableSorter(sorter)
  ordersPagination.page = 1
  checkedOrderRowKeys.value = []
  await loadOrderRows()
}

function handleCheckedOrderRows(keys) {
  checkedOrderRowKeys.value = keys
}

function resetOrderFilters() {
  Object.assign(orderFilters, createEmptyOrderFilters())
  void searchOrders()
}

function exportVisibleOrders() {
  const sourceRows = checkedOrderRows.value.length ? checkedOrderRows.value : store.orders
  const rows = sourceRows.map(row => ({
    订单号: row.orderNo,
    接单日期: row.orderDate,
    年度: row.serviceYear,
    汇总状态: row.status,
    区划: row.regionName,
    服务单位: row.clientName,
    服务项目: formatServiceNames(row.serviceNames),
    单位编码: row.unitCode,
    服务项数: row.serviceItemCount,
    金额: row.billableAmount,
    合同状态: row.contractStatus,
    发票状态: row.invoiceStatus,
    附件数: row.attachmentCount,
    已收金额: row.receivedAmount,
    未收余额: row.unreceivedAmount,
    收款状态: row.collectionStatus,
    备注: row.remark || '',
  }))
  if (!downloadCsv(`订单列表-${createTodayText()}.csv`, rows))
    lastActionMessage.value = '当前没有可导出的订单。'
}

function openCreateDrawer() {
  resetOrderForm()
  orderFormMode.value = 'create'
  showCreateDrawer.value = true
}

async function openCreateDrawerFromRouteQuery() {
  if (route.query.clientId)
    return openCreateDrawerFromClientQuery()
  if (route.query.action === 'create' && hasPermission('AddOrder'))
    openCreateDrawer()
}

async function openEditOrderDrawer(row, event) {
  if (event)
    event.stopPropagation()
  const orderId = Number(row?.id)
  if (!Number.isInteger(orderId) || orderId <= 0)
    return
  createError.value = ''
  try {
    const { data } = await businessApi.orders.detail(orderId)
    fillOrderForm(data)
    orderFormMode.value = 'edit'
    showCreateDrawer.value = true
  }
  catch (error) {
    createError.value = error?.message || '订单详情加载失败'
  }
}

function openDeleteOrderModal(row, event) {
  if (event)
    event.stopPropagation()
  if (!row?.id)
    return
  Object.assign(deleteForm, createEmptyDeleteForm(), {
    orderId: row.id,
    orderNo: row.orderNo,
    clientName: row.clientName || row.unitName || '',
    serviceYear: row.serviceYear,
    serviceNames: formatServiceNames(row.serviceNames),
    serviceItemCount: Number(row.serviceItemCount || 0),
    billableAmount: Number(row.billableAmount || 0),
    status: row.status || '',
    reason: '',
  })
  deleteError.value = ''
  showDeleteModal.value = true
}

async function openAttachmentManager(row, event) {
  if (event)
    event.stopPropagation()
  if (!row?.id)
    return
  Object.assign(attachmentForm, createEmptyAttachmentForm(), {
    tag: '业务资料',
    orderId: row.id,
    orderNo: row.orderNo,
    clientId: row.clientId,
    linkedName: row.orderNo,
  })
  attachmentFile.value = null
  attachmentError.value = ''
  attachmentRows.value = []
  showAttachmentModal.value = true
  await loadAttachmentRows()
}

function handleAttachmentFileChange({ file }) {
  attachmentFile.value = file?.file || null
}

async function loadAttachmentRows() {
  if (!attachmentForm.orderId)
    return
  attachmentLoading.value = true
  try {
    const { data } = await businessApi.archive.attachments({
      linkedType: '订单',
      linkedId: attachmentForm.orderId,
      pageNo: 1,
      pageSize: ORDER_ATTACHMENT_PAGE_SIZE,
    })
    attachmentRows.value = data?.pageData || []
  }
  finally {
    attachmentLoading.value = false
  }
}

async function openCreateDrawerFromClientQuery() {
  const clientId = Number(route.query.clientId)
  if (!Number.isInteger(clientId) || clientId <= 0)
    return
  const { data: client } = await businessApi.clients.detail(clientId)
  if (client.mergedToClientId) {
    router.replace(`/clients/${client.mergedToClientId}`)
    return
  }
  resetOrderForm()
  orderForm.regionCode = client.regionCode
  filteredClientOptions.value = await store.clientOptions(client.regionCode)
  orderForm.clientId = client.id
  orderForm.clientIds = [client.id]
  showCreateDrawer.value = true
}

async function handleRegionChange() {
  orderForm.clientId = null
  orderForm.clientIds = []
  filteredClientOptions.value = orderForm.regionCode ? await store.clientOptions(orderForm.regionCode) : []
}

function handleSelectedServiceCodesChange(codes = []) {
  const uniqueCodes = [...new Set(codes.filter(Boolean))]
  const lockedItems = orderForm.items.filter(item => Number(item.receivedAmount || 0) > 0 && !uniqueCodes.includes(item.serviceCode))
  if (lockedItems.length) {
    createError.value = `已有收款的服务项不能移除：${lockedItems.map(item => item.serviceName).join('、')}`
    return
  }
  const existingItems = new Map(orderForm.items.filter(item => item.serviceCode).map(item => [item.serviceCode, item]))
  orderForm.items = uniqueCodes.map((serviceCode) => {
    const existingItem = existingItems.get(serviceCode)
    if (existingItem)
      return existingItem
    const service = store.serviceCatalog.find(row => row.code === serviceCode)
    const draft = createDraftItem({
      serviceCode,
      serviceName: service?.name || serviceProjectOptions.value.find(option => option.value === serviceCode)?.label || '',
      performerId: createDefaultPerformerId(),
    })
    const defaultPrice = Number(service?.defaultPrice || 0)
    if (defaultPrice > 0)
      setItemAmount(draft, defaultPrice)
    return draft
  })
  createError.value = ''
}

function goSetupAction() {
  if (!setupAction.value)
    return
  showCreateDrawer.value = false
  router.push(setupAction.value.path)
}

function handleOrderReceiverChange(receiverId) {
  const previousReceiverId = orderForm.receiverId
  orderForm.receiverId = receiverId
  if (!appStore.runtimeConfig.performerDefaultsToReceiver)
    return
  orderForm.items.forEach((item) => {
    if (!item.performerId || item.performerId === previousReceiverId)
      item.performerId = receiverId
  })
}

function handleDraftStatusChange(item, status) {
  item.status = normalizeServiceItemStatus(status)
}

function getItemAmount(item) {
  return Number(item.billableAmount || 0)
}

function setItemAmount(item, value) {
  const amount = roundMoney(value)
  item.allocatedAmount = amount
  item.billableAmount = amount
}

async function submitOrder() {
  const error = validateOrderForm()
  if (error) {
    createError.value = error
    return
  }

  try {
    saving.value = true
    const payload = createOrderPayload()
    if (isEditingOrderForm.value) {
      const { data: order } = await businessApi.orders.update(orderForm.id, payload)
      lastActionMessage.value = `已保存订单 ${order.orderNo}。`
    }
    else {
      const clientIds = getSelectedClientIds()
      const orders = []
      for (const clientId of clientIds)
        orders.push(await store.addOrder({ ...payload, clientId }, { refresh: false }))
      lastActionMessage.value = orders.length === 1 ? `已创建订单 ${orders[0].orderNo}。` : `已创建 ${orders.length} 个订单。`
    }
    ordersPagination.page = 1
    checkedOrderRowKeys.value = []
    await loadOrderRows({ keepLoading: true })
    resetOrderForm()
    filteredClientOptions.value = []
    showCreateDrawer.value = false
  }
  catch (error) {
    createError.value = error?.message || '保存失败'
  }
  finally {
    saving.value = false
  }
}

function createOrderPayload() {
  return {
    regionCode: orderForm.regionCode,
    clientId: orderForm.clientId,
    serviceYear: orderForm.serviceYear,
    packageAmount: orderAmount.value,
    orderDate: orderForm.orderDate,
    remark: orderForm.remark,
    items: orderForm.items.map(item => ({
      id: item.id,
      serviceCode: item.serviceCode,
      receiverId: orderForm.receiverId,
      performerId: item.performerId,
      allocatedAmount: getItemAmount(item),
      billableAmount: getItemAmount(item),
      status: item.status,
      serviceStartDate: serviceNeedsDate(item.serviceCode) ? item.serviceStartDate : null,
      serviceEndDate: serviceNeedsDate(item.serviceCode) ? item.serviceEndDate : null,
      remark: item.remark,
    })),
  }
}

async function submitDeleteOrder() {
  const reason = deleteForm.reason.trim()
  if (!reason) {
    deleteError.value = '请填写删除原因。'
    return
  }
  try {
    deleteSaving.value = true
    const { data: order } = await businessApi.orders.delete(deleteForm.orderId, { reason })
    showDeleteModal.value = false
    lastActionMessage.value = `已删除订单 ${order.orderNo}。`
    checkedOrderRowKeys.value = []
    await loadOrderRows({ keepLoading: true })
  }
  catch (error) {
    deleteError.value = error?.message || '删除失败'
  }
  finally {
    deleteSaving.value = false
  }
}

async function submitAttachmentUpload() {
  if (!attachmentFile.value) {
    attachmentError.value = '请选择上传文件。'
    return
  }
  if (!attachmentForm.tag) {
    attachmentError.value = '请选择附件类型。'
    return
  }
  const formData = new FormData()
  formData.append('file', attachmentFile.value)
  formData.append('tag', attachmentForm.tag)
  formData.append('clientId', String(attachmentForm.clientId))
  formData.append('linkedType', '订单')
  formData.append('linkedId', String(attachmentForm.orderId))
  formData.append('linkedName', attachmentForm.linkedName)
  formData.append('remark', attachmentForm.remark)

  try {
    attachmentSaving.value = true
    await businessApi.archive.uploadAttachment(formData)
    lastActionMessage.value = `${attachmentForm.tag}已上传到订单 ${attachmentForm.orderNo}。`
    attachmentFile.value = null
    await Promise.all([loadAttachmentRows(), loadOrderRows({ keepLoading: true })])
  }
  catch (error) {
    attachmentError.value = error?.message || '上传失败'
  }
  finally {
    attachmentSaving.value = false
  }
}

function validateOrderForm() {
  if (orderSetupMissingReason.value)
    return orderSetupMissingReason.value
  if (isEditingOrderForm.value && !orderForm.id)
    return '订单不存在。'
  if (!orderForm.regionCode)
    return '请选择区划。'
  if (!getSelectedClientIds().length)
    return '请选择该区划下的单位。'
  if (!orderForm.receiverId)
    return '请选择接单人。'
  if (!Number.isInteger(orderForm.serviceYear) || orderForm.serviceYear < 2000)
    return '请填写有效服务年度。'
  if (!orderForm.orderDate)
    return '请选择接单日期。'
  if (!orderForm.items.length)
    return '至少需要一个服务项。'

  for (const [index, item] of orderForm.items.entries()) {
    const rowNo = index + 1
    const error = validateServiceLikeItem(item, `服务项 ${rowNo}`)
    if (error)
      return error
    if (Number(item.receivedAmount || 0) > getItemAmount(item))
      return `服务项 ${rowNo} 金额不能小于已收金额。`
  }
  return ''
}

function validateServiceLikeItem(item, label) {
  if (!item.serviceCode)
    return `${label} 请选择服务项。`
  if (!item.status)
    return `${label} 请选择状态。`
  if (!item.performerId)
    return `${label} 请选择完成人。`
  if (getItemAmount(item) < 0)
    return `${label} 金额不能小于 0。`

  const minMonths = getServiceMinMonths(item.serviceCode)
  if (!minMonths)
    return ''
  if (item.serviceStartDate && item.serviceEndDate && new Date(`${item.serviceEndDate}T00:00:00`) < new Date(`${item.serviceStartDate}T00:00:00`))
    return `${label} 到期日期不能早于开始日期。`
  if (minMonths && !item.serviceStartDate)
    return `${label} 需要填写服务开始日期。`
  if (minMonths && !item.serviceEndDate)
    return `${label} 需要填写服务到期日期。`
  if (minMonths && !isAtLeastMinMonths(item.serviceStartDate, item.serviceEndDate, minMonths))
    return `${label} 服务期不能少于 ${minMonths} 个月。`
  return ''
}

function getServiceMinMonths(serviceCode) {
  if (!serviceCode)
    return 0
  const service = store.serviceCatalog.find(item => item.code === serviceCode)
  return service?.minMonths || 0
}

function serviceNeedsDate(serviceCode) {
  return getServiceMinMonths(serviceCode) > 0
}

function getSelectedClientIds() {
  if (isEditingOrderForm.value)
    return orderForm.clientId ? [orderForm.clientId] : []
  return Array.isArray(orderForm.clientIds) ? orderForm.clientIds : []
}

function isAtLeastMinMonths(startText, endText, minMonths) {
  const startDate = new Date(`${startText}T00:00:00`)
  const endDate = new Date(`${endText}T00:00:00`)
  const minEndDate = new Date(startDate)
  minEndDate.setMonth(minEndDate.getMonth() + minMonths)
  minEndDate.setDate(minEndDate.getDate() - 1)
  return endDate >= minEndDate
}

function normalizeServiceItemStatus(status) {
  return status === '已上报' ? '待确认' : status
}

function createEmptyOrderFilters() {
  return {
    regionCode: null,
    serviceYear: null,
    status: null,
    keyword: '',
  }
}

function createEmptyOrderForm() {
  return {
    id: null,
    orderNo: '',
    status: '',
    regionCode: null,
    clientId: null,
    clientIds: [],
    receiverId: null,
    serviceYear: createDefaultServiceYear(),
    orderDate: createTodayText(),
    remark: '',
    items: [],
  }
}

function createDefaultServiceYear() {
  const currentYear = new Date().getFullYear()
  return appStore.runtimeConfig.serviceYearPreviousYearDefault ? currentYear - 1 : currentYear
}

function createDefaultPerformerId() {
  return appStore.runtimeConfig.performerDefaultsToReceiver ? orderForm.receiverId : null
}

function createDraftItem(overrides = {}) {
  return {
    id: null,
    localId: createLocalId(),
    serviceCode: null,
    serviceName: null,
    performerId: null,
    status: '进行中',
    allocatedAmount: 0,
    billableAmount: 0,
    receivedAmount: 0,
    serviceStartDate: null,
    serviceEndDate: null,
    remark: '',
    ...overrides,
  }
}

function createDraftItemFromService(row) {
  return {
    ...createDraftItem(),
    id: row.id,
    serviceCode: row.serviceCode,
    serviceName: row.serviceName,
    performerId: row.performerId,
    status: normalizeServiceItemStatus(row.status || '进行中'),
    allocatedAmount: Number(row.allocatedAmount || 0),
    billableAmount: Number(row.billableAmount || 0),
    receivedAmount: Number(row.receivedAmount || 0),
    serviceStartDate: row.serviceStartDate || null,
    serviceEndDate: row.serviceEndDate || null,
    remark: row.remark || '',
  }
}

function createEmptyDeleteForm() {
  return {
    orderId: null,
    orderNo: '',
    clientName: '',
    serviceYear: null,
    serviceNames: '',
    serviceItemCount: 0,
    billableAmount: 0,
    status: '',
    reason: '',
  }
}

function createEmptyAttachmentForm() {
  return {
    tag: '',
    orderId: null,
    orderNo: '',
    clientId: null,
    linkedName: '',
    remark: '',
  }
}

function resetOrderForm() {
  Object.assign(orderForm, createEmptyOrderForm())
  orderFormMode.value = 'create'
  createError.value = ''
  filteredClientOptions.value = []
}

function fillOrderForm(order) {
  const firstItem = order.serviceItems?.[0] || {}
  Object.assign(orderForm, createEmptyOrderForm(), {
    id: order.id,
    orderNo: order.orderNo,
    status: order.status || '',
    regionCode: order.regionCode,
    clientId: order.clientId,
    clientIds: [order.clientId],
    receiverId: firstItem.receiverId || null,
    serviceYear: order.serviceYear,
    orderDate: order.orderDate,
    remark: order.remark || '',
    items: (order.serviceItems || []).map(createDraftItemFromService),
  })
  filteredClientOptions.value = [{
    label: order.clientName,
    value: order.clientId,
    row: order,
  }]
}

function compactParams(source) {
  return Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined && value !== null && value !== ''))
}

function moneyColumn(title, key, extra = {}) {
  return {
    title,
    key,
    width: 120,
    remoteSortable: true,
    ...extra,
    render(row) {
      return `￥${formatCurrency(row[key])}`
    },
  }
}

function statusColumn(title, key, typeResolver, extra = {}) {
  return {
    title,
    key,
    width: 116,
    align: 'center',
    ...extra,
    render(row) {
      const status = row[key] || '-'
      return h(NTag, { type: typeResolver(status), size: 'small', bordered: false }, { default: () => status })
    },
  }
}

function renderAttachmentCount(row) {
  const count = Number(row.attachmentCount || 0)
  return h(NButton, {
    size: 'tiny',
    text: true,
    type: count > 0 ? 'primary' : 'default',
    title: '查看附件',
    onClick: event => openAttachmentManager(row, event),
  }, { default: () => `${count} 个` })
}

function renderFinanceSummary(row) {
  const billableAmount = Number(row.billableAmount || 0)
  const receivedAmount = Number(row.receivedAmount || 0)
  const unreceivedAmount = Number(row.unreceivedAmount || 0)
  const summaryText = financeSummaryText(row.collectionStatus, receivedAmount, unreceivedAmount)
  const shortText = financeSummaryShortText(row.collectionStatus, receivedAmount, unreceivedAmount)
  return h('div', {
    class: 'order-finance-summary',
    title: `订单金额 ￥${formatCurrency(billableAmount)}；${summaryText}`,
  }, [
    h('strong', `￥${formatCurrency(billableAmount)}`),
    h('span', {
      class: [
        'order-finance-summary__sub',
        unreceivedAmount > 0 ? 'is-pending' : 'is-paid',
      ],
    }, shortText),
  ])
}

function financeSummaryText(collectionStatus, receivedAmount, unreceivedAmount) {
  if (collectionStatus === '无需收款')
    return '无需收款'
  if (unreceivedAmount <= 0)
    return '已收齐'
  if (receivedAmount > 0)
    return `已收 ￥${formatCurrency(receivedAmount)} / 未收 ￥${formatCurrency(unreceivedAmount)}`
  return `待收 ￥${formatCurrency(unreceivedAmount)}`
}

function financeSummaryShortText(collectionStatus, receivedAmount, unreceivedAmount) {
  if (collectionStatus === '无需收款')
    return '无需收款'
  if (unreceivedAmount <= 0)
    return '已收齐'
  if (receivedAmount > 0)
    return `未收 ￥${formatCurrency(unreceivedAmount)}`
  return `待收 ￥${formatCurrency(unreceivedAmount)}`
}

function renderBusinessStatus(row) {
  const statuses = [
    { label: row.status || '-', type: resolveStatusType(row.status, 'order') },
    { label: compactStatusLabel('contract', row.contractStatus), type: contractStatusType(row.contractStatus) },
    { label: compactStatusLabel('invoice', row.invoiceStatus), type: invoiceStatusType(row.invoiceStatus) },
    { label: compactStatusLabel('collection', row.collectionStatus), type: collectionStatusType(row.collectionStatus) },
  ]
  return h('div', {
    class: 'order-business-status',
    title: [row.status, row.contractStatus, row.invoiceStatus, row.collectionStatus].filter(Boolean).join(' / '),
  }, statuses.map(item =>
    h(NTag, { type: item.type, size: 'small', bordered: false }, { default: () => item.label }),
  ))
}

function compactStatusLabel(kind, status) {
  const maps = {
    contract: {
      未建合同: '未建',
      草稿: '草稿',
      部分签订: '部分签',
      已签订: '已签',
    },
    invoice: {
      未开具: '未开',
      部分开票: '部分开',
      已开具: '已开',
    },
    collection: {
      待收款: '待收',
      部分收款: '部分收',
      已收齐: '已齐',
      无需收款: '无需',
    },
  }
  return maps[kind]?.[status] || '-'
}

function contractStatusType(status) {
  if (status === ORDER_CONTRACT_STATUS.SIGNED)
    return 'success'
  if (status === ORDER_CONTRACT_STATUS.PARTIAL_SIGNED || status === ORDER_CONTRACT_STATUS.DRAFT)
    return 'warning'
  return 'default'
}

function invoiceStatusType(status) {
  if (status === ORDER_INVOICE_STATUS.ISSUED)
    return 'success'
  if (status === ORDER_INVOICE_STATUS.PARTIAL_ISSUED)
    return 'warning'
  return 'default'
}

function collectionStatusType(status) {
  if (status === '已收齐')
    return 'success'
  if (status === '部分收款')
    return 'warning'
  if (status === '待收款')
    return 'error'
  return 'default'
}

function renderServiceUnit(row) {
  const targetText = row.historicalClientMergedToClientId
    ? `${row.historicalClientMergedToUnitCode || ''} ${row.historicalClientMergedToUnitName || ''}`.trim()
    : ''
  return h('div', { style: 'min-width: 0;' }, [
    h('div', { style: 'display: flex; align-items: center; gap: 6px; min-width: 0;' }, [
      h('span', { style: 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;' }, row.clientName || row.unitName || '-'),
      targetText ? h(NTag, { size: 'small', type: 'warning', bordered: false }, { default: () => '已合并' }) : null,
    ]),
    targetText
      ? h('div', { title: targetText, style: 'margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--n-text-color-3); font-size: 12px;' }, `已合并到 ${targetText}`)
      : null,
  ])
}

function renderOrderClientSummary(row) {
  const clientText = row.clientName || row.unitName || '-'
  const metaText = [row.orderNo, row.regionName].filter(Boolean).join(' · ')
  return h('div', { class: 'order-client-summary', title: `${clientText}${metaText ? `｜${metaText}` : ''}` }, [
    h('strong', clientText),
    metaText ? h('span', metaText) : null,
  ])
}

function renderServiceNames(row) {
  const names = Array.isArray(row.serviceNames) ? row.serviceNames.filter(Boolean) : []
  if (!names.length)
    return '-'

  const visibleLimit = names.length > ORDER_SERVICE_NAME_VISIBLE_LIMIT ? 1 : ORDER_SERVICE_NAME_VISIBLE_LIMIT
  const hiddenCount = Math.max(names.length - visibleLimit, 0)
  const text = names.join('、')
  return h('span', { 'class': 'order-service-names', 'title': text, 'aria-label': text }, [
    ...names.slice(0, visibleLimit).map(name =>
      h('span', { class: 'order-service-names__chip' }, name),
    ),
    hiddenCount
      ? h('span', { class: 'order-service-names__more' }, `+${hiddenCount}项`)
      : null,
  ])
}

function formatServiceNames(serviceNames) {
  if (!Array.isArray(serviceNames) || !serviceNames.length)
    return '-'
  return serviceNames.join('、')
}

function resolveStatusType(status, mode = 'service') {
  if (status === '已取消')
    return 'error'
  if (status === '已完成')
    return 'success'
  if (status === '待确认' || status === '已上报' || status === '部分完成')
    return 'info'
  if (status === '履约中')
    return 'info'
  if (status === '待客户资料' || status === '待分配' || status === '已确认')
    return 'warning'
  return mode === 'order' ? 'default' : 'info'
}

function renderCollectionStatus(status) {
  return h(NTag, { type: collectionStatusType(status), size: 'small', bordered: false }, { default: () => status || '-' })
}

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2))
}

function parseYearValue(value) {
  if (!value)
    return null
  const year = Number(value)
  return Number.isInteger(year) ? year : null
}

function createTodayText() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createLocalId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}
</script>

<style scoped>
.order-workbench :deep(.common-page-body) {
  gap: 0;
  padding: 12px !important;
}

.order-filter-panel {
  flex: 0 0 auto;
  padding: 0;
}

.order-filter-panel :deep(.zenith-filter-bar) {
  margin-bottom: 0 !important;
  border-color: #e5ebf0;
  border-bottom-color: #edf1f5;
  border-radius: 6px 6px 0 0;
}

.order-command-layout {
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

.order-list-panel {
  position: relative;
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  border: 0;
  background: transparent;
  padding: 0;
}

.order-master-table {
  flex: 1 1 auto;
  min-height: 0;
}

.order-workbench :deep(.order-master-table) {
  min-height: 0 !important;
}

.order-master-table :deep(.n-data-table-wrapper) {
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.order-master-table :deep(.n-data-table-th) {
  height: 40px;
}

.order-master-table :deep(.n-data-table-td) {
  height: 40px;
  border-color: #edf1f5;
  color: #263445;
  font-size: 13px;
}

.order-master-table :deep(.n-data-table__pagination) {
  margin-top: 8px;
}

.order-master-table :deep(.enhanced-table-actions-column) {
  padding-right: 8px;
  padding-left: 8px;
}

.order-master-table :deep(.enhanced-table-actions) {
  gap: 10px;
}

.order-master-table :deep(.order-row-action) {
  height: 24px;
  padding: 0;
  font-size: 12px;
  font-weight: 500;
}

.order-master-table :deep(.order-row-action .n-button__icon) {
  margin-right: 3px;
}

.order-master-table :deep(.order-row-action.is-icon-only) {
  width: 22px;
}

.order-master-table :deep(.order-row-action.is-icon-only .n-button__icon) {
  margin-right: 0;
}

:global(.order-service-names) {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  color: #263445;
  white-space: nowrap;
}

:global(.order-service-names__chip),
:global(.order-service-names__more) {
  display: inline-flex;
  min-width: 0;
  height: 22px;
  align-items: center;
  border-radius: 4px;
  font-size: 12px;
  line-height: 22px;
  padding: 0 6px;
}

:global(.order-service-names__chip) {
  flex: 1 1 0;
  max-width: 92px;
  border: 1px solid #dce7f1;
  background: #f8fafc;
  color: #263445;
  overflow: hidden;
  text-overflow: ellipsis;
}

:global(.order-service-names__more) {
  flex: 0 0 auto;
  background: #eef6ff;
  color: #2563eb;
  font-weight: 650;
}

:global(.order-client-summary) {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
  line-height: 1.15;
}

:global(.order-client-summary strong),
:global(.order-client-summary span) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:global(.order-client-summary strong) {
  color: #0f172a;
  font-size: 13px;
  font-weight: 650;
}

:global(.order-client-summary span) {
  color: #64748b;
  font-size: 12px;
}

:global(.order-finance-summary) {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

:global(.order-finance-summary strong) {
  color: #0f172a;
  font-size: 13px;
  font-weight: 700;
}

:global(.order-finance-summary__sub) {
  max-width: 76px;
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
}

:global(.order-finance-summary__sub.is-paid) {
  color: #16a34a;
}

:global(.order-finance-summary__sub.is-pending) {
  color: #b45309;
}

:global(.order-business-status) {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  white-space: nowrap;
}

:global(.order-business-status .n-tag) {
  flex: 0 1 auto;
  min-width: 0;
}

:global(.order-business-status .n-tag__content) {
  overflow: hidden;
  text-overflow: ellipsis;
}

.order-attachment-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  white-space: nowrap;
}

.selected-summary-bar {
  display: inline-flex;
  position: absolute;
  z-index: 2;
  bottom: 18px;
  left: 18px;
  max-width: 100%;
  width: fit-content;
  flex: 0 0 auto;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.94);
  color: #111827;
  font-size: 12px;
  line-height: 18px;
  padding: 3px 0;
}

.selected-summary-bar strong {
  color: #111827;
  font-size: 12px;
  font-weight: 700;
}

.setup-alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.setup-alert span {
  min-width: 0;
}

.order-basic-form {
  border: 1px solid #e1eaf3;
  border-radius: 8px;
  background: linear-gradient(180deg, #fff 0%, #fbfdff 100%);
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.035);
  padding: 16px;
}

.order-basic-form :deep(.n-form-item) {
  margin-bottom: 0;
}

.order-basic-form :deep(.n-form-item-label) {
  padding-bottom: 6px;
}

.order-basic-form :deep(.n-form-item-label__text) {
  color: #475569;
  font-size: 12px;
  font-weight: 650;
  line-height: 18px;
}

.order-basic-grid {
  align-items: start;
}

.order-service-field :deep(.n-form-item-blank) {
  align-items: flex-start;
}

.order-service-select {
  width: 100%;
}

.order-service-select :deep(.n-base-selection) {
  min-height: 40px;
  background: #fff;
}

.order-service-select :deep(.n-base-selection-tags) {
  min-height: 40px;
  align-content: flex-start;
  overflow: visible;
  padding-top: 4px;
  padding-bottom: 4px;
}

.order-readonly-number :deep(.n-input) {
  background: #f8fafc;
}

.order-readonly-number :deep(.n-input__input-el) {
  color: #0f172a;
  font-weight: 650;
}

.order-summary-status {
  display: flex;
  min-height: 34px;
  align-items: center;
  border: 1px solid #e5edf5;
  border-radius: 6px;
  background: #f8fafc;
  padding: 0 10px;
}

.service-draft-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 0;
}

.service-draft-empty {
  border: 1px dashed #d8e2ec;
  border-radius: 6px;
  padding: 18px 0;
}

.service-draft {
  border: 1px solid #e5edf5;
  border-radius: 8px;
  background: #fff;
  padding: 14px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.035);
}

.service-draft__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.service-draft__title {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.service-draft__index {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #eef6ff;
  color: #2563eb;
  font-size: 12px;
  font-weight: 700;
}

.service-draft__title strong {
  min-width: 0;
  overflow: hidden;
  color: #0f172a;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.service-draft__badges {
  display: inline-flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.service-draft__grid :deep(.n-form-item) {
  margin-bottom: 0;
}

:global(.order-edit-modal) {
  display: flex;
  max-height: calc(100vh - 48px);
  flex-direction: column;
  width: min(980px, calc(100vw - 40px));
}

:global(.order-edit-modal .n-card-header) {
  flex: 0 0 auto;
  border-bottom: 1px solid #edf2f7;
  background: #fff;
  padding: 18px 24px 12px;
}

:global(.order-edit-modal .n-card-content),
:global(.order-edit-modal .n-card__content) {
  flex: 1 1 auto;
  min-height: 0;
  max-height: none;
  background: #f7f9fc;
  overflow: auto;
  padding: 18px 24px;
}

:global(.order-edit-modal .n-card__footer) {
  flex: 0 0 auto;
  border-top: 1px solid #edf2f7;
  background: #fff;
  box-shadow: 0 -8px 18px rgba(15, 23, 42, 0.05);
  padding: 12px 24px 16px;
}

.order-modal-section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  color: #111827;
  font-size: 14px;
  font-weight: 650;
}

.order-modal-section-title::before {
  display: block;
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: #2563eb;
  content: '';
}

.order-modal-section-title--with-actions {
  justify-content: flex-start;
}

.order-modal-section-title small {
  margin-left: auto;
  color: #64748b;
  font-size: 12px;
  font-weight: 500;
}

@media (max-width: 760px) {
  :global(.order-edit-modal) {
    max-height: calc(100vh - 16px);
    width: calc(100vw - 16px) !important;
  }

  :global(.order-edit-modal .n-card-header) {
    padding: 14px 16px 10px;
  }

  :global(.order-edit-modal .n-card-content),
  :global(.order-edit-modal .n-card__content) {
    padding: 14px 16px;
  }

  :global(.order-edit-modal .n-card__footer) {
    padding: 10px 16px 14px;
  }

  .service-draft__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .service-draft__badges {
    justify-content: flex-start;
  }
}

.order-delete-modal {
  width: min(520px, calc(100vw - 32px));
}

.order-upload-modal {
  width: min(560px, calc(100vw - 32px));
}

.order-upload-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 8px;
  color: #316c72;
}

.order-upload-glyph {
  display: inline-block;
  flex: 0 0 auto;
  background: currentColor;
  mask: url('@/assets/icons/feather/paperclip.svg') center / contain no-repeat;
  -webkit-mask: url('@/assets/icons/feather/paperclip.svg') center / contain no-repeat;
  width: 28px;
  height: 28px;
}

.order-modal-target {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  border: 1px solid #e5edf5;
  border-radius: 8px;
  background: #f8fafc;
  padding: 10px 12px;
}

.order-modal-target span {
  color: #64748b;
  font-size: 12px;
}

.order-modal-target strong {
  color: #0f172a;
  font-size: 14px;
  font-weight: 650;
}

.order-attachment-list {
  margin: 12px 0;
  border: 1px solid #e5edf5;
  border-radius: 6px;
  background: #f8fafc;
  padding: 8px;
}

.order-attachment-links {
  display: grid;
  gap: 6px;
}

.order-attachment-links a {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  border-radius: 4px;
  color: #1f4f58;
  line-height: 20px;
  padding: 5px 6px;
  text-decoration: none;
}

.order-attachment-links a:hover {
  background: rgba(var(--primary-color), 0.08);
}

.order-attachment-links span {
  flex: 0 0 auto;
  color: #64748b;
  font-size: 12px;
}

.order-attachment-links strong {
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.delete-order-summary {
  margin-bottom: 12px;
  border: 1px solid #e5edf5;
  border-radius: 6px;
  background: #f8fafc;
  padding: 12px;
}

.delete-order-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.delete-order-heading span {
  color: #64748b;
  font-size: 12px;
  line-height: 18px;
}

.delete-order-heading strong {
  color: #0f172a;
  font-size: 15px;
  font-weight: 700;
}

.delete-order-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
  margin: 0;
}

.delete-order-meta div {
  min-width: 0;
}

.delete-order-meta dt {
  margin: 0;
  color: #64748b;
  font-size: 12px;
  line-height: 18px;
}

.delete-order-meta dd {
  overflow: hidden;
  margin: 0;
  color: #172033;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1023px) {
  .order-list-panel {
    padding-right: 12px;
    padding-left: 12px;
  }

  .order-master-table {
    min-height: 420px;
  }
}

@media (max-width: 767px) {
  .setup-alert {
    align-items: stretch;
    flex-direction: column;
  }

  .selected-summary-bar {
    position: static;
    margin-top: 8px;
    padding: 6px 0 0;
  }

  .order-edit-modal {
    width: calc(100vw - 24px);
  }

  .delete-order-meta {
    grid-template-columns: 1fr;
  }
}
</style>
