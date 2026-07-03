<template>
  <div class="role-user-panel">
    <div class="role-user-filter zenith-filter-bar" data-filter-collapsed-rows="all">
      <n-input
        v-model:value="filters.keyword"
        class="role-user-search"
        placeholder="搜索员工姓名、部门、职位"
        clearable
      >
        <template #prefix>
          <i class="i-fe:search" />
        </template>
      </n-input>

      <n-select
        v-model:value="filters.enable"
        class="role-user-status"
        clearable
        :options="enabledOptions"
        placeholder="全部状态"
      />

      <n-radio-group v-model:value="filters.authorized" size="small">
        <n-radio-button value="all">
          全部
        </n-radio-button>
        <n-radio-button value="authorized">
          已授权
        </n-radio-button>
        <n-radio-button value="unauthorized">
          未授权
        </n-radio-button>
      </n-radio-group>

      <div class="role-user-actions">
        <NButton v-permission="'RemoveRoleUser'" :disabled="!canBatchRemove" type="error" secondary @click="handleBatchRemove()">
          <i class="i-material-symbols:delete-outline mr-4 text-18" />
          取消授权
        </NButton>
        <NButton
          v-permission="'AddRoleUser'"
          :disabled="!canBatchAdd"
          type="primary"
          @click="handleBatchAdd()"
        >
          <i class="i-line-md:confirm-circle mr-4 text-18" />
          授权
        </NButton>
      </div>
    </div>

    <EnhancedDataTable
      storage-key="pms.role.users"
      class="role-user-table"
      size="small"
      :loading="loading"
      :columns="columns"
      :data="filteredRows"
      :pagination="pagination"
      :checked-row-keys="selectedUserIds"
      :min-scroll-x="1040"
      mobile-primary-key="employeeName"
      mobile-status-key="authorized"
      :mobile-secondary-keys="['departmentName', 'positionName', 'roles']"
      @update:checked-row-keys="onChecked"
      @update:page="onPageChange"
      @update:page-size="onPageSizeChange"
    />
  </div>
</template>

<script setup>
import { NButton, NTag } from 'naive-ui'
import { EnhancedDataTable } from '@/components/common'
import { withPermission } from '@/directives'
import { ALL_PAGE_SIZE, createTablePagination, DEFAULT_PAGE_SIZE, enhanceTableColumns } from '@/utils'
import api from '../api'

const props = defineProps({
  roleId: {
    type: Number,
    required: true,
  },
  roleName: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['changed'])

const allRows = ref([])
const loading = ref(false)
const selectedUserIds = ref([])
const filters = reactive({
  keyword: '',
  enable: null,
  authorized: 'all',
})
const pagination = reactive(createTablePagination({
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  itemCount: 0,
}))

const enabledOptions = [
  { label: '启用', value: 1 },
  { label: '停用', value: 0 },
]

const filteredRows = computed(() => {
  const keyword = filters.keyword.trim().toLowerCase()
  return allRows.value.filter((row) => {
    if (filters.enable !== null && Number(row.enable) !== Number(filters.enable))
      return false
    if (filters.authorized === 'authorized' && !isAuthorized(row))
      return false
    if (filters.authorized === 'unauthorized' && isAuthorized(row))
      return false
    if (!keyword)
      return true
    return getSearchTexts(row).some(text => text.toLowerCase().includes(keyword))
  })
})
const selectedRows = computed(() => allRows.value.filter(row => selectedUserIds.value.includes(row.id)))
const canBatchAdd = computed(() => selectedRows.value.some(row => row.enable && !isAuthorized(row)))
const canBatchRemove = computed(() => selectedRows.value.some(row => isAuthorized(row)))

const columns = enhanceTableColumns([
  {
    title: '员工',
    key: 'employeeName',
    minWidth: 180,
    render(row) {
      return h('span', { class: 'role-user-name' }, getEmployeeName(row))
    },
  },
  { title: '部门', key: 'departmentName', width: 140, ellipsis: { tooltip: true }, render: row => row.departmentName || '未设置' },
  { title: '职位', key: 'positionName', width: 150, ellipsis: { tooltip: true }, render: row => row.positionName || '未设置' },
  {
    title: '授权状态',
    key: 'authorized',
    width: 120,
    sortable: false,
    render: row =>
      h(
        NTag,
        { size: 'small', type: isAuthorized(row) ? 'success' : 'default', bordered: false },
        { default: () => isAuthorized(row) ? '已授权' : '未授权' },
      ),
  },
  {
    title: '已有角色',
    key: 'roles',
    minWidth: 220,
    sortable: false,
    ellipsis: { tooltip: true },
    render: ({ roles }) => {
      if (roles.length) {
        return roles.map((item, index) =>
          h(
            NTag,
            { size: 'small', type: item.id === props.roleId ? 'success' : 'default', style: index > 0 ? 'margin-left: 8px;' : '' },
            { default: () => item.name },
          ),
        )
      }
      return '暂无角色'
    },
  },
  {
    title: '状态',
    key: 'enable',
    width: 100,
    render: row =>
      h(
        NTag,
        { size: 'small', type: row.enable ? 'success' : 'error', bordered: false },
        { default: () => row.enable ? '启用' : '停用' },
      ),
  },
  {
    title: '操作',
    key: 'actions',
    width: 132,
    align: 'right',
    fixed: 'right',
    hideInExcel: true,
    render(row) {
      return isAuthorized(row)
        ? withPermission(h(
            NButton,
            {
              size: 'small',
              type: 'error',
              secondary: true,
              onClick: () => handleBatchRemove([row.id]),
            },
            {
              default: () => '取消授权',
              icon: () => h('i', { class: 'i-material-symbols:delete-outline text-14' }),
            },
          ), 'RemoveRoleUser')
        : withPermission(h(
            NButton,
            {
              size: 'small',
              type: 'primary',
              secondary: true,
              disabled: !row.enable,
              onClick: () => handleBatchAdd([row.id]),
            },
            {
              default: () => '授权',
              icon: () => h('i', { class: 'i-line-md:confirm-circle text-14' }),
            },
          ), 'AddRoleUser')
    },
  },
], { selection: true, index: true })

onMounted(() => {
  loadUsers()
})

watch(() => props.roleId, () => {
  loadUsers()
})

watch(filteredRows, (rows) => {
  pagination.itemCount = rows.length
  const maxPage = Math.max(1, Math.ceil(rows.length / pagination.pageSize))
  if (pagination.page > maxPage)
    pagination.page = maxPage
}, { immediate: true })

watch(filters, () => {
  pagination.page = 1
  selectedUserIds.value = []
})

async function loadUsers() {
  loading.value = true
  try {
    // ponytail: 授权窗口一次加载员工池；员工规模很大时再加后端授权状态筛选。
    const { data } = await api.getAllUsers({ pageNo: 1, pageSize: ALL_PAGE_SIZE })
    allRows.value = data.pageData
    selectedUserIds.value = []
  }
  finally {
    loading.value = false
  }
}

function onChecked(rowKeys) {
  selectedUserIds.value = rowKeys || []
}

function onPageChange(page) {
  pagination.page = page
}

function onPageSizeChange(pageSize) {
  pagination.pageSize = pageSize
  pagination.page = 1
}

function isAuthorized(row) {
  return row.roles.some(item => item.id === props.roleId)
}

function getEmployeeName(row) {
  return row.employeeName || row.nickName || '未设置姓名'
}

function getSearchTexts(row) {
  return [
    getEmployeeName(row),
    row.departmentName || '',
    row.positionName || '',
    ...row.roles.map(role => role.name),
  ]
}

function resolveRowsByIds(ids, predicate) {
  return allRows.value
    .filter(row => ids.includes(row.id))
    .filter(predicate)
}

function formatEmployeeNames(rows) {
  return rows.map(getEmployeeName).join('、')
}

function handleBatchAdd(ids = selectedUserIds.value) {
  const targetRows = resolveRowsByIds(ids, row => row.enable && !isAuthorized(row))
  if (!targetRows.length)
    return $message.error('请选择未授权且已启用的员工')

  $dialog.confirm({
    title: '授权用户',
    content: `确认将「${props.roleName}」授权给：${formatEmployeeNames(targetRows)}？`,
    async confirm() {
      await api.addRoleUsers(props.roleId, { userIds: targetRows.map(row => row.id) })
      $message.success('授权成功')
      await loadUsers()
      emit('changed')
    },
  })
}

function handleBatchRemove(ids = selectedUserIds.value) {
  const targetRows = resolveRowsByIds(ids, row => isAuthorized(row))
  if (!targetRows.length)
    return $message.error('请选择已授权员工')

  $dialog.confirm({
    title: '取消授权',
    content: `确认取消以下员工的「${props.roleName}」角色：${formatEmployeeNames(targetRows)}？`,
    async confirm() {
      await api.removeRoleUsers(props.roleId, { userIds: targetRows.map(row => row.id) })
      $message.success('取消授权成功')
      await loadUsers()
      emit('changed')
    },
  })
}

defineExpose({
  refresh: loadUsers,
})
</script>

<style scoped>
.role-user-panel {
  display: flex;
  min-width: 0;
  min-height: 0;
  height: 100%;
  flex-direction: column;
  gap: 12px;
}

.role-user-actions {
  display: flex;
  margin-left: auto;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.role-user-filter {
  display: flex;
  min-width: 0;
  flex-shrink: 0;
  align-items: center;
  gap: 10px;
}

.role-user-search {
  width: min(360px, 44vw);
}

.role-user-status {
  width: 150px;
}

.role-user-table {
  min-height: 0;
  flex: 1 1 auto;
}

.role-user-name {
  min-width: 0;
  overflow: hidden;
  color: #0f172a;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 900px) {
  .role-user-filter {
    align-items: stretch;
    flex-direction: column;
  }

  .role-user-actions {
    margin-left: 0;
    justify-content: flex-start;
  }

  .role-user-search,
  .role-user-status {
    width: 100%;
  }
}
</style>
