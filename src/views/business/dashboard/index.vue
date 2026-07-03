<template>
  <CommonPage :title="currentDashboardTitle" class="business-dashboard zenith-data-page">
    <section class="dashboard-filter-panel">
      <n-form class="zenith-filter-bar" data-filter-collapsed-rows="all" label-placement="left" label-width="72" :show-feedback="false">
        <n-grid cols="1 m:2 l:6" :x-gap="14" :y-gap="12" responsive="screen">
          <n-form-item-gi label="年度">
            <AppDatePicker v-model:formatted-value="filterYearText" type="year" value-format="yyyy" clearable placeholder="全部年度" />
          </n-form-item-gi>
          <n-form-item-gi label="区划">
            <n-select v-model:value="filters.regionCode" clearable filterable :options="store.regionOptions" placeholder="全部区划" />
          </n-form-item-gi>
          <n-form-item-gi label="服务">
            <n-select v-model:value="filters.serviceCode" clearable filterable :options="store.serviceOptions" placeholder="全部服务" />
          </n-form-item-gi>
          <n-form-item-gi label="接单人">
            <n-select v-model:value="filters.receiverId" clearable filterable :options="store.employeeOptions" placeholder="全部员工" />
          </n-form-item-gi>
          <n-form-item-gi label="完成人">
            <n-select v-model:value="filters.performerId" clearable filterable :options="store.employeeOptions" placeholder="全部员工" />
          </n-form-item-gi>
          <n-form-item-gi class="zenith-filter-actions">
            <NSpace>
              <NButton type="primary" :loading="loading" @click="loadDashboard">
                <i class="i-fe:search mr-4" />
                查询
              </NButton>
              <NButton secondary :disabled="!activeFilterTags.length" @click="resetFilters">
                重置
              </NButton>
            </NSpace>
          </n-form-item-gi>
        </n-grid>
      </n-form>
      <div v-if="activeFilterTags.length" class="dashboard-filter-tags">
        <span>已筛选</span>
        <NTag v-for="tag in activeFilterTags" :key="tag" size="small" round>
          {{ tag }}
        </NTag>
      </div>
    </section>

    <section v-if="visibleMetricGroups.length" class="dashboard-metric-groups">
      <div v-for="group in visibleMetricGroups" :key="group.title" class="dashboard-metric-group">
        <div class="dashboard-metric-group__head">
          <strong>{{ group.title }}</strong>
          <span>{{ group.caption }}</span>
        </div>
        <div class="dashboard-metric-grid">
          <button
            v-for="item in group.cards"
            :key="item.key"
            class="dashboard-metric"
            :class="metricClass(item)"
            type="button"
            :disabled="!metricTarget(item.key)"
            :aria-label="metricTarget(item.key) ? `${item.label}，查看对应待办` : item.label"
            @click="activateMetric(item.key)"
          >
            <span class="dashboard-metric-label">{{ item.label }}</span>
            <strong>{{ formatMetricValue(item) }}</strong>
            <small>{{ item.note }}</small>
            <span v-if="metricTarget(item.key)" class="dashboard-metric-cue">查看</span>
          </button>
        </div>
      </div>
    </section>

    <section v-if="showRiskCard" ref="riskSectionRef">
      <n-card class="dashboard-risk-card" :class="{ 'dashboard-risk-card--active': activeMetricKey }" title="重点待办" segmented>
        <div class="dashboard-risk-summary">
          <button
            v-for="item in visibleRiskSummaryItems"
            :key="item.key"
            class="dashboard-risk-summary-item"
            :class="[`dashboard-risk-summary-item--${item.tone}`, { 'dashboard-risk-summary-item--active': activeRiskTab === item.tab }]"
            type="button"
            :aria-pressed="activeRiskTab === item.tab"
            :aria-label="`${item.label}${formatCount(item.value)}项，${item.note}`"
            @click="activateRiskTab(item.tab)"
          >
            <span>{{ item.label }}</span>
            <strong>{{ formatCount(item.value) }}</strong>
            <small>{{ item.note }}</small>
          </button>
        </div>
        <n-tabs v-model:value="activeRiskTab" type="line" animated>
          <n-tab-pane v-if="isRiskTabVisible('unpaidServices')" name="unpaidServices" :tab="`未收服务 ${exceptions.unpaidServiceCount || 0}`">
            <EnhancedDataTable
              storage-key="business.dashboard.unpaid-services"
              :columns="serviceDrillColumns"
              :data="unpaidServices"
              :pagination="false"
              :show-toolbar="false"
              mobile-primary-key="clientName"
              mobile-status-key="status"
              :mobile-secondary-keys="['serviceName', 'serviceYear', 'unreceivedAmount', 'serviceEndDate']"
              :row-action="goOrderRow"
              size="small"
            />
          </n-tab-pane>
          <n-tab-pane v-if="isRiskTabVisible('renewals')" name="renewals" :tab="`待续签 ${exceptions.renewalPendingCount || 0}`">
            <EnhancedDataTable
              storage-key="business.dashboard.renewals"
              :columns="renewalColumns"
              :data="exceptions.dueRenewals || []"
              :pagination="false"
              :show-toolbar="false"
              mobile-primary-key="clientName"
              mobile-status-key="status"
              :mobile-secondary-keys="['serviceName', 'serviceYear', 'serviceEndDate', 'receiverName']"
              :row-action="goOrderRow"
              size="small"
            />
          </n-tab-pane>
          <n-tab-pane v-if="isRiskTabVisible('overdue')" name="overdue" :tab="`超期服务 ${exceptions.overdueCount || 0}`">
            <EnhancedDataTable
              storage-key="business.dashboard.overdue"
              :columns="renewalColumns"
              :data="exceptions.overdueServices || []"
              :pagination="false"
              :show-toolbar="false"
              mobile-primary-key="clientName"
              mobile-status-key="status"
              :mobile-secondary-keys="['serviceName', 'serviceYear', 'serviceEndDate', 'receiverName']"
              :row-action="goOrderRow"
              size="small"
            />
          </n-tab-pane>
          <n-tab-pane v-if="isRiskTabVisible('invoices')" name="invoices" :tab="`已开未收 ${exceptions.unpaidInvoiceCount || 0}`">
            <EnhancedDataTable
              storage-key="business.dashboard.unpaid-invoices"
              :columns="invoiceColumns"
              :data="exceptions.unpaidInvoices || []"
              :pagination="false"
              :show-toolbar="false"
              mobile-primary-key="clientName"
              mobile-status-key="paymentStatus"
              :mobile-secondary-keys="['invoiceNo', 'invoiceDate', 'unmatchedAmount', 'deliveryStatus']"
              :row-action="goInvoiceRow"
              size="small"
            />
          </n-tab-pane>
          <n-tab-pane v-if="isRiskTabVisible('payments')" name="payments" :tab="`待匹配流水 ${exceptions.unmatchedPaymentCount || 0}`">
            <EnhancedDataTable
              storage-key="business.dashboard.unmatched-payments"
              :columns="paymentColumns"
              :data="exceptions.unmatchedPayments || []"
              :pagination="false"
              :show-toolbar="false"
              mobile-primary-key="payerName"
              mobile-status-key="matchStatus"
              :mobile-secondary-keys="['paymentDate', 'unmatchedAmount', 'clientName', 'bankRemark']"
              :row-action="goPaymentRow"
              size="small"
            />
          </n-tab-pane>
        </n-tabs>
      </n-card>
    </section>

    <n-grid v-if="showChartGrid" class="dashboard-chart-grid" cols="1 xl:2" :x-gap="12" :y-gap="12" responsive="screen">
      <n-grid-item v-if="showFinanceCharts">
        <n-card title="金额流向" segmented>
          <div v-if="financeFlowTotal === 0" class="dashboard-empty-state">
            <strong>暂无金额数据</strong>
            <span>当前筛选范围内还没有应收、开票或收款记录。</span>
          </div>
          <div v-else class="dashboard-finance-flow">
            <div v-for="item in financeFlowRows" :key="item.name" class="dashboard-finance-row">
              <div class="dashboard-finance-row__head">
                <span>{{ item.name }}</span>
                <strong>￥{{ formatCurrency(item.value) }}</strong>
              </div>
              <div class="dashboard-finance-row__track">
                <span :style="{ width: `${item.rate}%` }" />
              </div>
            </div>
          </div>
        </n-card>
      </n-grid-item>
      <n-grid-item v-if="showFinanceCharts">
        <n-card :title="`${trendYear} 月度趋势`" segmented>
          <div v-if="monthlyTrendTotal === 0" class="dashboard-empty-state">
            <strong>暂无月度走势</strong>
            <span>当前年度还没有形成应收、开票或收款记录。</span>
          </div>
          <VChart v-else class="dashboard-chart" :option="monthlyOption" autoresize />
        </n-card>
      </n-grid-item>
      <n-grid-item v-if="showServiceChart">
        <n-card title="服务构成" segmented>
          <div v-if="serviceDistributionTotal === 0" class="dashboard-empty-state">
            <strong>暂无服务构成</strong>
            <span>当前筛选范围内还没有服务项。</span>
          </div>
          <VChart v-else class="dashboard-chart" :option="serviceOption" autoresize />
        </n-card>
      </n-grid-item>
      <n-grid-item v-if="showRenewalChart">
        <n-card title="续费风险" segmented>
          <div v-if="renewalRiskTotal === 0" class="dashboard-empty-state">
            <strong>暂无续签风险</strong>
            <span>当前筛选范围内没有到提醒日未续签的服务项。</span>
          </div>
          <VChart v-else class="dashboard-chart" :option="renewalOption" autoresize />
        </n-card>
      </n-grid-item>
    </n-grid>

    <n-grid v-if="showRankingTables" class="dashboard-table-grid" cols="1 xl:2" :x-gap="12" :y-gap="12" responsive="screen">
      <n-grid-item>
        <n-card title="区县分析" segmented>
          <EnhancedDataTable
            storage-key="business.dashboard.regions"
            :columns="regionColumns"
            :data="regionDistribution"
            :pagination="false"
            :show-toolbar="false"
            mobile-primary-key="name"
            :mobile-secondary-keys="['serviceItemCount', 'billableAmount', 'receivedAmount', 'collectionRate']"
            size="small"
          />
        </n-card>
      </n-grid-item>
      <n-grid-item>
        <n-card title="年度沉淀" segmented>
          <EnhancedDataTable
            storage-key="business.dashboard.years"
            :columns="yearColumns"
            :data="yearlyTrend"
            :pagination="false"
            :show-toolbar="false"
            mobile-primary-key="year"
            :mobile-secondary-keys="['serviceItemCount', 'billableAmount', 'receivedAmount', 'unreceivedAmount']"
            size="small"
          />
        </n-card>
      </n-grid-item>
    </n-grid>

    <n-grid v-if="showRankingTables" class="dashboard-table-grid" cols="1 xl:2" :x-gap="12" :y-gap="12" responsive="screen">
      <n-grid-item>
        <n-card title="接单排行" segmented>
          <EnhancedDataTable
            storage-key="business.dashboard.receiver-ranking"
            :columns="rankingColumns"
            :data="receiverRanking"
            :pagination="false"
            :show-toolbar="false"
            mobile-primary-key="name"
            :mobile-secondary-keys="['serviceItemCount', 'receivedAmount', 'completionRate', 'collectionRate']"
            size="small"
          />
        </n-card>
      </n-grid-item>
      <n-grid-item>
        <n-card title="完成排行" segmented>
          <EnhancedDataTable
            storage-key="business.dashboard.performer-ranking"
            :columns="rankingColumns"
            :data="performerRanking"
            :pagination="false"
            :show-toolbar="false"
            mobile-primary-key="name"
            :mobile-secondary-keys="['serviceItemCount', 'receivedAmount', 'completionRate', 'collectionRate']"
            size="small"
          />
        </n-card>
      </n-grid-item>
    </n-grid>
  </CommonPage>
</template>

<script setup>
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { NButton, NSpace, NTag } from 'naive-ui'
import VChart from 'vue-echarts'
import { AppDatePicker, CommonPage, EnhancedDataTable } from '@/components/common'
import { enhanceTableColumns } from '@/utils'
import { ORDER_STATUS, SERVICE_ITEM_STATUS } from '../orders/constants'
import { businessApi } from '../shared/api'
import { INVOICE_PAYMENT_STATUS, INVOICE_STATUS, PAYMENT_MATCH_STATUS, SERVICE_COLLECTION_STATUS } from '../shared/constants'
import { formatCurrency } from '../shared/format'
import { useBusinessStore } from '../shared/useBusinessStore'

defineOptions({ name: 'BusinessDashboard' })

echarts.use([TooltipComponent, GridComponent, LegendComponent, BarChart, LineChart, PieChart, CanvasRenderer])

const router = useRouter()
const route = useRoute()
const store = useBusinessStore()
const loading = ref(false)
const filters = reactive(createEmptyFilters())
const dashboard = ref({})
const activeRiskTab = ref('unpaidServices')
const activeMetricKey = ref('')
const riskSectionRef = ref(null)
const DASHBOARD_STATUS = {
  RENEWED: '已续签',
  RENEWAL_PENDING: '待续签',
  NEEDS_MATERIAL: '需补资料',
}
const metricTargetMap = {
  unreceivedAmount: 'unpaidServices',
  renewalPendingCount: 'renewals',
  paymentUnmatchedAmount: 'payments',
  invoiceUnmatchedAmount: 'invoices',
}
const metricRiskKeys = new Set(['unreceivedAmount', 'invoiceUnmatchedAmount', 'renewalPendingCount', 'paymentUnmatchedAmount'])
const metricWarningKeys = new Set(['collectionRate', 'completionRate'])
const dashboardViewMap = {
  BusinessDashboard: 'overview',
  DashboardOverview: 'overview',
  DashboardReceivables: 'receivables',
  DashboardFulfillment: 'fulfillment',
  DashboardRanking: 'ranking',
}
const dashboardViewTitleMap = {
  overview: '经营总览',
  receivables: '回款分析',
  fulfillment: '履约待办',
  ranking: '排行分析',
}
const metricGroupTitlesByView = {
  receivables: new Set(['回款健康']),
  fulfillment: new Set(['履约风险']),
}
const riskTabsByView = {
  receivables: ['unpaidServices', 'invoices', 'payments'],
  fulfillment: ['renewals', 'overdue'],
}
const metricGroupDefinitions = [
  { title: '经营规模', caption: '客户、订单和服务体量', keys: ['clientCount', 'orderCount', 'serviceItemCount', 'billableAmount'] },
  { title: '回款健康', caption: '开票、回款和未收风险', keys: ['invoiceAmount', 'invoiceUnmatchedAmount', 'receivedAmount', 'unreceivedAmount', 'collectionRate', 'paymentUnmatchedAmount'] },
  { title: '履约风险', caption: '完成和续签处理', keys: ['completionRate', 'renewalPendingCount'] },
]

const currentDashboardView = computed(() => dashboardViewMap[route.name] || dashboardViewMap.BusinessDashboard)
const currentDashboardTitle = computed(() => dashboardViewTitleMap[currentDashboardView.value])
const filterYearText = computed({
  get: () => filters.serviceYear ? String(filters.serviceYear) : null,
  set: value => filters.serviceYear = value ? Number(value) : null,
})
const trendYear = computed(() => dashboard.value.trendYear || filters.serviceYear || new Date().getFullYear())
const summaryCards = computed(() => dashboard.value.summaryCards || [])
const metricGroups = computed(() => {
  const cardMap = new Map(summaryCards.value.map(card => [card.key, card]))
  return metricGroupDefinitions.map(group => ({
    ...group,
    cards: group.keys.map(key => cardMap.get(key)).filter(Boolean),
  })).filter(group => group.cards.length)
})
const visibleMetricGroups = computed(() => {
  if (currentDashboardView.value === 'ranking')
    return []
  const titles = metricGroupTitlesByView[currentDashboardView.value]
  return titles ? metricGroups.value.filter(group => titles.has(group.title)) : metricGroups.value
})
const financeSummary = computed(() => dashboard.value.financeSummary || [])
const serviceDistribution = computed(() => dashboard.value.serviceDistribution || [])
const regionDistribution = computed(() => dashboard.value.regionDistribution || [])
const yearlyTrend = computed(() => dashboard.value.yearlyTrend || [])
const monthlyTrend = computed(() => dashboard.value.monthlyTrend || [])
const receiverRanking = computed(() => dashboard.value.receiverRanking || [])
const performerRanking = computed(() => dashboard.value.performerRanking || [])
const renewalFunnel = computed(() => dashboard.value.renewalFunnel || [])
const exceptions = computed(() => dashboard.value.exceptions || {})
const kpis = computed(() => dashboard.value.kpis || {})
const unpaidServices = computed(() => exceptions.value.unpaidServices || [])
const financeMax = computed(() => Math.max(...financeSummary.value.map(item => Number(item.value || 0)), 0))
const financeFlowTotal = computed(() => financeSummary.value.reduce((sum, item) => sum + Number(item.value || 0), 0))
const financeFlowRows = computed(() => financeSummary.value.map((item) => {
  const value = Number(item.value || 0)
  return {
    ...item,
    rate: value > 0 && financeMax.value > 0 ? Math.max(4, Math.min(100, Math.round(value * 100 / financeMax.value))) : 0,
  }
}))
const serviceDistributionTotal = computed(() => serviceDistribution.value.reduce((sum, item) => sum + Number(item.value || 0), 0))
const monthlyTrendTotal = computed(() => monthlyTrend.value.reduce((sum, item) => {
  return sum + Number(item.orderAmount || 0) + Number(item.invoiceAmount || 0) + Number(item.receivedAmount || 0)
}, 0))
const renewalRiskRows = computed(() => renewalFunnel.value.filter(item => ['待续签', '不续签', '已终止'].includes(item.name) && Number(item.value || 0) > 0))
const renewalRiskTotal = computed(() => renewalRiskRows.value.reduce((sum, item) => sum + Number(item.value || 0), 0))
const riskSummaryItems = computed(() => [
  {
    key: 'unpaidServices',
    tab: 'unpaidServices',
    label: '未收服务',
    value: exceptions.value.unpaidServiceCount || 0,
    note: `未收￥${formatCurrency(kpis.value.unreceivedAmount)}`,
    tone: Number(kpis.value.unreceivedAmount || 0) > 0 ? 'risk' : 'muted',
  },
  {
    key: 'renewals',
    tab: 'renewals',
    label: '待续签',
    value: exceptions.value.renewalPendingCount || 0,
    note: '到提醒日',
    tone: Number(exceptions.value.renewalPendingCount || 0) > 0 ? 'warning' : 'muted',
  },
  {
    key: 'overdue',
    tab: 'overdue',
    label: '超期服务',
    value: exceptions.value.overdueCount || 0,
    note: '超期未完成',
    tone: Number(exceptions.value.overdueCount || 0) > 0 ? 'risk' : 'muted',
  },
  {
    key: 'invoices',
    tab: 'invoices',
    label: '已开未收',
    value: exceptions.value.unpaidInvoiceCount || 0,
    note: `待回款￥${formatCurrency(kpis.value.invoiceUnmatchedAmount)}`,
    tone: Number(kpis.value.invoiceUnmatchedAmount || 0) > 0 ? 'warning' : 'muted',
  },
  {
    key: 'payments',
    tab: 'payments',
    label: '待匹配',
    value: exceptions.value.unmatchedPaymentCount || 0,
    note: `待认领￥${formatCurrency(kpis.value.paymentUnmatchedAmount)}`,
    tone: Number(kpis.value.paymentUnmatchedAmount || 0) > 0 ? 'risk' : 'muted',
  },
])
const visibleRiskTabs = computed(() => riskTabsByView[currentDashboardView.value] || [])
const showRiskCard = computed(() => visibleRiskTabs.value.length > 0)
const visibleRiskSummaryItems = computed(() => riskSummaryItems.value.filter(item => isRiskTabVisible(item.tab)))
const showFinanceCharts = computed(() => ['overview', 'receivables'].includes(currentDashboardView.value))
const showServiceChart = computed(() => currentDashboardView.value === 'overview')
const showRenewalChart = computed(() => currentDashboardView.value === 'fulfillment')
const showChartGrid = computed(() => showFinanceCharts.value || showServiceChart.value || showRenewalChart.value)
const showRankingTables = computed(() => currentDashboardView.value === 'ranking')
const activeFilterTags = computed(() => [
  filters.serviceYear ? `${filters.serviceYear}年` : '',
  optionLabel(store.regionOptions, filters.regionCode),
  optionLabel(store.serviceOptions, filters.serviceCode),
  filters.receiverId ? `接单：${optionLabel(store.employeeOptions, filters.receiverId)}` : '',
  filters.performerId ? `完成：${optionLabel(store.employeeOptions, filters.performerId)}` : '',
].filter(Boolean))

const monthlyOption = computed(() => ({
  tooltip: { trigger: 'axis', valueFormatter: value => `￥${formatCurrency(value)}` },
  legend: { top: 0, right: 0 },
  grid: { left: 58, right: 18, top: 42, bottom: 32 },
  xAxis: { type: 'category', data: monthlyTrend.value.map(item => item.month.slice(5)) },
  yAxis: { type: 'value', axisLabel: { formatter: value => `${Math.round(value / 10000)}万` } },
  series: [
    { name: '应收', type: 'line', smooth: true, data: monthlyTrend.value.map(item => item.orderAmount), color: '#316C72' },
    { name: '开票', type: 'line', smooth: true, data: monthlyTrend.value.map(item => item.invoiceAmount), color: '#C98A2E' },
    { name: '已收', type: 'line', smooth: true, data: monthlyTrend.value.map(item => item.receivedAmount), color: '#2A8C61' },
  ],
}))

const serviceOption = computed(() => ({
  tooltip: { trigger: 'item' },
  legend: { bottom: 0, type: 'scroll' },
  series: [{
    type: 'pie',
    radius: ['42%', '68%'],
    center: ['50%', '44%'],
    data: serviceDistribution.value.map(item => ({ name: item.name, value: item.value })),
  }],
}))

const renewalOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 72, right: 18, top: 24, bottom: 30 },
  xAxis: { type: 'value', minInterval: 1 },
  yAxis: { type: 'category', data: renewalRiskRows.value.map(item => item.name) },
  series: [{
    type: 'bar',
    data: renewalRiskRows.value.map(item => item.value),
    barWidth: 18,
    itemStyle: { color: '#5B6F95', borderRadius: [0, 4, 4, 0] },
  }],
}))

const regionColumns = enhanceTableColumns([
  { title: '区县', key: 'name', minWidth: 120, ellipsis: { tooltip: true } },
  { title: '服务项', key: 'serviceItemCount', width: 80 },
  moneyColumn('应收', 'billableAmount'),
  moneyColumn('已收', 'receivedAmount'),
  moneyColumn('未收', 'unreceivedAmount'),
  percentColumn('收款率', 'collectionRate'),
], { remote: false })

const yearColumns = enhanceTableColumns([
  { title: '年度', key: 'year', width: 90 },
  { title: '服务项', key: 'serviceItemCount', width: 80 },
  moneyColumn('应收', 'billableAmount'),
  moneyColumn('已收', 'receivedAmount'),
  moneyColumn('未收', 'unreceivedAmount'),
], { remote: false })

const rankingColumns = enhanceTableColumns([
  { title: '员工', key: 'name', minWidth: 110, ellipsis: { tooltip: true } },
  { title: '服务项', key: 'serviceItemCount', width: 80 },
  moneyColumn('已收', 'receivedAmount'),
  moneyColumn('未收', 'unreceivedAmount'),
  percentColumn('完成率', 'completionRate'),
  percentColumn('收款率', 'collectionRate'),
], { remote: false })

const serviceDrillColumns = enhanceTableColumns([
  { title: '单位名称', key: 'clientName', minWidth: 220, ellipsis: { tooltip: true } },
  { title: '服务项', key: 'serviceName', minWidth: 140, ellipsis: { tooltip: true } },
  { title: '年度', key: 'serviceYear', width: 80 },
  moneyColumn('未收', 'unreceivedAmount'),
  { title: '接单人', key: 'receiverName', width: 100 },
  { title: '到期日期', key: 'serviceEndDate', width: 110, render: row => row.serviceEndDate || '-' },
  { title: '状态', key: 'status', width: 100, render: row => renderStatus(row.status) },
  actionColumn(row => goModule('/orders', { keyword: row.orderNo })),
], { remote: false })

const renewalColumns = enhanceTableColumns([
  { title: '单位名称', key: 'clientName', minWidth: 220, ellipsis: { tooltip: true } },
  { title: '服务项', key: 'serviceName', minWidth: 140, ellipsis: { tooltip: true } },
  { title: '年度', key: 'serviceYear', width: 80 },
  { title: '到期日期', key: 'serviceEndDate', width: 110, render: row => row.serviceEndDate || '-' },
  { title: '接单人', key: 'receiverName', width: 100 },
  { title: '完成人', key: 'performerName', width: 100 },
  { title: '状态', key: 'status', width: 100, render: row => renderStatus(row.status) },
  actionColumn(row => goModule('/orders', { keyword: row.orderNo })),
], { remote: false })

const invoiceColumns = enhanceTableColumns([
  { title: '发票号', key: 'invoiceNo', width: 150 },
  { title: '单位名称', key: 'clientName', minWidth: 220, ellipsis: { tooltip: true } },
  { title: '开票日期', key: 'invoiceDate', width: 110 },
  moneyColumn('发票金额', 'invoiceAmount'),
  moneyColumn('未收', 'unmatchedAmount'),
  { title: '收款', key: 'paymentStatus', width: 100, render: row => renderStatus(row.paymentStatus) },
  { title: '送达', key: 'deliveryStatus', width: 100 },
  actionColumn(row => goModule('/finance', { tab: 'invoice', keyword: row.invoiceNo })),
], { remote: false })

const paymentColumns = enhanceTableColumns([
  { title: '收款日期', key: 'paymentDate', width: 110 },
  { title: '付款方', key: 'payerName', minWidth: 220, ellipsis: { tooltip: true } },
  { title: '客户单位', key: 'clientName', minWidth: 180, ellipsis: { tooltip: true }, render: row => row.clientName || '-' },
  moneyColumn('金额', 'amount'),
  moneyColumn('未匹配', 'unmatchedAmount'),
  { title: '状态', key: 'matchStatus', width: 100, render: row => renderStatus(row.matchStatus) },
  { title: '银行备注', key: 'bankRemark', minWidth: 180, ellipsis: { tooltip: true }, render: row => row.bankRemark || '-' },
  actionColumn(row => goModule('/finance', { tab: 'payment', keyword: row.payerName })),
], { remote: false })

onMounted(async () => {
  await Promise.allSettled([
    store.loadDictionaries({ needTip: false }),
    store.loadServiceCatalog(),
    store.loadEmployees(),
  ])
  await loadDashboard()
})

watch(visibleRiskTabs, (tabs) => {
  activeMetricKey.value = ''
  if (tabs.length && !tabs.includes(activeRiskTab.value))
    activeRiskTab.value = tabs[0]
}, { immediate: true })

async function loadDashboard() {
  loading.value = true
  try {
    const { data } = await businessApi.dashboard.overview(cleanFilters())
    dashboard.value = data || {}
  }
  catch {
    dashboard.value = {}
    $message.error('经营看板加载失败')
  }
  finally {
    loading.value = false
  }
}

function resetFilters() {
  Object.assign(filters, createEmptyFilters())
  void loadDashboard()
}

async function activateMetric(key) {
  const tab = metricTarget(key)
  if (!tab)
    return

  activeMetricKey.value = key
  activeRiskTab.value = tab
  await nextTick()
  if (riskSectionRef.value)
    riskSectionRef.value.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function activateRiskTab(tab) {
  activeMetricKey.value = ''
  activeRiskTab.value = tab
}

function metricTarget(key) {
  const tab = metricTargetMap[key]
  return tab && isRiskTabVisible(tab) ? tab : ''
}

function isRiskTabVisible(tab) {
  return visibleRiskTabs.value.includes(tab)
}

function metricClass(item) {
  return {
    'dashboard-metric--actionable': metricTarget(item.key),
    'dashboard-metric--active': item.key === activeMetricKey.value,
    'dashboard-metric--risk': metricRiskKeys.has(item.key) && Number(item.value || 0) > 0,
    'dashboard-metric--warning': metricWarningKeys.has(item.key),
  }
}

function cleanFilters() {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== null && value !== undefined && value !== ''))
}

function createEmptyFilters() {
  return {
    serviceYear: null,
    regionCode: null,
    serviceCode: null,
    receiverId: null,
    performerId: null,
  }
}

function optionLabel(options, value) {
  if (!value)
    return ''
  return options.find(option => option.value === value)?.label || ''
}

function formatMetricValue(item) {
  if (item.valueType === 'currency')
    return `￥${formatCurrency(item.value)}`
  if (item.valueType === 'percent')
    return `${Number(item.value || 0).toFixed(2)}%`
  return Number(item.value || 0).toLocaleString('zh-CN')
}

function formatCount(value) {
  return Number(value || 0).toLocaleString('zh-CN')
}

function moneyColumn(title, key) {
  return {
    title,
    key,
    width: 120,
    align: 'right',
    render: row => `￥${formatCurrency(row[key])}`,
  }
}

function percentColumn(title, key) {
  return {
    title,
    key,
    width: 100,
    align: 'right',
    render: row => `${Number(row[key] || 0).toFixed(2)}%`,
  }
}

function actionColumn(onClick) {
  return {
    title: '操作',
    key: 'actions',
    width: 90,
    align: 'right',
    fixed: 'right',
    render(row) {
      return h(NSpace, { justify: 'end', size: 8 }, {
        default: () => [
          h(NButton, { size: 'small', secondary: true, onClick: () => onClick(row) }, { default: () => '查看' }),
        ],
      })
    },
  }
}

function goOrderRow(row) {
  goModule('/orders', { keyword: row.orderNo })
}

function goInvoiceRow(row) {
  goModule('/finance', { tab: 'invoice', keyword: row.invoiceNo })
}

function goPaymentRow(row) {
  goModule('/finance', { tab: 'payment', keyword: row.payerName })
}

function renderStatus(status) {
  const type = [SERVICE_ITEM_STATUS.DONE, SERVICE_COLLECTION_STATUS.PAID, PAYMENT_MATCH_STATUS.MATCHED, DASHBOARD_STATUS.RENEWED].includes(status)
    ? 'success'
    : [INVOICE_PAYMENT_STATUS.PARTIAL, PAYMENT_MATCH_STATUS.PARTIAL, DASHBOARD_STATUS.RENEWAL_PENDING, DASHBOARD_STATUS.NEEDS_MATERIAL].includes(status)
        ? 'warning'
        : [ORDER_STATUS.CANCELLED, INVOICE_STATUS.VOIDED, SERVICE_COLLECTION_STATUS.PENDING, PAYMENT_MATCH_STATUS.PENDING].includes(status)
            ? 'error'
            : 'default'
  return h(NTag, { size: 'small', type, bordered: false }, { default: () => status || '-' })
}

function goModule(path, query = {}) {
  router.push({ path, query })
}
</script>

<style scoped>
.business-dashboard {
  --dashboard-surface: #fff;
  --dashboard-muted-surface: #f8fafc;
  --dashboard-border: #e5e7eb;
  --dashboard-primary: #316c72;
  --dashboard-danger: #b45309;
  --dashboard-warning: #9a6a12;
}

.dashboard-filter-panel {
  margin-bottom: 12px;
}

.dashboard-filter-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  color: #64748b;
  font-size: 12px;
}

.dashboard-metric-groups {
  display: grid;
  gap: 12px;
  margin-bottom: 12px;
}

.dashboard-metric-group {
  min-width: 0;
}

.dashboard-metric-group__head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 2px 0 8px;
}

.dashboard-metric-group__head strong {
  color: #0f172a;
  font-size: 14px;
  font-weight: 650;
}

.dashboard-metric-group__head span {
  color: #94a3b8;
  font-size: 12px;
}

.dashboard-metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}

.dashboard-metric {
  position: relative;
  min-height: 112px;
  padding: 14px;
  text-align: left;
  background: var(--dashboard-surface);
  border: 1px solid var(--dashboard-border);
  border-radius: 8px;
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;
}

.dashboard-metric--actionable {
  cursor: pointer;
}

.dashboard-metric--actionable .dashboard-metric-label {
  padding-right: 44px;
}

.dashboard-metric:disabled {
  cursor: default;
}

.dashboard-metric:focus-visible,
.dashboard-risk-summary-item:focus-visible {
  outline: 2px solid rgb(49 108 114 / 45%);
  outline-offset: 2px;
}

.dashboard-metric--risk {
  border-color: #f3c98b;
  background: linear-gradient(180deg, #fffaf0 0%, #fff 72%);
}

.dashboard-metric--warning {
  border-color: #dbe3ea;
  background: linear-gradient(180deg, #f8fafc 0%, #fff 72%);
}

.dashboard-metric--active {
  border-color: var(--dashboard-primary);
  box-shadow:
    0 0 0 1px rgb(49 108 114 / 18%),
    0 10px 24px rgb(15 23 42 / 8%);
}

.dashboard-metric--actionable:hover {
  border-color: var(--dashboard-primary);
  box-shadow: 0 8px 24px rgb(15 23 42 / 8%);
  transform: translateY(-1px);
}

.dashboard-metric-label {
  display: block;
  font-size: 13px;
  color: #64748b;
}

.dashboard-metric strong {
  display: block;
  margin-top: 8px;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
  font-size: 24px;
  line-height: 1.15;
  color: #0f172a;
  font-weight: 650;
  white-space: nowrap;
}

.dashboard-metric--risk strong {
  color: var(--dashboard-danger);
}

.dashboard-metric--warning strong {
  color: var(--dashboard-warning);
}

.dashboard-metric small {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: #94a3b8;
}

.dashboard-metric-cue {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 2px 7px;
  border-radius: 999px;
  background: #eef7f7;
  color: var(--dashboard-primary);
  font-size: 12px;
  line-height: 18px;
}

.dashboard-chart-grid,
.dashboard-table-grid,
.dashboard-risk-card {
  margin-top: 12px;
}

.dashboard-risk-card {
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease;
}

.dashboard-risk-card--active {
  border-color: rgb(49 108 114 / 30%);
  box-shadow: 0 8px 26px rgb(15 23 42 / 6%);
}

.dashboard-risk-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.dashboard-risk-summary-item {
  min-width: 0;
  min-height: 82px;
  padding: 12px;
  text-align: left;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;
}

.dashboard-risk-summary-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgb(15 23 42 / 7%);
}

.dashboard-risk-summary-item span,
.dashboard-risk-summary-item small {
  display: block;
  overflow: hidden;
  color: #64748b;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-risk-summary-item strong {
  display: block;
  margin: 4px 0 2px;
  color: #0f172a;
  font-size: 22px;
  line-height: 1.18;
  font-weight: 650;
}

.dashboard-risk-summary-item--risk {
  border-color: #f0bf77;
  background: #fffaf0;
}

.dashboard-risk-summary-item--risk strong {
  color: var(--dashboard-danger);
}

.dashboard-risk-summary-item--warning {
  border-color: #d6dfeb;
  background: #f8fafc;
}

.dashboard-risk-summary-item--warning strong {
  color: #365f7d;
}

.dashboard-risk-summary-item--muted {
  background: #fbfdff;
}

.dashboard-risk-summary-item--active {
  border-color: var(--dashboard-primary);
  box-shadow: 0 0 0 1px rgb(49 108 114 / 16%);
}

.dashboard-chart {
  height: 320px;
}

.dashboard-finance-flow {
  display: grid;
  gap: 18px;
  min-height: 320px;
  align-content: center;
  padding: 18px 18px 22px;
}

.dashboard-finance-row__head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  color: #475569;
  font-size: 13px;
}

.dashboard-finance-row__head strong {
  color: #0f172a;
  font-size: 15px;
  font-weight: 650;
}

.dashboard-finance-row__track {
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: #eef2f7;
}

.dashboard-finance-row__track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #316c72, #6fa0a5);
}

.dashboard-empty-state {
  display: flex;
  min-height: 320px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #94a3b8;
  text-align: center;
}

.dashboard-empty-state strong {
  color: #334155;
  font-size: 16px;
}

@media (max-width: 1280px) {
  .dashboard-metric-grid {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }
}

@media (max-width: 720px) {
  .dashboard-metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-risk-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-metric-group__head {
    display: block;
  }

  .dashboard-metric-group__head span {
    display: block;
    margin-top: 2px;
  }

  .dashboard-metric {
    min-height: 104px;
    padding: 12px;
  }

  .dashboard-metric--actionable {
    padding-right: 12px;
  }

  .dashboard-metric--actionable .dashboard-metric-label {
    padding-right: 0;
  }

  .dashboard-metric strong {
    font-size: 20px;
  }

  .dashboard-metric-cue {
    position: static;
    display: inline-flex;
    margin-top: 8px;
  }

  .dashboard-risk-summary-item {
    min-height: 78px;
    padding: 10px;
  }

  .dashboard-risk-summary-item strong {
    font-size: 20px;
  }

  .dashboard-finance-flow {
    padding: 12px 4px 16px;
  }
}
</style>
