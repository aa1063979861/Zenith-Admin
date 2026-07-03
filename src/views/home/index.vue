<template>
  <AppPage :show-footer="false">
    <n-spin :show="loading">
      <div class="home-shell">
        <section class="home-hero">
          <div class="home-hero__identity">
            <span class="home-hero__avatar">{{ currentUserInitial }}</span>
            <div>
              <h1>{{ greeting }}，{{ currentUserName }}</h1>
              <p>欢迎回到众恒科技管理系统</p>
            </div>
          </div>

          <div class="home-hero__actions">
            <div class="date-chip">
              <i class="i-fe:calendar" />
              <span>{{ todayText }}</span>
            </div>

            <div v-if="canSwitchScope" class="scope-switch" role="tablist" aria-label="工作台视角">
              <button
                v-for="item in scopeOptions"
                :key="item.value"
                :class="{ 'is-active': scope === item.value }"
                type="button"
                role="tab"
                :aria-selected="scope === item.value"
                @click="changeScope(item.value)"
              >
                {{ item.label }}
              </button>
            </div>

            <button class="plain-action" type="button" @click="loadWorkbench">
              <i class="i-fe:refresh-cw" />
              <span>{{ loading ? '刷新中' : '刷新' }}</span>
            </button>
          </div>
        </section>

        <section class="task-strip" aria-label="待办概览">
          <button
            v-for="card in taskCards"
            :key="card.key"
            class="task-tile"
            :class="`task-tile--${card.tone || 'muted'}`"
            type="button"
            @click="activateCard(card.key)"
          >
            <span class="task-tile__icon">
              <i :class="cardIconMap[card.key] || 'i-fe:activity'" />
            </span>
            <span>
              <small>{{ card.label }}</small>
              <strong>{{ formatMetricValue(card) }}</strong>
            </span>
          </button>
        </section>

        <section class="portal-grid">
          <section class="todo-panel">
            <header class="panel-heading">
              <div>
                <h2>待办工作</h2>
                <p>优先处理会阻塞履约和回款的事项</p>
              </div>
              <button class="panel-link" type="button" @click="goActiveModule">
                {{ activeModuleLabel }}
                <i class="i-fe:arrow-right" />
              </button>
            </header>

            <div class="todo-tabs" role="tablist">
              <button
                v-for="tab in todoTabs"
                :key="tab.key"
                class="todo-tab"
                :class="[`todo-tab--${tab.level}`, { 'is-active': activeTodoTab === tab.key }]"
                type="button"
                role="tab"
                :aria-selected="activeTodoTab === tab.key"
                @click="activeTodoTab = tab.key"
              >
                <span>{{ tab.label }}</span>
                <strong>{{ tab.count }}</strong>
              </button>
            </div>

            <div class="todo-list">
              <button
                v-for="row in activeTodoRows"
                :key="`${activeTodoTab}-${row.id}`"
                class="todo-row"
                :class="`todo-row--${activeTodoMeta.level}`"
                type="button"
                @click="openTodo(row)"
              >
                <span class="todo-row__bar" />
                <span class="todo-row__main">
                  <span class="todo-row__title">
                    <strong>{{ getTodoTitle(row) }}</strong>
                    <em>{{ getTodoAssist(row) }}</em>
                  </span>
                  <small>{{ getTodoSubtitle(row) }}</small>
                </span>
                <span class="todo-row__meta">
                  <span class="status-chip" :class="`status-chip--${resolveStatusLevel(getTodoStatus(row))}`">
                    {{ getTodoStatus(row) }}
                  </span>
                  <em>{{ getTodoAmount(row) }}</em>
                </span>
                <span class="todo-row__arrow">
                  <i class="i-fe:chevron-right" />
                </span>
              </button>
              <n-empty v-if="!activeTodoRows.length" class="todo-empty" description="暂无待办" />
            </div>
          </section>

          <aside class="side-column">
            <section class="notice-panel">
              <header class="panel-heading panel-heading--compact">
                <div>
                  <h2>通知公告</h2>
                  <p>全员信息</p>
                </div>
                <button v-if="canManageAnnouncements" class="panel-link panel-link--compact" type="button" @click="goModule('/settings', { section: 'announcement' })">
                  管理
                  <i class="i-fe:arrow-right" />
                </button>
              </header>

              <div class="notice-list">
                <article
                  v-for="item in notices"
                  :key="item.id"
                  class="notice-row"
                >
                  <span class="notice-row__icon">
                    <i v-if="item.type === '公告'" class="i-fe:volume-2" />
                    <i v-else-if="item.type === '提醒'" class="i-fe:bell" />
                    <i v-else class="i-fe:file-text" />
                  </span>
                  <span class="notice-row__content">
                    <span class="notice-row__meta">
                      <em>{{ item.type || '通知' }}</em>
                      <time>{{ formatNoticeDate(item.publishAt) }}</time>
                    </span>
                    <strong>{{ item.title }}</strong>
                    <small>{{ item.content }}</small>
                  </span>
                </article>
                <n-empty v-if="!notices.length" class="notice-empty" description="暂无公告" />
              </div>
            </section>

            <section class="risk-panel">
              <header class="panel-heading panel-heading--compact">
                <div>
                  <h2>风险提醒</h2>
                  <p>{{ riskStateText }}</p>
                </div>
                <strong>{{ riskTotal }}</strong>
              </header>

              <button
                v-for="item in risks"
                :key="item.key"
                class="risk-row"
                :class="`risk-row--${item.level}`"
                type="button"
                @click="openRisk(item)"
              >
                <span class="risk-row__dot" />
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </button>
            </section>
          </aside>
        </section>

        <section class="quick-panel">
          <header class="panel-heading panel-heading--compact">
            <div>
              <h2>快捷入口</h2>
              <p>常用动作</p>
            </div>
          </header>

          <div class="quick-grid">
            <button
              v-for="item in quickActions"
              :key="item.label"
              type="button"
              @click="goModule(item.path, item.query)"
            >
              <i :class="item.icon" />
              <span>{{ item.label }}</span>
            </button>
          </div>
        </section>
      </div>
    </n-spin>
  </AppPage>
</template>

<script setup>
import { usePermissionStore, useUserStore } from '@/store'
import { businessApi } from '../business/shared/api'
import { formatCurrency } from '../business/shared/format'

defineOptions({ name: 'Home' })

const router = useRouter()
const permissionStore = usePermissionStore()
const userStore = useUserStore()
const loading = ref(false)
const scope = ref('all')
const activeTodoTab = ref('pendingServices')
const workbench = ref({})
const notices = ref([])
const scopeOptions = [
  { label: '全公司', value: 'all' },
  { label: '我的', value: 'mine' },
]
const cardIconMap = {
  pendingServices: 'i-fe:check-square',
  renewals: 'i-fe:repeat',
  unmatchedPayments: 'i-fe:credit-card',
  unreceivedAmount: 'i-fe:trending-down',
}
const accessRouteNames = computed(() => new Set(permissionStore.accessRoutes.map(route => route.name)))
const canSwitchScope = computed(() => Boolean(workbench.value.user?.canSwitchScope))
const canManageAnnouncements = computed(() => accessRouteNames.value.has('BusinessSettings'))
const currentUserName = computed(() => workbench.value.user?.displayName || userStore.nickName || userStore.username || '同事')
const currentUserInitial = computed(() => currentUserName.value.slice(0, 1))
const todayText = computed(() => new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }))
const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6)
    return '夜深了'
  if (hour < 12)
    return '早上好'
  if (hour < 18)
    return '下午好'
  return '晚上好'
})
const taskCards = computed(() => workbench.value.taskCards || [])
const risks = computed(() => workbench.value.risks || [])
const todoGroups = computed(() => workbench.value.todoGroups || {})
const riskTotal = computed(() => risks.value.reduce((sum, item) => sum + Number(item.value || 0), 0))
const dangerRiskTotal = computed(() => risks.value.filter(item => item.level === 'danger').reduce((sum, item) => sum + Number(item.value || 0), 0))
const riskStateText = computed(() => {
  if (!riskTotal.value)
    return '运行平稳'
  if (dangerRiskTotal.value)
    return '有高优先级事项'
  return '有事项待跟踪'
})
const todoTabs = computed(() => [
  tabMeta('pendingServices', '服务项', 'primary'),
  tabMeta('renewals', '续签', 'warning'),
  tabMeta('overdueServices', '逾期', 'danger'),
  tabMeta('problemServices', '问题', 'info'),
  tabMeta('unmatchedPayments', '收款', 'danger'),
  tabMeta('unpaidInvoices', '发票', 'warning'),
])
const activeTodoMeta = computed(() => todoTabs.value.find(tab => tab.key === activeTodoTab.value) || todoTabs.value[0])
const activeTodoRows = computed(() => activeTodoMeta.value?.rows || [])
const activeModuleLabel = computed(() => ['unmatchedPayments', 'unpaidInvoices'].includes(activeTodoTab.value) ? '查看财务' : '查看订单')
const quickActions = computed(() => [
  { label: '新建订单', path: '/orders', query: { action: 'create' }, icon: 'i-fe:plus-square', routeName: 'OrderManagement' },
  { label: '客户查询', path: '/clients', icon: 'i-fe:users', routeName: 'ClientManagement' },
  { label: '收款匹配', path: '/finance', query: { tab: 'payment', matchStatus: '待匹配' }, icon: 'i-fe:credit-card', routeName: 'FinanceSettlement' },
  { label: '资料档案', path: '/archive', icon: 'i-fe:archive', routeName: 'ArchiveFiles' },
  { label: '经营看板', path: '/dashboard', icon: 'i-fe:bar-chart-2', routeName: 'BusinessDashboard' },
].filter(item => accessRouteNames.value.has(item.routeName)))

onMounted(loadWorkbench)

async function loadWorkbench() {
  loading.value = true
  try {
    const [{ data }, { data: announcementData = [] }] = await Promise.all([
      businessApi.dashboard.workbench({ scope: scope.value }),
      businessApi.announcements.active({ limit: 4 }),
    ])
    workbench.value = data || {}
    notices.value = announcementData || []
    scope.value = data?.user?.scope || scope.value
    if (!todoGroups.value[activeTodoTab.value]?.rows?.length) {
      const nextTab = todoTabs.value.find(tab => tab.rows.length)
      activeTodoTab.value = nextTab?.key || 'pendingServices'
    }
  }
  finally {
    loading.value = false
  }
}

function formatNoticeDate(value) {
  if (!value)
    return '长期'
  return value.replaceAll('-', '.')
}

function tabMeta(key, label, level) {
  const group = todoGroups.value[key] || { total: 0, rows: [] }
  return {
    key,
    label,
    level,
    count: group.total || 0,
    rows: group.rows || [],
  }
}

function changeScope(value) {
  if (scope.value === value)
    return
  scope.value = value
  void loadWorkbench()
}

function activateCard(key) {
  const targetMap = {
    pendingServices: 'pendingServices',
    renewals: 'renewals',
    unmatchedPayments: 'unmatchedPayments',
    unreceivedAmount: 'unpaidInvoices',
  }
  activeTodoTab.value = targetMap[key] || activeTodoTab.value
}

function formatMetricValue(item) {
  if (item.valueType === 'currency')
    return `￥${formatCurrency(item.value)}`
  return Number(item.value || 0).toLocaleString('zh-CN')
}

function getTodoTitle(row) {
  if (activeTodoTab.value === 'unmatchedPayments')
    return row.payerName || '未命名付款方'
  if (activeTodoTab.value === 'unpaidInvoices')
    return row.clientName || '未命名发票'
  return row.clientName || '未命名单位'
}

function getTodoSubtitle(row) {
  if (activeTodoTab.value === 'unmatchedPayments')
    return [row.paymentDate, row.clientName, row.bankRemark].filter(Boolean).join(' · ')
  if (activeTodoTab.value === 'unpaidInvoices')
    return [row.invoiceNo, row.invoiceDate, row.deliveryStatus].filter(Boolean).join(' · ')
  return [row.orderNo, row.serviceName, row.serviceYear, row.performerName].filter(Boolean).join(' · ')
}

function getTodoAssist(row) {
  if (activeTodoTab.value === 'unmatchedPayments')
    return row.paymentDate ? `到账 ${row.paymentDate}` : '待匹配'
  if (activeTodoTab.value === 'unpaidInvoices')
    return row.invoiceDate ? `开票 ${row.invoiceDate}` : '已开票'
  if (row.serviceEndDate)
    return `到期 ${row.serviceEndDate}`
  if (row.renewalReminderDate)
    return `提醒 ${row.renewalReminderDate}`
  return row.regionName || '服务项'
}

function getTodoStatus(row) {
  if (activeTodoTab.value === 'unmatchedPayments')
    return row.matchStatus || '待匹配'
  if (activeTodoTab.value === 'unpaidInvoices')
    return row.paymentStatus || '待收款'
  return row.status || '待处理'
}

function getTodoAmount(row) {
  const amount = row.unmatchedAmount ?? row.unreceivedAmount ?? row.billableAmount ?? row.amount
  return amount === undefined || amount === null ? '' : `￥${formatCurrency(amount)}`
}

function resolveStatusLevel(status) {
  if (['已完成', '已收齐', '已匹配'].includes(status))
    return 'success'
  if (['部分收款', '部分匹配', '待续签', '待确认', '进行中'].includes(status))
    return 'warning'
  if (['已逾期', '待收款', '待匹配'].includes(status))
    return 'danger'
  return 'default'
}

function openTodo(row) {
  if (activeTodoTab.value === 'unmatchedPayments') {
    goModule('/finance', { tab: 'payment', keyword: row.payerName, matchStatus: row.matchStatus })
    return
  }
  if (activeTodoTab.value === 'unpaidInvoices') {
    goModule('/finance', { tab: 'invoice', keyword: row.invoiceNo, paymentStatus: row.paymentStatus })
    return
  }
  goModule('/orders', { keyword: row.orderNo })
}

function openRisk(item) {
  if (item.key && todoGroups.value[item.key])
    activeTodoTab.value = item.key
  if (!todoGroups.value[item.key]?.rows?.length && item.route)
    goModule(item.route, item.query)
}

function goActiveModule() {
  if (activeTodoTab.value === 'unmatchedPayments') {
    goModule('/finance', { tab: 'payment', matchStatus: '待匹配' })
    return
  }
  if (activeTodoTab.value === 'unpaidInvoices') {
    goModule('/finance', { tab: 'invoice' })
    return
  }
  goModule('/orders')
}

function goModule(path, query = {}) {
  router.push({ path, query: cleanQuery(query) })
}

function cleanQuery(source = {}) {
  return Object.fromEntries(Object.entries(source).filter(([, value]) => value !== null && value !== undefined && value !== ''))
}
</script>

<style scoped>
.home-shell {
  --home-ink: #061226;
  --home-muted: #64748b;
  --home-border: #dfe7ee;
  --home-soft: #f7fafc;
  --home-primary: #2f7775;
  --home-warning: #c8832a;
  --home-danger: #b6535c;
  --home-info: #50699a;
  display: grid;
  gap: 12px;
  min-width: 0;
  color: var(--home-ink);
}

.home-hero,
.task-strip,
.todo-panel,
.notice-panel,
.risk-panel,
.quick-panel {
  border: 1px solid rgba(16, 32, 51, 0.08);
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 14px 34px rgb(15 35 52 / 5%);
}

.home-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 18px;
  background: linear-gradient(120deg, rgba(47, 119, 117, 0.08), rgba(255, 255, 255, 0) 42%), #fff;
}

.home-hero__identity {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.home-hero__avatar {
  display: inline-flex;
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(47, 119, 117, 0.22);
  border-radius: 8px;
  background: #edf7f6;
  color: var(--home-primary);
  font-size: 18px;
  font-weight: 780;
}

.home-hero h1 {
  margin: 0;
  color: var(--home-ink);
  font-size: 23px;
  font-weight: 780;
  line-height: 30px;
}

.home-hero p,
.panel-heading p {
  margin: 3px 0 0;
  color: var(--home-muted);
  font-size: 12px;
  line-height: 18px;
}

.home-hero__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

.date-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--home-border);
  border-radius: 8px;
  padding: 8px 12px;
  background: #fff;
  color: #526176;
  font-size: 13px;
  line-height: 18px;
  white-space: nowrap;
}

.scope-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(92px, 1fr));
  overflow: hidden;
  border: 1px solid var(--home-border);
  border-radius: 8px;
  padding: 3px;
  background: #f6f9fc;
}

.scope-switch button,
.plain-action,
.panel-link,
.task-tile,
.todo-tab,
.todo-row,
.notice-row,
.risk-row,
.quick-grid button {
  font: inherit;
}

.scope-switch button {
  border: 0;
  border-radius: 6px;
  padding: 7px 12px;
  background: transparent;
  color: #526176;
  cursor: pointer;
}

.scope-switch button.is-active {
  background: var(--home-primary);
  color: #fff;
  font-weight: 680;
}

.plain-action,
.panel-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid var(--home-border);
  border-radius: 8px;
  padding: 8px 12px;
  background: #fff;
  color: #31465c;
  cursor: pointer;
}

.panel-link {
  border-color: rgba(47, 119, 117, 0.22);
  background: #f2f8f8;
  color: var(--home-primary);
}

.panel-link--compact {
  padding: 6px 9px;
  font-size: 12px;
  line-height: 18px;
}

.task-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  padding: 12px;
}

.task-tile {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
  border: 1px solid #e3ebf2;
  border-radius: 8px;
  padding: 13px 14px;
  background: #fbfdff;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    transform 0.16s ease;
}

.task-tile:hover {
  border-color: rgba(47, 119, 117, 0.32);
  background: #fff;
  transform: translateY(-1px);
}

.task-tile__icon {
  display: inline-flex;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #edf7f6;
  color: var(--home-primary);
  font-size: 20px;
}

.task-tile--warning .task-tile__icon {
  background: #fff7e8;
  color: var(--home-warning);
}

.task-tile--danger .task-tile__icon {
  background: #fff1f2;
  color: var(--home-danger);
}

.task-tile--accent .task-tile__icon {
  background: #f0f4ff;
  color: var(--home-info);
}

.task-tile small {
  display: block;
  overflow: hidden;
  color: var(--home-muted);
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-tile strong {
  display: block;
  overflow: hidden;
  color: var(--home-ink);
  font-size: 23px;
  font-weight: 780;
  line-height: 29px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.portal-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 12px;
  align-items: start;
}

.todo-panel,
.notice-panel,
.risk-panel,
.quick-panel {
  display: grid;
  min-width: 0;
  gap: 12px;
  padding: 16px;
}

.panel-heading {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.panel-heading--compact h2,
.panel-heading h2 {
  margin: 0;
  color: var(--home-ink);
  font-size: 18px;
  font-weight: 760;
  line-height: 25px;
}

.panel-heading--compact h2 {
  font-size: 16px;
  line-height: 22px;
}

.todo-tabs {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
}

.todo-tab {
  display: grid;
  min-width: 0;
  gap: 4px;
  border: 1px solid #e4ebf2;
  border-radius: 8px;
  padding: 10px;
  background: #fbfdff;
  color: #334155;
  text-align: left;
  cursor: pointer;
}

.todo-tab span {
  color: var(--home-muted);
  font-size: 12px;
  line-height: 18px;
}

.todo-tab strong {
  font-size: 20px;
  line-height: 26px;
}

.todo-tab.is-active {
  border-color: rgba(47, 119, 117, 0.36);
  background: #edf7f6;
  color: var(--home-primary);
}

.todo-tab--warning.is-active {
  border-color: rgba(200, 131, 42, 0.36);
  background: #fff8eb;
  color: var(--home-warning);
}

.todo-tab--danger.is-active {
  border-color: rgba(182, 83, 92, 0.34);
  background: #fff3f4;
  color: var(--home-danger);
}

.todo-tab--info.is-active {
  border-color: rgba(80, 105, 154, 0.32);
  background: #f3f6ff;
  color: var(--home-info);
}

.todo-list {
  display: grid;
  gap: 8px;
}

.todo-row {
  display: grid;
  grid-template-columns: 4px minmax(0, 1fr) auto 28px;
  gap: 12px;
  align-items: center;
  min-width: 0;
  border: 1px solid #e4ebf2;
  border-radius: 8px;
  padding: 11px 10px 11px 12px;
  background: #fff;
  text-align: left;
  cursor: pointer;
}

.todo-row:hover {
  border-color: rgba(47, 119, 117, 0.28);
  background: #fbfefe;
}

.todo-row__bar {
  width: 4px;
  height: 42px;
  border-radius: 8px;
  background: var(--home-primary);
}

.todo-row--warning .todo-row__bar {
  background: var(--home-warning);
}

.todo-row--danger .todo-row__bar {
  background: var(--home-danger);
}

.todo-row--info .todo-row__bar {
  background: var(--home-info);
}

.todo-row__main {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.todo-row__title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.todo-row__title strong {
  overflow: hidden;
  color: var(--home-ink);
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-row__title em {
  flex: 0 0 auto;
  border-radius: 6px;
  padding: 2px 6px;
  background: #f1f5f9;
  color: #526176;
  font-size: 11px;
  font-style: normal;
  line-height: 16px;
}

.todo-row__main small {
  overflow: hidden;
  color: var(--home-muted);
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-row__meta {
  display: grid;
  justify-items: end;
  gap: 5px;
}

.todo-row__meta em {
  color: #475569;
  font-size: 12px;
  font-style: normal;
  line-height: 18px;
}

.status-chip {
  border-radius: 6px;
  padding: 3px 7px;
  background: #f1f5f9;
  color: #526176;
  font-size: 12px;
  line-height: 16px;
  white-space: nowrap;
}

.status-chip--success {
  background: #eaf7ef;
  color: #2f8f62;
}

.status-chip--warning {
  background: #fff5df;
  color: var(--home-warning);
}

.status-chip--danger {
  background: #fff0f1;
  color: var(--home-danger);
}

.todo-row__arrow {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--home-soft);
  color: #8a96a6;
}

.todo-empty {
  padding: 72px 0;
}

.side-column {
  display: grid;
  gap: 12px;
}

.notice-list {
  display: grid;
  gap: 8px;
}

.notice-row {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  align-items: start;
  gap: 10px;
  border: 1px solid #e5ecf2;
  border-radius: 8px;
  padding: 11px 12px;
  background: #fbfdff;
  color: #334155;
  text-align: left;
}

.notice-row:hover {
  background: #f6f9fc;
}

.notice-row__icon {
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #edf7f6;
  color: var(--home-primary);
  font-size: 16px;
}

.notice-row__content {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.notice-row__meta {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--home-muted);
  font-size: 11px;
  line-height: 16px;
}

.notice-row__meta em {
  border-radius: 6px;
  padding: 1px 6px;
  background: #eef6f5;
  color: var(--home-primary);
  font-style: normal;
}

.notice-row__meta time {
  flex: 0 0 auto;
  font-variant-numeric: tabular-nums;
}

.notice-row strong,
.notice-row small {
  display: block;
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
}

.notice-row strong {
  color: var(--home-ink);
  font-size: 13px;
  font-weight: 700;
  line-height: 19px;
  white-space: nowrap;
}

.notice-row small {
  color: var(--home-muted);
  font-size: 13px;
  line-height: 20px;
  white-space: nowrap;
}

.notice-empty {
  padding: 34px 0;
}

.risk-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  border: 1px solid #e5ecf2;
  border-radius: 8px;
  padding: 10px 12px;
  background: #fff;
  color: #334155;
  text-align: left;
  cursor: pointer;
}

.risk-row:hover {
  background: #f8fafc;
}

.risk-row__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--home-primary);
}

.risk-row--warning .risk-row__dot {
  background: var(--home-warning);
}

.risk-row--danger .risk-row__dot {
  background: var(--home-danger);
}

.risk-row--info .risk-row__dot {
  background: var(--home-info);
}

.risk-row span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.risk-row strong,
.panel-heading > strong {
  color: var(--home-primary);
  font-size: 18px;
  line-height: 25px;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.quick-grid button {
  display: grid;
  min-width: 0;
  justify-items: center;
  gap: 8px;
  border: 1px solid #e4ebf2;
  border-radius: 8px;
  padding: 14px 8px;
  background: #fbfdff;
  color: #334155;
  cursor: pointer;
}

.quick-grid button:hover {
  border-color: rgba(47, 119, 117, 0.34);
  color: var(--home-primary);
}

.quick-grid i {
  font-size: 20px;
}

.quick-grid span {
  overflow: hidden;
  max-width: 100%;
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1180px) {
  .task-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .portal-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .side-column {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .home-shell {
    gap: 10px;
  }

  .home-hero {
    align-items: stretch;
    flex-direction: column;
    padding: 14px;
  }

  .home-hero__actions {
    align-items: stretch;
    flex-direction: column;
  }

  .task-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    padding: 10px;
  }

  .task-tile {
    align-items: flex-start;
    flex-direction: column;
    padding: 12px;
  }

  .todo-panel,
  .notice-panel,
  .risk-panel,
  .quick-panel {
    padding: 14px;
  }

  .date-chip {
    justify-content: center;
  }

  .panel-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .panel-link {
    width: 100%;
  }

  .todo-tabs {
    display: flex;
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: none;
  }

  .todo-tabs::-webkit-scrollbar {
    display: none;
  }

  .todo-tab {
    min-width: 96px;
  }

  .todo-row {
    grid-template-columns: 4px minmax(0, 1fr) 28px;
    gap: 10px;
  }

  .todo-row__meta {
    grid-column: 2 / 4;
    grid-row: 2;
    justify-items: start;
  }

  .todo-row__title {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }

  .todo-row__title strong,
  .todo-row__main small {
    white-space: normal;
  }

  .side-column,
  .quick-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
