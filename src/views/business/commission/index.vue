<template>
  <CommonPage title="提成管理" class="zenith-data-page">
    <n-tabs v-model:value="activeTab" type="line" animated class="zenith-data-tabs">
      <n-tab-pane name="settlements" tab="结算单">
        <NSpace vertical :size="12" class="zenith-data-stack">
          <n-form class="zenith-filter-bar" data-filter-collapsed-rows="all" inline label-placement="left" :show-feedback="false">
            <n-form-item label="关键字">
              <n-input v-model:value="settlementQuery.keyword" clearable placeholder="员工或服务项" @keyup.enter="searchSettlements" />
            </n-form-item>
            <n-form-item label="状态">
              <n-select v-model:value="settlementQuery.status" clearable class="w-130px" :options="settlementStatusOptions" />
            </n-form-item>
            <n-form-item label="年度">
              <AppDatePicker v-model:formatted-value="settlementYearText" type="year" value-format="yyyy" clearable class="w-120px" placeholder="全部年度" />
            </n-form-item>
            <n-form-item class="zenith-filter-actions">
              <NSpace>
                <NButton type="primary" @click="searchSettlements">
                  <i class="i-fe:search mr-4" />
                  查询
                </NButton>
                <NButton secondary @click="resetSettlements">
                  <i class="i-fe:rotate-ccw mr-4" />
                  重置
                </NButton>
                <NButton v-permission="'GenerateCommissionSettlement'" type="primary" @click="openGenerateModal">
                  <i class="i-fe:play mr-4" />
                  生成结算
                </NButton>
              </NSpace>
            </n-form-item>
          </n-form>

          <EnhancedDataTable
            storage-key="business.commission.settlements"
            :columns="enhancedSettlementColumns"
            :data="settlements"
            :pagination="settlementPagination"
            :summary="settlementSummary"
            :row-action="openSettlementDetail"
            mobile-primary-key="employeeName"
            mobile-status-key="statusLabel"
            :mobile-secondary-keys="['period', 'serviceYear', 'serviceName', 'lineCount']"
            :mobile-meta-keys="['totalAmount']"
            remote
            size="small"
            @update:page="handleSettlementPageChange"
            @update:page-size="handleSettlementPageSizeChange"
            @update:sorter="handleSettlementSorterChange"
          />
        </NSpace>
      </n-tab-pane>

      <n-tab-pane name="lines" tab="明细追溯">
        <NSpace vertical :size="12" class="zenith-data-stack">
          <n-form class="zenith-filter-bar" data-filter-collapsed-rows="all" inline label-placement="left" :show-feedback="false">
            <n-form-item label="关键字">
              <n-input v-model:value="lineQuery.keyword" clearable placeholder="员工、订单、单位或服务项" @keyup.enter="searchLines" />
            </n-form-item>
            <n-form-item label="年度">
              <AppDatePicker v-model:formatted-value="lineYearText" type="year" value-format="yyyy" clearable class="w-120px" placeholder="全部年度" />
            </n-form-item>
            <n-form-item class="zenith-filter-actions">
              <NSpace>
                <NButton type="primary" @click="searchLines">
                  <i class="i-fe:search mr-4" />
                  查询
                </NButton>
                <NButton secondary @click="resetLines">
                  <i class="i-fe:rotate-ccw mr-4" />
                  重置
                </NButton>
              </NSpace>
            </n-form-item>
          </n-form>

          <EnhancedDataTable
            storage-key="business.commission.lines"
            :columns="enhancedLineColumns"
            :data="lines"
            :pagination="linePagination"
            :summary="lineSummary"
            :row-action="openOrderFromCommissionRow"
            mobile-primary-key="clientName"
            :mobile-secondary-keys="['employeeName', 'roleTypeLabel', 'orderNo', 'serviceName']"
            :mobile-meta-keys="['baseAmount', 'ratePercent', 'fixedAmount', 'commissionAmount']"
            remote
            size="small"
            @update:page="handleLinePageChange"
            @update:page-size="handleLinePageSizeChange"
            @update:sorter="handleLineSorterChange"
          />
        </NSpace>
      </n-tab-pane>

      <n-tab-pane name="rules" tab="规则配置">
        <NSpace vertical :size="12" class="zenith-data-stack">
          <n-form class="zenith-filter-bar" data-filter-collapsed-rows="all" inline label-placement="left" :show-feedback="false">
            <n-form-item label="关键字">
              <n-input v-model:value="ruleQuery.keyword" clearable placeholder="规则、服务项或说明" @keyup.enter="searchRules" />
            </n-form-item>
            <n-form-item label="角色">
              <n-select v-model:value="ruleQuery.roleType" clearable class="w-120px" :options="roleTypeOptions" />
            </n-form-item>
            <n-form-item label="状态">
              <n-select v-model:value="ruleQuery.enabled" clearable class="w-110px" :options="enabledOptions" />
            </n-form-item>
            <n-form-item class="zenith-filter-actions">
              <NSpace>
                <NButton type="primary" @click="searchRules">
                  <i class="i-fe:search mr-4" />
                  查询
                </NButton>
                <NButton secondary @click="resetRules">
                  <i class="i-fe:rotate-ccw mr-4" />
                  重置
                </NButton>
                <NButton v-permission="'AddCommissionRule'" type="primary" secondary @click="openRuleDrawer()">
                  <i class="i-fe:plus mr-4" />
                  新增规则
                </NButton>
              </NSpace>
            </n-form-item>
          </n-form>

          <EnhancedDataTable
            storage-key="business.commission.rules"
            :columns="enhancedRuleColumns"
            :data="rules"
            :pagination="rulePagination"
            :row-action="hasPermission('EditCommissionRule') ? openRuleDrawer : undefined"
            mobile-primary-key="title"
            mobile-status-key="enabled"
            :mobile-secondary-keys="['roleTypeLabel', 'serviceName', 'baseTypeLabel', 'ratePercent']"
            :mobile-meta-keys="['fixedAmount', 'effectiveFrom', 'effectiveTo']"
            remote
            size="small"
            @update:page="handleRulePageChange"
            @update:page-size="handleRulePageSizeChange"
            @update:sorter="handleRuleSorterChange"
          />
        </NSpace>
      </n-tab-pane>

      <n-tab-pane name="items" tab="服务项基数">
        <NSpace vertical :size="12" class="zenith-data-stack">
          <n-form class="zenith-filter-bar" data-filter-collapsed-rows="all" inline label-placement="left" :show-feedback="false">
            <n-form-item label="关键字">
              <n-input v-model:value="itemQuery.keyword" clearable placeholder="订单、单位、人员或服务项" @keyup.enter="searchItems" />
            </n-form-item>
            <n-form-item label="年度">
              <AppDatePicker v-model:formatted-value="itemYearText" type="year" value-format="yyyy" clearable class="w-120px" placeholder="全部年度" />
            </n-form-item>
            <n-form-item class="zenith-filter-actions">
              <NSpace>
                <NButton type="primary" @click="searchItems">
                  <i class="i-fe:search mr-4" />
                  查询
                </NButton>
                <NButton secondary @click="resetItems">
                  <i class="i-fe:rotate-ccw mr-4" />
                  重置
                </NButton>
              </NSpace>
            </n-form-item>
          </n-form>

          <EnhancedDataTable
            storage-key="business.commission.settlementItems"
            :columns="enhancedItemColumns"
            :data="settlementItems"
            :pagination="itemPagination"
            :summary="itemSummary"
            :row-action="openOrderFromCommissionRow"
            mobile-primary-key="clientName"
            mobile-status-key="settlementStatus"
            :mobile-secondary-keys="['orderNo', 'serviceName', 'receiverName', 'performerName']"
            :mobile-meta-keys="['allocatedAmount', 'billableAmount', 'receivedAmount', 'settledCommission']"
            remote
            size="small"
            @update:page="handleItemPageChange"
            @update:page-size="handleItemPageSizeChange"
            @update:sorter="handleItemSorterChange"
          />
        </NSpace>
      </n-tab-pane>
    </n-tabs>

    <n-drawer v-model:show="ruleDrawerVisible" width="520px">
      <n-drawer-content :title="editingRule?.id ? '编辑提成规则' : '新增提成规则'" closable>
        <n-form ref="ruleFormRef" :model="ruleForm" :rules="ruleFormRules" label-placement="left" label-align="left" :label-width="92">
          <n-form-item label="规则名称" path="title">
            <n-input v-model:value="ruleForm.title" placeholder="例如：财报接单提成" />
          </n-form-item>
          <n-form-item label="提成角色" path="roleType">
            <n-select v-model:value="ruleForm.roleType" :options="roleTypeOptions" />
          </n-form-item>
          <n-form-item label="适用服务项">
            <n-select
              v-model:value="ruleForm.serviceCode"
              clearable
              filterable
              :options="serviceOptions"
              placeholder="全部服务项"
            />
          </n-form-item>
          <n-form-item label="提成基数" path="baseType">
            <n-select v-model:value="ruleForm.baseType" :options="baseTypeOptions" />
          </n-form-item>
          <n-form-item label="提成比例" path="ratePercent">
            <n-input-number v-model:value="ruleForm.ratePercent" class="w-full" :min="0" :max="100" :precision="4" :show-button="false">
              <template #suffix>
                %
              </template>
            </n-input-number>
          </n-form-item>
          <n-form-item label="固定金额" path="fixedAmount">
            <n-input-number v-model:value="ruleForm.fixedAmount" class="w-full" :min="0" :precision="2" :show-button="false" />
          </n-form-item>
          <n-form-item label="生效日期">
            <NSpace class="w-full" :wrap="false">
              <AppDatePicker v-model:formatted-value="ruleForm.effectiveFrom" clearable class="flex-1" placeholder="开始日期" />
              <AppDatePicker v-model:formatted-value="ruleForm.effectiveTo" clearable class="flex-1" placeholder="结束日期" />
            </NSpace>
          </n-form-item>
          <n-form-item label="排序" path="sort">
            <n-input-number v-model:value="ruleForm.sort" class="w-full" :min="0" :precision="0" :show-button="false" />
          </n-form-item>
          <n-form-item label="状态">
            <n-switch v-model:value="ruleForm.enabled">
              <template #checked>
                启用
              </template>
              <template #unchecked>
                停用
              </template>
            </n-switch>
          </n-form-item>
          <n-form-item label="说明">
            <n-input v-model:value="ruleForm.note" type="textarea" :autosize="{ minRows: 3, maxRows: 5 }" />
          </n-form-item>
        </n-form>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="ruleDrawerVisible = false">
              取消
            </NButton>
            <NButton type="primary" :loading="savingRule" @click="saveRule">
              保存
            </NButton>
          </NSpace>
        </template>
      </n-drawer-content>
    </n-drawer>

    <n-modal v-model:show="generateModalVisible" preset="dialog" title="生成提成结算" positive-text="生成草稿" negative-text="取消" :loading="generatingDraft" @positive-click="generateDraft">
      <n-form ref="generateFormRef" :model="generateForm" :rules="generateFormRules" label-placement="left" label-align="left" :label-width="92">
        <n-form-item label="结算开始" path="periodStart">
          <AppDatePicker v-model:formatted-value="generateForm.periodStart" />
        </n-form-item>
        <n-form-item label="结算结束" path="periodEnd">
          <AppDatePicker v-model:formatted-value="generateForm.periodEnd" />
        </n-form-item>
        <n-form-item label="服务年度">
          <AppDatePicker v-model:formatted-value="generateYearText" type="year" value-format="yyyy" clearable class="w-full" placeholder="全部年度" />
        </n-form-item>
        <n-form-item label="服务项">
          <n-select v-model:value="generateForm.serviceCode" clearable filterable :options="serviceOptions" placeholder="全部服务项" />
        </n-form-item>
        <n-form-item label="员工">
          <n-select v-model:value="generateForm.employeeIds" clearable filterable multiple :options="employeeOptions" placeholder="全部员工" />
        </n-form-item>
      </n-form>
    </n-modal>

    <n-drawer v-model:show="detailDrawerVisible" width="88vw">
      <n-drawer-content title="结算明细" closable>
        <n-descriptions v-if="selectedSettlement" label-placement="left" bordered size="small" :column="4">
          <n-descriptions-item label="员工">
            {{ selectedSettlement.employeeName }}
          </n-descriptions-item>
          <n-descriptions-item label="周期">
            {{ selectedSettlement.periodStart }} 至 {{ selectedSettlement.periodEnd }}
          </n-descriptions-item>
          <n-descriptions-item label="状态">
            {{ selectedSettlement.statusLabel }}
          </n-descriptions-item>
          <n-descriptions-item label="合计">
            ￥{{ formatCurrency(selectedSettlement.totalAmount) }}
          </n-descriptions-item>
        </n-descriptions>
        <EnhancedDataTable
          class="mt-12"
          storage-key="business.commission.detailLines"
          :columns="enhancedLineColumns"
          :data="detailLines"
          :pagination="false"
          size="small"
        />
      </n-drawer-content>
    </n-drawer>
  </CommonPage>
</template>

<script setup>
import { NButton, NPopconfirm, NSpace, NTag } from 'naive-ui'
import { AppDatePicker, EnhancedDataTable } from '@/components/common'
import { hasPermission, withPermission } from '@/directives'
import { createTablePagination, createTableSorter, createTableSummary, DEFAULT_PAGE_SIZE, enhanceTableColumns, formatDate, getTableSorterParams, normalizeTableSorter } from '@/utils'
import { businessApi } from '../shared/api'
import { COMMISSION_ITEM_SETTLEMENT_STATUS, COMMISSION_SETTLEMENT_STATUS, COMMISSION_SETTLEMENT_STATUS_OPTIONS } from '../shared/constants'
import { formatCurrency } from '../shared/format'

defineOptions({ name: 'CommissionRules' })

const router = useRouter()
const activeTab = ref('settlements')
const rules = ref([])
const settlements = ref([])
const lines = ref([])
const settlementItems = ref([])
const services = ref([])
const employees = ref([])
const selectedSettlement = ref(null)
const detailLines = ref([])
const ruleDrawerVisible = ref(false)
const generateModalVisible = ref(false)
const detailDrawerVisible = ref(false)
const savingRule = ref(false)
const generatingDraft = ref(false)
const editingRule = ref(null)
const ruleFormRef = ref(null)
const generateFormRef = ref(null)

const roleTypeOptions = [
  { label: '接单人', value: 'receiver' },
  { label: '完成人', value: 'performer' },
]
const baseTypeOptions = [
  { label: '已收金额', value: 'received_amount' },
  { label: '应收金额', value: 'billable_amount' },
  { label: '分摊金额', value: 'allocated_amount' },
]
const settlementStatusOptions = COMMISSION_SETTLEMENT_STATUS_OPTIONS
const enabledOptions = [
  { label: '启用', value: 'true' },
  { label: '停用', value: 'false' },
]

const ruleQuery = reactive({ keyword: '', roleType: null, enabled: null })
const settlementQuery = reactive({ keyword: '', status: null, serviceYear: null })
const lineQuery = reactive({ keyword: '', serviceYear: null })
const itemQuery = reactive({ keyword: '', serviceYear: null })
const settlementYearText = computed({
  get: () => formatYearValue(settlementQuery.serviceYear),
  set: value => settlementQuery.serviceYear = parseYearValue(value),
})
const lineYearText = computed({
  get: () => formatYearValue(lineQuery.serviceYear),
  set: value => lineQuery.serviceYear = parseYearValue(value),
})
const itemYearText = computed({
  get: () => formatYearValue(itemQuery.serviceYear),
  set: value => itemQuery.serviceYear = parseYearValue(value),
})
const rulePagination = reactive(createTablePagination({ page: 1, pageSize: DEFAULT_PAGE_SIZE, itemCount: 0 }))
const settlementPagination = reactive(createTablePagination({ page: 1, pageSize: DEFAULT_PAGE_SIZE, itemCount: 0 }))
const linePagination = reactive(createTablePagination({ page: 1, pageSize: DEFAULT_PAGE_SIZE, itemCount: 0 }))
const itemPagination = reactive(createTablePagination({ page: 1, pageSize: DEFAULT_PAGE_SIZE, itemCount: 0 }))
const ruleSorter = ref(createTableSorter())
const settlementSorter = ref(createTableSorter())
const lineSorter = ref(createTableSorter())
const itemSorter = ref(createTableSorter())

const ruleForm = reactive({
  title: '',
  roleType: 'receiver',
  serviceCode: null,
  baseType: 'received_amount',
  ratePercent: 0,
  fixedAmount: 0,
  effectiveFrom: null,
  effectiveTo: null,
  note: '',
  enabled: true,
  sort: 0,
})
const generateForm = reactive({
  periodStart: '',
  periodEnd: '',
  serviceYear: new Date().getFullYear(),
  serviceCode: null,
  employeeIds: [],
})
const generateYearText = computed({
  get: () => formatYearValue(generateForm.serviceYear),
  set: value => generateForm.serviceYear = parseYearValue(value),
})

const serviceOptions = computed(() => services.value.map(item => ({ label: item.name, value: item.code })))
const employeeOptions = computed(() => employees.value.map(item => ({
  label: item.employeeName || item.nickName || item.username,
  value: item.id,
})))
const enhancedRuleColumns = computed(() => enhanceTableColumns(ruleColumns, { remote: true }))
const enhancedSettlementColumns = computed(() => enhanceTableColumns(settlementColumns, { remote: true }))
const enhancedLineColumns = computed(() => enhanceTableColumns(lineColumns, { remote: true }))
const enhancedItemColumns = computed(() => enhanceTableColumns(itemColumns, { remote: true }))

const settlementSummary = computed(() => createTableSummary([
  { key: 'totalAmount', formatter: value => `￥${formatCurrency(value)}` },
], { columns: enhancedSettlementColumns.value, labelKey: 'employeeName' }))
const lineSummary = computed(() => createTableSummary([
  { key: 'baseAmount', formatter: value => `￥${formatCurrency(value)}` },
  { key: 'fixedAmount', formatter: value => `￥${formatCurrency(value)}` },
  { key: 'commissionAmount', formatter: value => `￥${formatCurrency(value)}` },
], { columns: enhancedLineColumns.value, labelKey: 'employeeName' }))
const itemSummary = computed(() => createTableSummary([
  { key: 'allocatedAmount', formatter: value => `￥${formatCurrency(value)}` },
  { key: 'billableAmount', formatter: value => `￥${formatCurrency(value)}` },
  { key: 'receivedAmount', formatter: value => `￥${formatCurrency(value)}` },
  { key: 'settledCommission', formatter: value => `￥${formatCurrency(value)}` },
], { columns: enhancedItemColumns.value, labelKey: 'orderNo' }))

const ruleFormRules = {
  title: [{ required: true, message: '请输入规则名称', trigger: ['input', 'blur'] }],
  roleType: [{ required: true, message: '请选择提成角色', trigger: ['change', 'blur'] }],
  baseType: [{ required: true, message: '请选择提成基数', trigger: ['change', 'blur'] }],
  ratePercent: [{
    trigger: ['input', 'blur'],
    validator() {
      if (Number(ruleForm.ratePercent || 0) <= 0 && Number(ruleForm.fixedAmount || 0) <= 0)
        return new Error('提成比例和固定金额不能同时为0')
      return true
    },
  }],
  fixedAmount: [{
    trigger: ['input', 'blur'],
    validator() {
      if (Number(ruleForm.ratePercent || 0) <= 0 && Number(ruleForm.fixedAmount || 0) <= 0)
        return new Error('提成比例和固定金额不能同时为0')
      return true
    },
  }],
}

const generateFormRules = {
  periodStart: [{ required: true, message: '请选择结算开始日期', trigger: ['change', 'blur'] }],
  periodEnd: [{ required: true, message: '请选择结算结束日期', trigger: ['change', 'blur'] }],
}

const ruleColumns = [
  { title: '规则名称', key: 'title', minWidth: 160, ellipsis: { tooltip: true }, remoteSortable: true },
  { title: '角色', key: 'roleTypeLabel', width: 90, remoteSortable: true },
  { title: '服务项', key: 'serviceName', minWidth: 150, ellipsis: { tooltip: true }, remoteSortable: true },
  { title: '基数', key: 'baseTypeLabel', width: 100, remoteSortable: true },
  { title: '比例', key: 'ratePercent', width: 90, remoteSortable: true, render: row => `${row.ratePercent}%` },
  { title: '固定金额', key: 'fixedAmount', width: 110, remoteSortable: true, render: row => `￥${formatCurrency(row.fixedAmount)}` },
  { title: '生效开始', key: 'effectiveFrom', width: 110, remoteSortable: true, render: row => row.effectiveFrom || '-' },
  { title: '生效结束', key: 'effectiveTo', width: 110, remoteSortable: true, render: row => row.effectiveTo || '-' },
  { title: '排序', key: 'sort', width: 80, remoteSortable: true },
  {
    title: '状态',
    key: 'enabled',
    width: 90,
    remoteSortable: true,
    render(row) {
      return h(NTag, { type: row.enabled ? 'success' : 'default', size: 'small' }, { default: () => (row.enabled ? '启用' : '停用') })
    },
  },
  { title: '说明', key: 'note', minWidth: 180, ellipsis: { tooltip: true }, defaultHidden: true, render: row => row.note || '-' },
  {
    title: '操作',
    key: 'actions',
    width: 150,
    align: 'right',
    fixed: 'right',
    render(row) {
      return h(NSpace, { justify: 'end', size: 8 }, {
        default: () => [
          withPermission(h(NButton, { size: 'small', secondary: true, type: 'primary', onClick: () => openRuleDrawer(row) }, { default: () => '编辑' }), 'EditCommissionRule'),
          hasPermission('DeleteCommissionRule')
            ? h(NPopconfirm, { onPositiveClick: () => deleteRule(row) }, {
                trigger: () => h(NButton, { size: 'small', secondary: true, type: 'error' }, { default: () => '删除' }),
                default: () => `确认删除规则“${row.title}”？`,
              })
            : null,
        ].filter(Boolean),
      })
    },
  },
]

const settlementColumns = [
  { title: '员工', key: 'employeeName', width: 110, remoteSortable: true },
  { title: '周期', key: 'period', minWidth: 200, remoteSortable: true, render: row => `${row.periodStart} 至 ${row.periodEnd}` },
  { title: '服务年度', key: 'serviceYear', width: 100, remoteSortable: true, render: row => row.serviceYear || '全部' },
  { title: '服务项', key: 'serviceName', minWidth: 140, ellipsis: { tooltip: true }, remoteSortable: true },
  { title: '明细数', key: 'lineCount', width: 90 },
  { title: '提成合计', key: 'totalAmount', width: 120, remoteSortable: true, render: row => `￥${formatCurrency(row.totalAmount)}` },
  {
    title: '状态',
    key: 'statusLabel',
    width: 100,
    remoteSortable: true,
    render(row) {
      return h(NTag, { type: settlementStatusTagType(row.status), size: 'small' }, { default: () => row.statusLabel })
    },
  },
  { title: '确认时间', key: 'confirmedAt', width: 120, defaultHidden: true, remoteSortable: true, render: row => row.confirmedAt ? formatDate(row.confirmedAt) : '-' },
  {
    title: '操作',
    key: 'actions',
    width: 260,
    align: 'right',
    fixed: 'right',
    render(row) {
      const actions = [
        h(NButton, { size: 'small', secondary: true, onClick: () => openSettlementDetail(row) }, { default: () => '明细' }),
      ]
      if (row.status === COMMISSION_SETTLEMENT_STATUS.DRAFT) {
        actions.push(withPermission(h(NButton, { size: 'small', secondary: true, type: 'primary', onClick: () => recalculateSettlement(row) }, { default: () => '重算' }), 'GenerateCommissionSettlement'))
        actions.push(withPermission(h(NButton, { size: 'small', secondary: true, type: 'success', onClick: () => confirmSettlement(row) }, { default: () => '确认' }), 'ConfirmCommissionSettlement'))
      }
      if (row.status === COMMISSION_SETTLEMENT_STATUS.CONFIRMED)
        actions.push(withPermission(h(NButton, { size: 'small', secondary: true, type: 'info', onClick: () => markPaid(row) }, { default: () => '发放' }), 'PayCommissionSettlement'))
      if (row.status !== COMMISSION_SETTLEMENT_STATUS.PAID && row.status !== COMMISSION_SETTLEMENT_STATUS.CANCELLED)
        actions.push(withPermission(h(NButton, { size: 'small', secondary: true, type: 'error', onClick: () => cancelSettlement(row) }, { default: () => '取消' }), 'CancelCommissionSettlement'))
      return h(NSpace, { justify: 'end', size: 8 }, { default: () => actions.filter(Boolean) })
    },
  },
]

const lineColumns = [
  { title: '员工', key: 'employeeName', width: 100, remoteSortable: true },
  { title: '角色', key: 'roleTypeLabel', width: 80, remoteSortable: true },
  { title: '订单号', key: 'orderNo', minWidth: 130, remoteSortable: true },
  { title: '年度', key: 'serviceYear', width: 80, remoteSortable: true },
  { title: '区划', key: 'regionName', width: 90, remoteSortable: true },
  { title: '单位名称', key: 'clientName', minWidth: 220, ellipsis: { tooltip: true }, remoteSortable: true },
  { title: '单位编码', key: 'unitCode', width: 110, remoteSortable: true },
  { title: '服务项', key: 'serviceName', minWidth: 140, ellipsis: { tooltip: true }, remoteSortable: true },
  { title: '规则', key: 'ruleTitle', minWidth: 150, ellipsis: { tooltip: true }, remoteSortable: true },
  { title: '基数类型', key: 'baseTypeLabel', width: 100, remoteSortable: true },
  { title: '基数', key: 'baseAmount', width: 110, remoteSortable: true, render: row => `￥${formatCurrency(row.baseAmount)}` },
  { title: '比例', key: 'ratePercent', width: 90, remoteSortable: true, render: row => `${row.ratePercent}%` },
  { title: '固定', key: 'fixedAmount', width: 100, remoteSortable: true, render: row => `￥${formatCurrency(row.fixedAmount)}` },
  { title: '提成', key: 'commissionAmount', width: 110, remoteSortable: true, render: row => `￥${formatCurrency(row.commissionAmount)}` },
]

const itemColumns = [
  { title: '订单号', key: 'orderNo', minWidth: 130, remoteSortable: true },
  { title: '年度', key: 'serviceYear', width: 80, remoteSortable: true },
  { title: '区划', key: 'regionName', width: 90, remoteSortable: true },
  { title: '单位名称', key: 'clientName', minWidth: 220, ellipsis: { tooltip: true }, remoteSortable: true },
  { title: '单位编码', key: 'unitCode', width: 110, remoteSortable: true },
  { title: '服务项', key: 'serviceName', minWidth: 140, ellipsis: { tooltip: true }, remoteSortable: true },
  { title: '接单人', key: 'receiverName', width: 90, remoteSortable: true },
  { title: '完成人', key: 'performerName', width: 90, remoteSortable: true },
  { title: '分摊', key: 'allocatedAmount', width: 100, remoteSortable: true, render: row => `￥${formatCurrency(row.allocatedAmount)}` },
  { title: '应收', key: 'billableAmount', width: 100, remoteSortable: true, render: row => `￥${formatCurrency(row.billableAmount)}` },
  { title: '已收', key: 'receivedAmount', width: 100, remoteSortable: true, render: row => `￥${formatCurrency(row.receivedAmount)}` },
  { title: '已结提成', key: 'settledCommission', width: 120, render: row => `￥${formatCurrency(row.settledCommission)}` },
  {
    title: '状态',
    key: 'settlementStatus',
    width: 100,
    render(row) {
      return h(NTag, {
        type: row.settlementStatus === COMMISSION_ITEM_SETTLEMENT_STATUS.SETTLEABLE
          ? 'success'
          : row.settlementStatus === COMMISSION_ITEM_SETTLEMENT_STATUS.SETTLED ? 'info' : 'warning',
        size: 'small',
      }, { default: () => row.settlementStatus })
    },
  },
]

onMounted(async () => {
  await Promise.all([loadBaseOptions(), loadRules(), loadSettlements(), loadLines(), loadItems()])
})

async function loadBaseOptions() {
  const [serviceResult, employeeResult] = await Promise.all([
    businessApi.serviceCatalog.list({ enabled: 1 }),
    businessApi.employees.list(),
  ])
  services.value = serviceResult.data?.pageData || serviceResult.data || []
  employees.value = employeeResult.data || []
}

async function loadRules() {
  const { data } = await businessApi.commission.rules({
    pageNo: rulePagination.page,
    pageSize: rulePagination.pageSize,
    ...cleanQuery(ruleQuery),
    ...getTableSorterParams(ruleSorter.value),
  })
  rules.value = data?.pageData || []
  rulePagination.itemCount = data?.total || 0
}

async function loadSettlements() {
  const { data } = await businessApi.commission.settlements({
    pageNo: settlementPagination.page,
    pageSize: settlementPagination.pageSize,
    ...cleanQuery(settlementQuery),
    ...getTableSorterParams(settlementSorter.value),
  })
  settlements.value = data?.pageData || []
  settlementPagination.itemCount = data?.total || 0
}

async function loadLines() {
  const { data } = await businessApi.commission.lines({
    pageNo: linePagination.page,
    pageSize: linePagination.pageSize,
    ...cleanQuery(lineQuery),
    ...getTableSorterParams(lineSorter.value),
  })
  lines.value = data?.pageData || []
  linePagination.itemCount = data?.total || 0
}

async function loadItems() {
  const { data } = await businessApi.commission.settlementItems({
    pageNo: itemPagination.page,
    pageSize: itemPagination.pageSize,
    ...cleanQuery(itemQuery),
    ...getTableSorterParams(itemSorter.value),
  })
  settlementItems.value = data?.pageData || []
  itemPagination.itemCount = data?.total || 0
}

function searchRules() {
  rulePagination.page = 1
  void loadRules()
}

function resetRules() {
  resetQuery(ruleQuery)
  searchRules()
}

function searchSettlements() {
  settlementPagination.page = 1
  void loadSettlements()
}

function resetSettlements() {
  resetQuery(settlementQuery)
  searchSettlements()
}

function searchLines() {
  linePagination.page = 1
  void loadLines()
}

function resetLines() {
  resetQuery(lineQuery)
  searchLines()
}

function searchItems() {
  itemPagination.page = 1
  void loadItems()
}

function resetItems() {
  resetQuery(itemQuery)
  searchItems()
}

function resetQuery(query) {
  for (const key of Object.keys(query))
    query[key] = key === 'keyword' ? '' : null
}

function formatYearValue(value) {
  return value ? String(value) : null
}

function parseYearValue(value) {
  const year = Number(value)
  return Number.isInteger(year) && year >= 2000 ? year : null
}

async function handleRulePageChange(page) {
  rulePagination.page = page
  await loadRules()
}

async function handleRulePageSizeChange(pageSize) {
  rulePagination.page = 1
  rulePagination.pageSize = pageSize
  await loadRules()
}

async function handleRuleSorterChange(sorter) {
  ruleSorter.value = normalizeTableSorter(sorter)
  rulePagination.page = 1
  await loadRules()
}

async function handleSettlementPageChange(page) {
  settlementPagination.page = page
  await loadSettlements()
}

async function handleSettlementPageSizeChange(pageSize) {
  settlementPagination.page = 1
  settlementPagination.pageSize = pageSize
  await loadSettlements()
}

async function handleSettlementSorterChange(sorter) {
  settlementSorter.value = normalizeTableSorter(sorter)
  settlementPagination.page = 1
  await loadSettlements()
}

async function handleLinePageChange(page) {
  linePagination.page = page
  await loadLines()
}

async function handleLinePageSizeChange(pageSize) {
  linePagination.page = 1
  linePagination.pageSize = pageSize
  await loadLines()
}

async function handleLineSorterChange(sorter) {
  lineSorter.value = normalizeTableSorter(sorter)
  linePagination.page = 1
  await loadLines()
}

async function handleItemPageChange(page) {
  itemPagination.page = page
  await loadItems()
}

async function handleItemPageSizeChange(pageSize) {
  itemPagination.page = 1
  itemPagination.pageSize = pageSize
  await loadItems()
}

async function handleItemSorterChange(sorter) {
  itemSorter.value = normalizeTableSorter(sorter)
  itemPagination.page = 1
  await loadItems()
}

function openRuleDrawer(row) {
  editingRule.value = row || null
  Object.assign(ruleForm, {
    title: row?.title || '',
    roleType: row?.roleType || 'receiver',
    serviceCode: row?.serviceCode || null,
    baseType: row?.baseType || 'received_amount',
    ratePercent: row?.ratePercent || 0,
    fixedAmount: row?.fixedAmount || 0,
    effectiveFrom: row?.effectiveFrom || null,
    effectiveTo: row?.effectiveTo || null,
    note: row?.note || '',
    enabled: row?.enabled ?? true,
    sort: row?.sort || 0,
  })
  ruleDrawerVisible.value = true
}

async function saveRule() {
  await ruleFormRef.value?.validate()
  savingRule.value = true
  try {
    const payload = {
      ...ruleForm,
      rate: Number(ruleForm.ratePercent || 0) / 100,
      serviceCode: ruleForm.serviceCode || undefined,
      effectiveFrom: ruleForm.effectiveFrom || undefined,
      effectiveTo: ruleForm.effectiveTo || undefined,
    }
    delete payload.ratePercent
    if (editingRule.value?.id)
      await businessApi.commission.updateRule(editingRule.value.id, payload)
    else
      await businessApi.commission.createRule(payload)
    showSuccess('提成规则已保存')
    ruleDrawerVisible.value = false
    await loadRules()
  }
  finally {
    savingRule.value = false
  }
}

async function deleteRule(row) {
  await businessApi.commission.deleteRule(row.id)
  showSuccess('提成规则已删除')
  await loadRules()
}

function openGenerateModal() {
  generateModalVisible.value = true
}

async function generateDraft() {
  await generateFormRef.value?.validate()
  generatingDraft.value = true
  try {
    const payload = cleanQuery({
      periodStart: generateForm.periodStart,
      periodEnd: generateForm.periodEnd,
      serviceYear: generateForm.serviceYear,
      serviceCode: generateForm.serviceCode,
      employeeIds: generateForm.employeeIds,
    })
    const { data } = await businessApi.commission.generateDraft(payload)
    showSuccess(`已生成 ${data.settlementCount} 张草稿、${data.lineCount} 条明细`)
    await Promise.all([loadSettlements(), loadLines(), loadItems()])
  }
  finally {
    generatingDraft.value = false
  }
}

async function recalculateSettlement(row) {
  await businessApi.commission.recalculateSettlement(row.id)
  showSuccess('结算草稿已重算')
  await Promise.all([loadSettlements(), loadLines(), loadItems()])
}

async function confirmSettlement(row) {
  await businessApi.commission.confirmSettlement(row.id)
  showSuccess('结算单已确认')
  await Promise.all([loadSettlements(), loadLines(), loadItems()])
}

async function markPaid(row) {
  await businessApi.commission.markPaid(row.id)
  showSuccess('结算单已标记发放')
  await loadSettlements()
}

async function cancelSettlement(row) {
  await businessApi.commission.cancelSettlement(row.id)
  showSuccess('结算单已取消')
  await Promise.all([loadSettlements(), loadLines(), loadItems()])
}

async function openSettlementDetail(row) {
  const { data } = await businessApi.commission.settlementDetail(row.id)
  selectedSettlement.value = data
  detailLines.value = data?.lines || []
  detailDrawerVisible.value = true
}

function openOrderFromCommissionRow(row) {
  if (row?.orderNo)
    router.push({ path: '/orders', query: { keyword: row.orderNo } })
}

function cleanQuery(source) {
  return Object.fromEntries(Object.entries(source).filter(([, value]) => {
    if (Array.isArray(value))
      return value.length > 0
    return value !== null && value !== undefined && value !== ''
  }))
}

function settlementStatusTagType(status) {
  if (status === COMMISSION_SETTLEMENT_STATUS.DRAFT)
    return 'warning'
  if (status === COMMISSION_SETTLEMENT_STATUS.CONFIRMED)
    return 'success'
  if (status === COMMISSION_SETTLEMENT_STATUS.PAID)
    return 'info'
  return 'default'
}

function showSuccess(content) {
  window.$message?.success(content)
}
</script>
