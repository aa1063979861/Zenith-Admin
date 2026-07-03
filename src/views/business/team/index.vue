<template>
  <CommonPage title="组织管理" class="zenith-data-page">
    <n-tabs v-model:value="activeTab" type="line" animated class="zenith-data-tabs">
      <n-tab-pane name="overview" tab="组织概览">
        <n-grid cols="1 s:2 l:4" :x-gap="12" :y-gap="12" responsive="screen" class="mb-16">
          <n-grid-item v-for="item in summaryCards" :key="item.key">
            <n-card size="small" :bordered="false" class="summary-card">
              <div class="text-12 color-#64748b">
                {{ item.label }}
              </div>
              <div class="mt-8 flex items-end justify-between">
                <span class="text-28 color-#0f172a font-semibold leading-none">{{ item.value }}</span>
                <NTag size="small" :type="item.type">
                  {{ item.caption }}
                </NTag>
              </div>
            </n-card>
          </n-grid-item>
        </n-grid>

        <n-grid cols="1 l:2" :x-gap="12" :y-gap="12" responsive="screen">
          <n-grid-item>
            <n-card title="部门人数分布" segmented>
              <n-empty v-if="!summary.departmentStats.length" size="small" description="暂无部门数据" />
              <div v-else class="department-stat-list">
                <div v-for="item in summary.departmentStats" :key="item.id" class="department-stat-item">
                  <div class="department-stat-main">
                    <div class="department-stat-name">
                      {{ item.name }}
                      <NTag v-if="!item.activeEmployeeCount" size="tiny" :bordered="false">
                        空部门
                      </NTag>
                    </div>
                    <div class="department-stat-meta">
                      在职 {{ item.activeEmployeeCount }} · 离职 {{ item.inactiveEmployeeCount }}
                    </div>
                  </div>
                  <div class="department-stat-bar">
                    <span :class="{ 'is-empty': !item.activeEmployeeCount }" :style="{ width: `${departmentBarWidth(item.activeEmployeeCount)}%` }" />
                  </div>
                  <div class="department-stat-value">
                    {{ departmentShare(item.activeEmployeeCount) }}%
                  </div>
                </div>
              </div>
            </n-card>
          </n-grid-item>

          <n-grid-item>
            <n-card title="组织健康" segmented>
              <n-empty v-if="!organizationWarnings.length" size="small" description="暂无待处理事项" />
              <div v-else class="health-list">
                <div v-for="item in organizationWarnings" :key="item.key" class="health-item" :class="`health-item--${item.type}`">
                  <div class="health-item__main">
                    <div class="health-item__title">
                      {{ item.title }}
                    </div>
                    <div class="health-item__text">
                      {{ item.text }}
                    </div>
                  </div>
                  <NButton size="small" quaternary type="primary" @click="handleHealthAction(item.action)">
                    {{ item.actionText }}
                  </NButton>
                </div>
              </div>
            </n-card>
          </n-grid-item>
        </n-grid>
      </n-tab-pane>

      <n-tab-pane name="departments" tab="部门架构">
        <n-space vertical :size="12" class="zenith-data-stack">
          <n-card title="架构图" segmented>
            <div v-if="departmentTree.length" class="org-chart">
              <DepartmentChart :nodes="organizationChart" :selected-id="selectedDepartmentId" @node-click="handleChartNodeClick" />
            </div>
            <n-empty v-else description="暂无部门架构" />
          </n-card>

          <n-form class="department-filter-bar zenith-filter-bar" data-filter-collapsed-rows="all" inline label-placement="left" :show-feedback="false">
            <n-form-item v-if="departmentListFiltered" label="当前范围">
              <NTag size="small" type="info" :bordered="false">
                {{ selectedDepartment.name }}及下级
              </NTag>
            </n-form-item>
            <n-form-item class="zenith-filter-actions">
              <n-space>
                <NButton v-if="departmentListFiltered" secondary @click="clearDepartmentFilters">
                  <i class="i-fe:x mr-4" />
                  清除筛选
                </NButton>
                <NButton v-permission="'AddDepartment'" type="primary" secondary @click="openDepartmentForm()">
                  <i class="i-fe:plus mr-4" />
                  新增部门
                </NButton>
              </n-space>
            </n-form-item>
          </n-form>

          <EnhancedDataTable
            storage-key="business.organization.departments"
            :loading="departmentLoading"
            :columns="departmentColumns"
            :data="departmentListRows"
            :min-scroll-x="760"
            :render-expand-icon="renderDepartmentExpandIcon"
            :row-key="row => row.id"
            :row-props="departmentRowProps"
            :row-action="hasPermission('EditDepartment') ? openDepartmentForm : undefined"
            size="small"
          />
        </n-space>
      </n-tab-pane>

      <n-tab-pane name="employees" tab="员工档案">
        <n-card :bordered="false" class="zenith-data-card">
          <n-form class="employee-filter-bar zenith-filter-bar" data-filter-collapsed-rows="all" label-placement="left" label-width="72" :show-feedback="false">
            <n-grid cols="1 m:2 l:4" :x-gap="12" :y-gap="12" responsive="screen">
              <n-form-item-gi label="关键字">
                <n-input v-model:value="filters.keyword" clearable placeholder="姓名、工号、手机号" @keyup.enter="handleSearch" />
              </n-form-item-gi>
              <n-form-item-gi label="部门">
                <n-select v-model:value="filters.departmentCode" :options="store.departmentOptions" clearable filterable placeholder="全部部门" />
              </n-form-item-gi>
              <n-form-item-gi label="职位">
                <n-select v-model:value="filters.positionCode" :options="store.positionOptions" clearable filterable placeholder="全部职位" />
              </n-form-item-gi>
              <n-form-item-gi label="人事状态">
                <n-select v-model:value="filters.active" :options="activeFilterOptions" clearable placeholder="全部状态" />
              </n-form-item-gi>
              <n-form-item-gi class="employee-filter-actions zenith-filter-actions">
                <n-space justify="end">
                  <NButton type="primary" @click="handleSearch">
                    <i class="i-fe:search mr-4" />
                    查询
                  </NButton>
                  <NButton secondary @click="handleReset">
                    <i class="i-fe:rotate-ccw mr-4" />
                    重置
                  </NButton>
                  <NButton secondary @click="loadEmployees">
                    <i class="i-fe:refresh-cw mr-4" />
                    刷新
                  </NButton>
                </n-space>
              </n-form-item-gi>
            </n-grid>
          </n-form>

          <EnhancedDataTable
            remote
            storage-key="business.organization.employees"
            :loading="employeeLoading"
            :columns="enhancedEmployeeColumns"
            :data="rows"
            :pagination="teamPagination"
            :min-scroll-x="1160"
            :row-key="row => row.id"
            :row-props="employeeRowProps"
            :row-action="openEmployee"
            mobile-primary-key="employeeName"
            mobile-status-key="active"
            :mobile-secondary-keys="['departmentName', 'positionName', 'gender', 'phone']"
            :mobile-meta-keys="['employeeNo', 'entryDate']"
            flex-height
            size="small"
            @update:sorter="handleSorterChange"
          />
        </n-card>
      </n-tab-pane>
    </n-tabs>

    <n-modal
      v-model:show="showDepartmentModal"
      preset="card"
      :title="departmentModalTitle"
      closable
      style="width: min(620px, 92vw)"
    >
      <n-alert v-if="departmentFormError" class="mb-16" type="error" :bordered="false">
        {{ departmentFormError }}
      </n-alert>

      <n-form label-placement="top" :model="departmentForm">
        <n-grid cols="1 m:2" :x-gap="12" responsive="screen">
          <n-form-item-gi label="部门名称">
            <n-input v-model:value="departmentForm.name" placeholder="例如：综合部" />
          </n-form-item-gi>
          <n-form-item-gi label="上级部门">
            <n-select
              v-model:value="departmentForm.parentId"
              :options="departmentParentOptions"
              clearable
              filterable
              placeholder="顶级部门"
            />
          </n-form-item-gi>
          <n-form-item-gi label="部门负责人">
            <n-select
              v-model:value="departmentForm.managerUserId"
              :options="store.employeeOptions"
              clearable
              filterable
              placeholder="请选择在职员工"
            />
          </n-form-item-gi>
          <n-form-item-gi label="排序">
            <n-input-number v-model:value="departmentForm.sort" class="w-full" :min="1" :precision="0" :show-button="false" />
          </n-form-item-gi>
          <n-form-item-gi label="是否启用">
            <n-switch v-model:value="departmentForm.enabled" />
          </n-form-item-gi>
        </n-grid>
        <n-form-item label="备注">
          <n-input v-model:value="departmentForm.remark" type="textarea" placeholder="可选" />
        </n-form-item>
      </n-form>

      <template #footer>
        <n-space justify="end">
          <NButton @click="showDepartmentModal = false">
            取消
          </NButton>
          <NButton type="primary" :loading="departmentSaving" @click="submitDepartment">
            保存
          </NButton>
        </n-space>
      </template>
    </n-modal>

    <n-drawer v-model:show="showEmployeeDrawer" :width="drawerWidth" placement="right">
      <n-drawer-content :title="employeeDrawerTitle" closable>
        <n-alert v-if="employeeFormError" class="mb-16" type="error" :bordered="false">
          {{ employeeFormError }}
        </n-alert>

        <n-tabs v-model:value="employeeDrawerTab" type="line" animated>
          <n-tab-pane name="detail" tab="资料总览">
            <n-descriptions bordered size="small" label-placement="left" :column="detailColumn">
              <n-descriptions-item label="员工姓名">
                {{ detailValue(employeeForm.employeeName) }}
              </n-descriptions-item>
              <n-descriptions-item label="人事状态">
                <NTag size="small" :type="employeeForm.active ? 'success' : 'warning'">
                  {{ employeeForm.active ? '在职' : '离职' }}
                </NTag>
              </n-descriptions-item>
              <n-descriptions-item label="部门">
                {{ detailValue(employeeForm.departmentName) }}
              </n-descriptions-item>
              <n-descriptions-item label="职位">
                {{ detailValue(employeeForm.positionName) }}
              </n-descriptions-item>
              <n-descriptions-item label="工号">
                {{ detailValue(employeeForm.employeeNo) }}
              </n-descriptions-item>
              <n-descriptions-item label="性别">
                {{ detailValue(resolveGenderLabel(employeeForm.gender)) }}
              </n-descriptions-item>
              <n-descriptions-item label="手机号">
                {{ detailValue(employeeForm.phone) }}
              </n-descriptions-item>
              <n-descriptions-item label="邮箱">
                {{ detailValue(employeeForm.email) }}
              </n-descriptions-item>
              <n-descriptions-item label="入职日期">
                {{ detailValue(employeeForm.entryDate) }}
              </n-descriptions-item>
              <n-descriptions-item label="离职日期">
                {{ detailValue(employeeForm.leaveDate) }}
              </n-descriptions-item>
              <n-descriptions-item label="出生日期">
                {{ detailValue(employeeForm.birthday) }}
              </n-descriptions-item>
              <n-descriptions-item label="紧急联系人">
                {{ detailValue(employeeForm.emergencyContact) }}
              </n-descriptions-item>
              <n-descriptions-item label="紧急电话">
                {{ detailValue(employeeForm.emergencyPhone) }}
              </n-descriptions-item>
              <n-descriptions-item label="联系地址">
                {{ detailValue(employeeForm.address) }}
              </n-descriptions-item>
              <n-descriptions-item label="档案备注">
                {{ detailValue(employeeForm.profileRemark) }}
              </n-descriptions-item>
            </n-descriptions>
          </n-tab-pane>

          <n-tab-pane name="edit" tab="编辑档案">
            <n-form label-placement="top" :model="employeeForm">
              <n-grid cols="1 m:2" :x-gap="12" responsive="screen">
                <n-form-item-gi label="员工姓名">
                  <n-input v-model:value="employeeForm.employeeName" placeholder="员工真实姓名" />
                </n-form-item-gi>
                <n-form-item-gi label="人事状态">
                  <n-switch v-model:value="employeeForm.active">
                    <template #checked>
                      在职
                    </template>
                    <template #unchecked>
                      离职
                    </template>
                  </n-switch>
                </n-form-item-gi>
                <n-form-item-gi label="工号">
                  <n-input v-model:value="employeeForm.employeeNo" placeholder="可选" />
                </n-form-item-gi>
                <n-form-item-gi label="部门">
                  <n-select
                    v-model:value="employeeForm.departmentCode"
                    :options="store.departmentOptions"
                    clearable
                    filterable
                    placeholder="请选择部门"
                    @update:value="syncEmployeeDepartmentName"
                  />
                </n-form-item-gi>
                <n-form-item-gi label="职位">
                  <n-select
                    v-model:value="employeeForm.positionCode"
                    :options="store.positionOptions"
                    clearable
                    filterable
                    placeholder="请选择职位"
                    @update:value="syncEmployeePositionName"
                  />
                </n-form-item-gi>
                <n-form-item-gi label="性别">
                  <n-select v-model:value="employeeForm.gender" :options="genderOptions" clearable placeholder="请选择性别" />
                </n-form-item-gi>
                <n-form-item-gi label="手机号">
                  <n-input v-model:value="employeeForm.phone" placeholder="可选" />
                </n-form-item-gi>
                <n-form-item-gi label="邮箱">
                  <n-input v-model:value="employeeForm.email" placeholder="可选" />
                </n-form-item-gi>
                <n-form-item-gi label="入职日期">
                  <AppDatePicker
                    v-model:formatted-value="employeeForm.entryDate"
                    class="w-full"
                    type="date"
                    clearable
                    value-format="yyyy-MM-dd"
                  />
                </n-form-item-gi>
                <n-form-item-gi v-if="!employeeForm.active" label="离职日期">
                  <AppDatePicker
                    v-model:formatted-value="employeeForm.leaveDate"
                    class="w-full"
                    type="date"
                    clearable
                    value-format="yyyy-MM-dd"
                  />
                </n-form-item-gi>
                <n-form-item-gi label="出生日期">
                  <AppDatePicker
                    v-model:formatted-value="employeeForm.birthday"
                    class="w-full"
                    type="date"
                    clearable
                    value-format="yyyy-MM-dd"
                  />
                </n-form-item-gi>
                <n-form-item-gi label="紧急联系人">
                  <n-input v-model:value="employeeForm.emergencyContact" placeholder="可选" />
                </n-form-item-gi>
                <n-form-item-gi label="紧急联系电话">
                  <n-input v-model:value="employeeForm.emergencyPhone" placeholder="可选" />
                </n-form-item-gi>
                <n-form-item-gi label="联系地址">
                  <n-input v-model:value="employeeForm.address" placeholder="可选" />
                </n-form-item-gi>
              </n-grid>
              <n-form-item label="档案备注">
                <n-input v-model:value="employeeForm.profileRemark" type="textarea" placeholder="可选" />
              </n-form-item>
            </n-form>
          </n-tab-pane>
        </n-tabs>

        <template #footer>
          <n-space justify="end">
            <NButton @click="showEmployeeDrawer = false">
              取消
            </NButton>
            <NButton type="primary" :loading="employeeSaving" @click="submitEmployee">
              保存档案
            </NButton>
          </n-space>
        </template>
      </n-drawer-content>
    </n-drawer>
  </CommonPage>
</template>

<script setup>
import { NButton, NTag } from 'naive-ui'
import { AppDatePicker, EnhancedDataTable } from '@/components/common'
import { useResponsiveLayout } from '@/composables'
import { hasPermission, withPermission } from '@/directives'
import { createTablePagination, enhanceTableColumns } from '@/utils'
import { businessApi } from '../shared/api'
import { useBusinessStore } from '../shared/useBusinessStore'

defineOptions({ name: 'TeamManagement' })

const DepartmentChart = defineComponent({
  name: 'DepartmentChart',
  props: {
    nodes: {
      type: Array,
      default: () => [],
    },
    selectedId: {
      type: Number,
      default: null,
    },
  },
  emits: ['nodeClick'],
  setup(props, { emit }) {
    const stageRef = ref(null)
    const stageWidth = ref(0)
    let resizeObserver
    onMounted(() => {
      resizeObserver = new ResizeObserver(([entry]) => {
        stageWidth.value = entry.contentRect.width
      })
      if (stageRef.value)
        resizeObserver.observe(stageRef.value)
    })
    onBeforeUnmount(() => resizeObserver?.disconnect())

    return () => {
      const layout = createOrgChartLayout(props.nodes)
      const scale = stageWidth.value ? Math.min(1, Math.max(CHART_MIN_SCALE, stageWidth.value / layout.width)) : 1
      const viewportWidth = Math.ceil(layout.width * scale)
      const viewportHeight = Math.ceil(layout.height * scale)
      return h('div', { class: 'org-chart-stage', ref: stageRef }, [
        h('div', { class: 'org-chart-viewport', style: { width: `${viewportWidth}px`, height: `${viewportHeight}px` } }, [
          h('div', { class: 'org-chart-canvas', style: { width: `${layout.width}px`, height: `${layout.height}px`, transform: `scale(${scale})` } }, [
            h('svg', { class: 'org-chart-lines', width: layout.width, height: layout.height }, layout.lines.map((line, index) =>
              h('path', { key: index, class: 'org-chart-line', d: line }),
            )),
            ...layout.nodes.map(({ node, x, y, width }) => h('button', {
              'class': [
                'org-chart-node',
                node.root && 'org-chart-node--root',
                props.selectedId === node.id && 'org-chart-node--selected',
                !node.enabled && 'org-chart-node--disabled',
              ],
              'key': node.id,
              'type': 'button',
              'aria-pressed': props.selectedId === node.id,
              'data-department-id': node.id,
              'style': { left: `${x - width / 2}px`, top: `${y}px`, width: `${width}px` },
              'onClick': () => emit('nodeClick', node),
            }, [
              h('div', { class: 'org-chart-node-title' }, node.name),
              node.root ? null : h('div', { class: 'org-chart-node-meta' }, node.managerName || '未设负责人'),
              h('div', { class: 'org-chart-node-count' }, `在职 ${node.activeEmployeeCount || 0} 人`),
            ])),
          ]),
        ]),
      ])
    }
  },
})

const CHART_MIN_SCALE = 0.68
const CHART_NODE_WIDTH = 152
const CHART_ROOT_WIDTH = 264
const CHART_NODE_HEIGHT = 72
const CHART_COLUMN_GAP = 24
const CHART_LEVEL_GAP = 68
const CHART_PADDING = 20

function createOrgChartLayout(nodes = []) {
  const measuredRoots = nodes.map(measureChartNode)
  const rootSpan = sumSpans(measuredRoots)
  const output = { nodes: [], lines: [], maxBottom: 0 }
  let left = 0
  measuredRoots.forEach((root) => {
    placeChartNode(root, left, 0, output)
    left += root.span + CHART_COLUMN_GAP
  })
  return {
    width: Math.round(rootSpan + CHART_PADDING * 2),
    height: Math.round(output.maxBottom + CHART_PADDING * 2),
    nodes: output.nodes.map(node => ({ ...node, x: node.x + CHART_PADDING, y: node.y + CHART_PADDING })),
    lines: output.lines.map(line => offsetPath(line, CHART_PADDING)),
  }
}

function measureChartNode(node) {
  const children = (node.children || []).map(measureChartNode)
  const width = node.root ? CHART_ROOT_WIDTH : CHART_NODE_WIDTH
  return {
    node,
    children,
    width,
    span: Math.max(width, sumSpans(children)),
  }
}

function sumSpans(items) {
  return items.reduce((total, item, index) => total + item.span + (index ? CHART_COLUMN_GAP : 0), 0)
}

function placeChartNode(item, left, depth, output) {
  const y = depth * (CHART_NODE_HEIGHT + CHART_LEVEL_GAP)
  const nodeIndex = output.nodes.length
  output.nodes.push(null)
  output.maxBottom = Math.max(output.maxBottom, y + CHART_NODE_HEIGHT)

  if (!item.children.length) {
    const x = left + item.span / 2
    output.nodes[nodeIndex] = { node: item.node, x, y, width: item.width }
    return { x, y }
  }

  const childSpan = sumSpans(item.children)
  let childLeft = left + (item.span - childSpan) / 2
  const children = item.children.map((child) => {
    const placed = placeChartNode(child, childLeft, depth + 1, output)
    childLeft += child.span + CHART_COLUMN_GAP
    return placed
  })
  const x = (children[0].x + children[children.length - 1].x) / 2
  output.nodes[nodeIndex] = { node: item.node, x, y, width: item.width }
  const parentBottom = y + CHART_NODE_HEIGHT
  const childTop = (depth + 1) * (CHART_NODE_HEIGHT + CHART_LEVEL_GAP)
  const jointY = parentBottom + (childTop - parentBottom) / 2
  output.lines.push(`M ${x} ${parentBottom} V ${jointY}`)
  if (children.length > 1)
    output.lines.push(`M ${children[0].x} ${jointY} H ${children[children.length - 1].x}`)
  children.forEach(child => output.lines.push(`M ${child.x} ${jointY} V ${childTop}`))
  return { x, y }
}

function offsetPath(path, offset) {
  return path.replace(/-?\d+(?:\.\d+)?/g, value => String(Number(value) + offset))
}

const store = useBusinessStore()
const { isMobile } = useResponsiveLayout()
const activeTab = ref('overview')
const departmentLoading = ref(false)
const employeeLoading = ref(false)
const summaryLoading = ref(false)
const teamSummaryLoading = ref(false)
const departmentSaving = ref(false)
const employeeSaving = ref(false)
const rows = ref([])
const summary = reactive(createEmptySummary())
const teamSummary = reactive(createEmptyTeamSummary())
const filters = reactive(createEmptyFilters())
const showDepartmentModal = ref(false)
const departmentMode = ref('create')
const departmentFormError = ref('')
const departmentForm = reactive(createEmptyDepartmentForm())
const showEmployeeDrawer = ref(false)
const employeeDrawerTab = ref('detail')
const employeeFormError = ref('')
const employeeForm = reactive(createEmptyEmployeeForm())
const selectedDepartmentId = ref(null)
const teamSorter = ref({
  columnKey: '',
  order: false,
})
const teamPagination = createTablePagination({
  onUpdatePage: handlePageChange,
  onUpdatePageSize: handlePageSizeChange,
})

const detailColumn = computed(() => (isMobile.value ? 1 : 2))
const drawerWidth = computed(() => (isMobile.value ? '100%' : 760))
const departmentTree = computed(() => store.departmentTree)
const organizationName = '达州众恒信息科技有限公司'
const organizationChart = computed(() => [{
  id: 'organization-root',
  name: organizationName,
  root: true,
  enabled: true,
  activeEmployeeCount: summary.activeEmployees,
  children: departmentTree.value,
}])
const flatDepartmentRows = computed(() => flattenDepartments(departmentTree.value))
const selectedDepartment = computed(() => flatDepartmentRows.value.find(row => row.id === selectedDepartmentId.value) || null)
const selectedDepartmentNode = computed(() => (selectedDepartmentId.value ? findDepartmentNode(departmentTree.value, selectedDepartmentId.value) : null))
const departmentListRows = computed(() => {
  return toDepartmentTableRows(selectedDepartmentNode.value ? [selectedDepartmentNode.value] : departmentTree.value)
})
const departmentListFiltered = computed(() => !!selectedDepartment.value)
const maxDepartmentTotal = computed(() => Math.max(...summary.departmentStats.map(item => Number(item.activeEmployeeCount || 0)), 1))
const departmentModalTitle = computed(() => (departmentMode.value === 'create' ? '新增部门' : '编辑部门'))
const employeeDrawerTitle = computed(() => `员工档案 - ${employeeForm.employeeName || '未命名员工'}`)
const enhancedEmployeeColumns = computed(() => enhanceTableColumns(createSortedColumns(employeeColumns, teamSorter.value), { remote: true, remoteSortable: true, indexOptions: { fixed: 'left' } }))
const summaryCards = computed(() => [
  { key: 'activeEmployees', label: '在职员工', value: summary.activeEmployees, caption: summaryLoading.value ? '刷新中' : '不含离职', type: 'success' },
  { key: 'departments', label: '部门数量', value: summary.departments, caption: `${summary.enabledDepartments} 个启用`, type: 'info' },
  { key: 'missingManagers', label: '未设负责人', value: summary.missingManagerCount, caption: summary.missingManagerCount ? '待设置' : '已覆盖', type: summary.missingManagerCount ? 'warning' : 'success' },
  { key: 'unassigned', label: '未分配部门', value: summary.unassignedDepartmentCount, caption: '在职员工', type: summary.unassignedDepartmentCount ? 'warning' : 'default' },
])
const organizationWarnings = computed(() => [
  summary.unassignedDepartmentCount
    ? { key: 'department', type: 'warning', title: '员工部门待补齐', text: `${summary.unassignedDepartmentCount} 名在职员工未分配部门。`, action: 'employees', actionText: '查看员工' }
    : null,
  summary.unassignedPositionCount
    ? { key: 'position', type: 'warning', title: '员工职位待补齐', text: `${summary.unassignedPositionCount} 名在职员工未分配职位。`, action: 'employees', actionText: '查看员工' }
    : null,
  summary.missingManagerCount
    ? { key: 'manager', type: 'info', title: '负责人未覆盖', text: `${summary.missingManagerCount} 个启用部门未设置负责人。`, action: 'departments', actionText: '设置负责人' }
    : null,
  summary.disabledDepartmentEmployeeCount
    ? { key: 'disabledDepartment', type: 'error', title: '停用部门仍有关联员工', text: `${summary.disabledDepartmentEmployeeCount} 名在职员工仍归属停用部门。`, action: 'employees', actionText: '查看员工' }
    : null,
].filter(Boolean))
const departmentParentOptions = computed(() => {
  const blockedIds = departmentForm.id ? [...(findDepartment(flatDepartmentRows.value, departmentForm.id)?.descendantIds || [])] : []
  if (departmentForm.id)
    blockedIds.push(departmentForm.id)
  return flatDepartmentRows.value
    .filter(row => row.enabled && !blockedIds.includes(row.id))
    .map(row => ({ label: `${'　'.repeat(row.level)}${row.name}`, value: row.id }))
})

watch(flatDepartmentRows, (rows) => {
  if (selectedDepartmentId.value && !rows.some(row => row.id === selectedDepartmentId.value))
    selectedDepartmentId.value = null
})

const genderOptions = [
  { label: '男', value: 1 },
  { label: '女', value: 2 },
]
const genderLabels = [
  { label: '未填写', value: 0 },
  ...genderOptions,
]
const activeFilterOptions = [
  { label: '在职', value: 1 },
  { label: '离职', value: 0 },
]

const departmentColumns = [
  {
    title: '部门名称',
    key: 'name',
    width: 120,
    render(row) {
      return h('div', { class: 'department-name-cell', style: `padding-left: ${row.level * 18}px;` }, [
        h('span', row.name),
        Number(row.activeEmployeeCount || 0) === 0
          ? h(NTag, { size: 'tiny', type: 'default', bordered: false }, { default: () => '空部门' })
          : null,
      ])
    },
  },
  { title: '负责人', key: 'managerName', width: 130, render: row => row.managerName || '未设置' },
  { title: '在职人数', key: 'activeEmployeeCount', width: 100 },
  {
    title: '状态',
    key: 'enabled',
    width: 90,
    render(row) {
      return h(NTag, { size: 'small', type: row.enabled ? 'success' : 'default' }, { default: () => (row.enabled ? '启用' : '停用') })
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 230,
    align: 'right',
    fixed: 'right',
    render(row) {
      return [
        withPermission(h(NButton, { size: 'small', secondary: true, type: 'primary', onClick: () => openDepartmentForm({ parentId: row.id }) }, { default: () => '子部门' }), 'AddDepartment'),
        withPermission(h(NButton, { size: 'small', secondary: true, type: 'primary', onClick: () => openDepartmentForm(row) }, { default: () => '编辑' }), 'EditDepartment'),
        withPermission(h(NButton, { size: 'small', secondary: true, type: 'error', disabled: row.childCount > 0 || row.employeeCount > 0, onClick: () => removeDepartment(row) }, { default: () => '删除' }), 'DeleteDepartment'),
      ]
    },
  },
]

function renderDepartmentExpandIcon() {
  return h('i', { class: 'i-fe:chevron-right department-expand-icon' })
}

function renderEmployeeName(row) {
  return h('div', { class: 'employee-name-cell' }, [
    h('button', { class: 'employee-name-link', type: 'button', onClick: () => openEmployee(row) }, row.employeeName || row.nickName || row.username || '未命名员工'),
  ])
}

function renderEmptyValue(value, emptyText = '未填写') {
  const text = String(value ?? '').trim()
  return text || renderMutedText(emptyText)
}

function renderMutedText(text) {
  return h('span', { class: 'muted-cell-text' }, text)
}

const employeeColumns = [
  {
    title: '员工姓名',
    key: 'employeeName',
    width: 170,
    render(row) {
      return renderEmployeeName(row)
    },
  },
  { title: '部门', key: 'departmentName', width: 140, ellipsis: { tooltip: true }, render: row => renderEmptyValue(row.departmentName, '未分配') },
  { title: '职位', key: 'positionName', width: 150, ellipsis: { tooltip: true }, render: row => renderEmptyValue(row.positionName, '未分配') },
  {
    title: '性别',
    key: 'gender',
    width: 80,
    render(row) {
      return resolveGenderLabel(row.gender)
    },
  },
  { title: '工号', key: 'employeeNo', width: 110, render: row => renderEmptyValue(row.employeeNo) },
  { title: '手机号', key: 'phone', width: 136, render: row => renderEmptyValue(row.phone) },
  { title: '入职日期', key: 'entryDate', width: 120, render: row => renderEmptyValue(row.entryDate) },
  { title: '离职日期', key: 'leaveDate', width: 120, defaultHidden: true, render: row => (row.active ? renderMutedText('在职中') : renderEmptyValue(row.leaveDate)) },
  {
    title: '人事状态',
    key: 'active',
    width: 100,
    render(row) {
      return h(NTag, { size: 'small', type: row.active ? 'success' : 'warning', bordered: false }, { default: () => (row.active ? '在职' : '离职') })
    },
  },
  { title: '邮箱', key: 'email', minWidth: 180, ellipsis: { tooltip: true }, defaultHidden: true, render: row => renderEmptyValue(row.email) },
  {
    title: '操作',
    key: 'actions',
    width: 120,
    align: 'right',
    fixed: 'right',
    render(row) {
      return withPermission(h(NButton, { size: 'small', type: 'primary', quaternary: true, onClick: () => openEmployee(row) }, { default: () => '编辑档案' }), 'EditTeamProfile')
    },
  },
]

onMounted(loadInitialData)

async function loadInitialData() {
  try {
    await Promise.all([
      store.loadDictionaries(),
      store.loadDepartments(),
      store.loadEmployees(),
      loadSummary(),
      loadTeamSummary(),
      loadEmployees(),
    ])
  }
  catch (error) {
    $message.error(error?.message || '组织管理数据加载失败')
  }
}

async function loadSummary() {
  summaryLoading.value = true
  try {
    const { data } = await businessApi.organization.summary()
    Object.assign(summary, normalizeSummary(data))
  }
  finally {
    summaryLoading.value = false
  }
}

async function loadDepartments() {
  departmentLoading.value = true
  try {
    await store.loadDepartments()
  }
  finally {
    departmentLoading.value = false
  }
}

async function loadEmployees() {
  employeeLoading.value = true
  try {
    const { data } = await businessApi.team.page({
      pageNo: teamPagination.page || 1,
      pageSize: teamPagination.pageSize || teamPagination.defaultPageSize,
      ...buildQueryParams(),
    })
    rows.value = data?.pageData || []
    teamPagination.itemCount = Number(data?.total || 0)
  }
  finally {
    employeeLoading.value = false
  }
}

async function loadTeamSummary() {
  teamSummaryLoading.value = true
  try {
    const { data } = await businessApi.team.summary()
    Object.assign(teamSummary, normalizeTeamSummary(data))
  }
  finally {
    teamSummaryLoading.value = false
  }
}

function createEmptySummary() {
  return {
    activeEmployees: 0,
    inactiveEmployees: 0,
    departments: 0,
    enabledDepartments: 0,
    disabledDepartments: 0,
    positions: 0,
    unassignedDepartmentCount: 0,
    unassignedPositionCount: 0,
    missingManagerCount: 0,
    disabledDepartmentEmployeeCount: 0,
    departmentStats: [],
  }
}

function createEmptyTeamSummary() {
  return {
    total: 0,
    active: 0,
    inactive: 0,
    departments: 0,
    positions: 0,
    missingDepartmentCount: 0,
    missingPositionCount: 0,
    missingEmployeeNoCount: 0,
    missingPhoneCount: 0,
    missingEntryDateCount: 0,
    missingEmergencyContactCount: 0,
    missingProfileCount: 0,
    departmentStats: [],
  }
}

function normalizeSummary(data = {}) {
  return {
    activeEmployees: Number(data?.activeEmployees || 0),
    inactiveEmployees: Number(data?.inactiveEmployees || 0),
    departments: Number(data?.departments || 0),
    enabledDepartments: Number(data?.enabledDepartments || 0),
    disabledDepartments: Number(data?.disabledDepartments || 0),
    positions: Number(data?.positions || 0),
    unassignedDepartmentCount: Number(data?.unassignedDepartmentCount || 0),
    unassignedPositionCount: Number(data?.unassignedPositionCount || 0),
    missingManagerCount: Number(data?.missingManagerCount || 0),
    disabledDepartmentEmployeeCount: Number(data?.disabledDepartmentEmployeeCount || 0),
    departmentStats: Array.isArray(data?.departmentStats) ? data.departmentStats : [],
  }
}

function normalizeTeamSummary(data = {}) {
  return {
    total: Number(data?.total || 0),
    active: Number(data?.active || 0),
    inactive: Number(data?.inactive || 0),
    departments: Number(data?.departments || 0),
    positions: Number(data?.positions || 0),
    missingDepartmentCount: Number(data?.missingDepartmentCount || 0),
    missingPositionCount: Number(data?.missingPositionCount || 0),
    missingEmployeeNoCount: Number(data?.missingEmployeeNoCount || 0),
    missingPhoneCount: Number(data?.missingPhoneCount || 0),
    missingEntryDateCount: Number(data?.missingEntryDateCount || 0),
    missingEmergencyContactCount: Number(data?.missingEmergencyContactCount || 0),
    missingProfileCount: Number(data?.missingProfileCount || 0),
    departmentStats: Array.isArray(data?.departmentStats) ? data.departmentStats : [],
  }
}

function createEmptyFilters() {
  return {
    keyword: '',
    departmentCode: null,
    positionCode: null,
    active: null,
  }
}

function createEmptyDepartmentForm() {
  return {
    id: null,
    parentId: null,
    name: '',
    managerUserId: null,
    enabled: true,
    sort: 1,
    remark: '',
  }
}

function createEmptyEmployeeForm() {
  return {
    id: null,
    active: true,
    employeeName: '',
    employeeNo: '',
    departmentCode: null,
    departmentName: '',
    positionCode: null,
    positionName: '',
    gender: null,
    phone: '',
    email: '',
    address: '',
    entryDate: null,
    birthday: null,
    leaveDate: null,
    emergencyContact: '',
    emergencyPhone: '',
    profileRemark: '',
  }
}

function buildQueryParams() {
  return {
    keyword: filters.keyword.trim() || undefined,
    departmentCode: filters.departmentCode || undefined,
    positionCode: filters.positionCode || undefined,
    active: filters.active,
    sortKey: teamSorter.value.columnKey || undefined,
    sortOrder: teamSorter.value.order || undefined,
  }
}

function flattenDepartments(nodes, level = 0, parentName = '') {
  return nodes.flatMap((node) => {
    const children = node.children || []
    const { children: _children, ...row } = node
    return [{ ...row, level, parentName, childCount: children.length, descendantIds: collectDepartmentIds(children) }, ...flattenDepartments(children, level + 1, node.name)]
  })
}

function toDepartmentTableRows(nodes, level = 0) {
  return nodes.map((node) => {
    const children = node.children || []
    const { children: _children, ...row } = node
    return {
      ...row,
      level,
      childCount: children.length,
      ...(children.length ? { children: toDepartmentTableRows(children, level + 1) } : {}),
    }
  })
}

function collectDepartmentIds(nodes) {
  return nodes.flatMap(node => [node.id, ...collectDepartmentIds(node.children || [])])
}

function findDepartment(rows, id) {
  return rows.find(row => row.id === id)
}

function findDepartmentNode(nodes, id) {
  for (const node of nodes) {
    if (node.id === id)
      return node
    const child = findDepartmentNode(node.children || [], id)
    if (child)
      return child
  }
  return null
}

function openDepartmentForm(row = {}) {
  Object.assign(departmentForm, {
    ...createEmptyDepartmentForm(),
    id: row.id || null,
    parentId: row.id && row.parentId !== undefined ? row.parentId : row.parentId || null,
    name: row.name || '',
    managerUserId: row.managerUserId || null,
    enabled: row.enabled ?? true,
    sort: row.sort || 1,
    remark: row.remark || '',
  })
  departmentMode.value = row.id ? 'edit' : 'create'
  departmentFormError.value = ''
  showDepartmentModal.value = true
}

async function submitDepartment() {
  const error = validateDepartmentForm()
  if (error) {
    departmentFormError.value = error
    return
  }

  departmentSaving.value = true
  try {
    const payload = {
      parentId: departmentForm.parentId,
      name: departmentForm.name.trim(),
      managerUserId: departmentForm.managerUserId,
      sort: departmentForm.sort,
      enabled: departmentForm.enabled,
      remark: departmentForm.remark.trim(),
    }
    if (departmentMode.value === 'edit')
      await businessApi.organization.updateDepartment(departmentForm.id, payload)
    else
      await businessApi.organization.createDepartment(payload)
    $message.success('部门已保存')
    showDepartmentModal.value = false
    await Promise.all([loadDepartments(), loadSummary()])
  }
  catch (error) {
    departmentFormError.value = error?.message || '保存失败'
  }
  finally {
    departmentSaving.value = false
  }
}

function validateDepartmentForm() {
  if (!departmentForm.name.trim())
    return '请填写部门名称。'
  if (!Number.isInteger(Number(departmentForm.sort)) || Number(departmentForm.sort) < 1)
    return '排序必须为正整数。'
  return ''
}

function removeDepartment(row) {
  if (row.childCount || row.employeeCount) {
    $message.warning('部门存在下级部门或关联员工，不能删除。')
    return
  }

  const d = $dialog.warning({
    title: '删除部门',
    content: `确认删除部门「${row.name}」？`,
    positiveText: '删除',
    negativeText: '取消',
    async onPositiveClick() {
      try {
        d.loading = true
        await businessApi.organization.deleteDepartment(row.id)
        $message.success('部门已删除')
        await Promise.all([loadDepartments(), loadSummary()])
      }
      catch (error) {
        $message.error(error?.message || '删除失败')
      }
      finally {
        d.loading = false
      }
    },
  })
}

function createSortedColumns(tableColumns, sorter) {
  return tableColumns.map((column) => {
    if (column.type || column.sortable === false || column.key === 'actions')
      return column
    return {
      ...column,
      sortOrder: sorter.columnKey === column.key ? sorter.order : false,
    }
  })
}

function openEmployee(row) {
  Object.assign(employeeForm, {
    ...createEmptyEmployeeForm(),
    id: row.id,
    active: Boolean(row.active),
    employeeName: row.employeeName || row.nickName || '',
    employeeNo: row.employeeNo || '',
    departmentCode: row.departmentCode || null,
    departmentName: row.departmentName || '',
    positionCode: row.positionCode || null,
    positionName: row.positionName || '',
    gender: [1, 2].includes(row.gender) ? row.gender : null,
    phone: row.phone || '',
    email: row.email || '',
    address: row.address || '',
    entryDate: row.entryDate || null,
    birthday: row.birthday || null,
    leaveDate: row.leaveDate || null,
    emergencyContact: row.emergencyContact || '',
    emergencyPhone: row.emergencyPhone || '',
    profileRemark: row.profileRemark || '',
  })
  employeeFormError.value = ''
  employeeDrawerTab.value = 'detail'
  showEmployeeDrawer.value = true
}

async function submitEmployee() {
  const error = validateEmployeeForm()
  if (error) {
    employeeFormError.value = error
    return
  }

  employeeSaving.value = true
  try {
    await businessApi.team.updateProfile(employeeForm.id, {
      employeeName: employeeForm.employeeName.trim(),
      employeeNo: employeeForm.employeeNo.trim(),
      departmentCode: employeeForm.departmentCode,
      positionCode: employeeForm.positionCode,
      gender: employeeForm.gender ?? 0,
      phone: employeeForm.phone.trim(),
      email: employeeForm.email.trim(),
      address: employeeForm.address.trim(),
      entryDate: employeeForm.entryDate || '',
      birthday: employeeForm.birthday || '',
      active: employeeForm.active,
      leaveDate: employeeForm.leaveDate || '',
      emergencyContact: employeeForm.emergencyContact.trim(),
      emergencyPhone: employeeForm.emergencyPhone.trim(),
      profileRemark: employeeForm.profileRemark.trim(),
    })
    $message.success('员工档案已保存')
    showEmployeeDrawer.value = false
    await Promise.all([loadEmployees(), loadTeamSummary(), loadSummary(), store.loadEmployees()])
  }
  catch (error) {
    employeeFormError.value = error?.message || '保存失败'
  }
  finally {
    employeeSaving.value = false
  }
}

function validateEmployeeForm() {
  if (!employeeForm.employeeName.trim())
    return '请填写员工姓名。'
  if (!employeeForm.departmentCode)
    return '请选择部门。'
  if (!employeeForm.positionCode)
    return '请选择职位。'
  if (!employeeForm.active && !employeeForm.leaveDate)
    return '员工离职时必须填写离职日期。'
  if (employeeForm.phone.trim() && !isValidMobilePhone(employeeForm.phone.trim()))
    return '手机号格式不正确。'
  if (employeeForm.emergencyPhone.trim() && !isValidContactPhone(employeeForm.emergencyPhone.trim()))
    return '紧急联系电话格式不正确。'
  if (employeeForm.email.trim() && !isValidEmail(employeeForm.email.trim()))
    return '邮箱格式不正确。'
  return ''
}

function isValidMobilePhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone)
}

function isValidContactPhone(phone) {
  return /^[+\d][+\d\s()-]{5,19}$/.test(phone)
}

function isValidEmail(email) {
  if (/\s/.test(email))
    return false
  const parts = email.split('@')
  if (parts.length !== 2)
    return false
  const [localPart, domain] = parts
  if (!localPart || !domain)
    return false
  const labels = domain.split('.')
  return labels.length >= 2 && labels.every(Boolean)
}

function handleSearch() {
  teamPagination.page = 1
  loadEmployees()
}

function handleReset() {
  Object.assign(filters, createEmptyFilters())
  handleSearch()
}

function employeeRowProps() {
  return {
    class: 'employee-table-row',
  }
}

function handlePageChange(page) {
  teamPagination.page = page
  loadEmployees()
}

function handlePageSizeChange(pageSize) {
  teamPagination.pageSize = pageSize
  teamPagination.page = 1
  loadEmployees()
}

function handleSorterChange(sorter) {
  const nextSorter = Array.isArray(sorter) ? sorter[0] : sorter
  teamSorter.value = nextSorter?.order
    ? { columnKey: String(nextSorter.columnKey), order: nextSorter.order }
    : { columnKey: '', order: false }
  teamPagination.page = 1
  loadEmployees()
}

function syncEmployeeDepartmentName(value) {
  employeeForm.departmentName = store.departmentOptions.find(item => item.value === value)?.label || ''
}

function syncEmployeePositionName(value) {
  employeeForm.positionName = store.positionOptions.find(item => item.value === value)?.label || ''
}

function departmentBarWidth(total) {
  const value = Number(total || 0)
  if (!value)
    return 0
  return Math.max(8, Math.round((value / maxDepartmentTotal.value) * 100))
}

function departmentShare(total) {
  if (!summary.activeEmployees)
    return 0
  return Math.round((Number(total || 0) / summary.activeEmployees) * 100)
}

function handleHealthAction(action) {
  if (action === 'departments') {
    activeTab.value = 'departments'
    selectedDepartmentId.value = null
    return
  }
  activeTab.value = 'employees'
  filters.active = 1
  handleSearch()
}

function handleChartNodeClick(node) {
  if (node.root) {
    clearDepartmentFilters()
    return
  }
  selectedDepartmentId.value = node.id
}

function clearDepartmentFilters() {
  selectedDepartmentId.value = null
}

function departmentRowProps(row) {
  return {
    class: row.id === selectedDepartmentId.value ? 'department-row--selected' : '',
  }
}

function resolveGenderLabel(gender) {
  return genderLabels.find(item => item.value === gender)?.label || '未填写'
}

function detailValue(value) {
  const text = String(value ?? '').trim()
  return text || '-'
}
</script>

<style scoped>
.summary-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.department-stat-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.department-stat-item {
  display: grid;
  grid-template-columns: minmax(120px, 180px) 1fr 48px;
  align-items: center;
  gap: 12px;
  min-height: 42px;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 10px;
}

.department-stat-item:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.department-stat-name {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.department-stat-meta {
  color: #64748b;
  font-size: 12px;
  line-height: 18px;
}

.department-stat-bar {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #e2e8f0;
}

.department-stat-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #2563eb;
}

.department-stat-bar span.is-empty {
  width: 0 !important;
}

.department-stat-value {
  color: #334155;
  font-size: 13px;
  font-weight: 600;
  text-align: right;
}

.health-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.health-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px 14px;
  background: #fff;
}

.health-item--warning {
  border-color: #fde68a;
  background: #fffbeb;
}

.health-item--info {
  border-color: #bfdbfe;
  background: #eff6ff;
}

.health-item--error {
  border-color: #fecaca;
  background: #fef2f2;
}

.health-item__main {
  min-width: 0;
}

.health-item__title {
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.health-item__text {
  margin-top: 2px;
  color: #64748b;
  font-size: 12px;
  line-height: 18px;
}

:deep(.employee-table-row) {
  cursor: pointer;
}

:deep(.employee-name-cell) {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 6px;
  vertical-align: middle;
}

:deep(.employee-name-link) {
  margin: 0;
  border: 0;
  padding: 0;
  background: transparent;
  color: #0f172a;
  cursor: pointer;
  font: inherit;
  font-weight: 600;
}

:deep(.employee-name-link:hover) {
  color: rgb(var(--primary-color));
}

:deep(.muted-cell-text) {
  color: #94a3b8;
  font-size: 12px;
}

.department-filter-note {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

:deep(.n-data-table-expand-trigger) {
  display: inline-flex;
  width: 18px;
  height: 18px;
  margin-right: 6px;
  border-radius: 50%;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: #94a3b8;
  vertical-align: middle;
  transition:
    background-color 0.18s ease,
    color 0.18s ease;
}

:deep(.n-data-table-expand-trigger:hover) {
  background: rgba(var(--primary-color), 0.08);
  color: rgb(var(--primary-color));
}

:deep(.n-data-table-expand-trigger--expanded) {
  background: rgba(var(--primary-color), 0.1);
  color: rgb(var(--primary-color));
}

:deep(.department-expand-icon) {
  display: block;
  width: 12px;
  height: 12px;
  transition: transform 0.18s ease;
}

:deep(.n-data-table-expand-trigger--expanded .department-expand-icon) {
  transform: rotate(90deg);
}

:deep(.department-name-cell) {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 6px;
  vertical-align: middle;
}

:deep(.department-name-cell span) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.department-row--selected td) {
  background: rgba(var(--primary-color), 0.06) !important;
}

.org-chart {
  display: flex;
  justify-content: center;
  min-width: 0;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: linear-gradient(180deg, #f8fafc 0%, #fff 46%), #fff;
  padding: 30px 16px 24px;
}

.org-chart :deep(.org-chart-stage) {
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 4px;
}

.org-chart :deep(.org-chart-viewport) {
  position: relative;
  margin: 0 auto;
}

.org-chart :deep(.org-chart-canvas) {
  position: absolute;
  top: 0;
  left: 0;
  flex: 0 0 auto;
  transform-origin: top left;
}

.org-chart :deep(.org-chart-lines) {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.org-chart :deep(.org-chart-line) {
  fill: none;
  stroke: #d8e1ea;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.2;
  shape-rendering: geometricPrecision;
  vector-effect: non-scaling-stroke;
}

.org-chart :deep(.org-chart-node) {
  position: absolute;
  box-sizing: border-box;
  margin: 0;
  min-height: 72px;
  border: 1px solid #d7e0ea;
  border-radius: 8px;
  background: #fff;
  color: inherit;
  display: flex;
  flex-direction: column;
  font: inherit;
  justify-content: center;
  padding: 12px 14px;
  text-align: center;
  box-shadow: 0 10px 24px rgb(15 23 42 / 6%);
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.org-chart :deep(.org-chart-node:hover) {
  border-color: rgb(var(--primary-color));
  box-shadow: 0 14px 30px rgb(15 23 42 / 10%);
}

.org-chart :deep(.org-chart-node:focus-visible) {
  border-color: rgb(var(--primary-color));
  box-shadow:
    0 14px 30px rgb(15 23 42 / 10%),
    0 0 0 3px rgba(var(--primary-color), 0.18);
  outline: none;
}

.org-chart :deep(.org-chart-node--selected) {
  border-color: rgb(var(--primary-color));
  box-shadow:
    0 14px 30px rgb(15 23 42 / 10%),
    0 0 0 2px rgba(var(--primary-color), 0.14);
}

.org-chart :deep(.org-chart-node--root) {
  border-color: rgb(var(--primary-color));
  background: linear-gradient(180deg, rgba(var(--primary-color), 0.08), rgba(var(--primary-color), 0.03)), #fff;
  box-shadow:
    0 14px 30px rgb(15 23 42 / 8%),
    inset 0 1px 0 rgb(255 255 255 / 70%);
}

.org-chart :deep(.org-chart-node--disabled) {
  background: #f8fafc;
  color: #94a3b8;
}

.org-chart :deep(.org-chart-node-title) {
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  white-space: nowrap;
}

.org-chart :deep(.org-chart-node--root .org-chart-node-title) {
  font-size: 15px;
  line-height: 22px;
}

.org-chart :deep(.org-chart-node-meta),
.org-chart :deep(.org-chart-node-count) {
  color: #64748b;
  font-size: 12px;
  line-height: 18px;
}

@media (max-width: 767px) {
  .department-stat-item {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .department-stat-value {
    text-align: left;
  }

  .health-item {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
