<template>
  <CommonPage class="zenith-data-page">
    <MeCrud
      ref="$table"
      v-model:query-items="queryItems"
      :scroll-x="1480"
      :columns="columns"
      :get-data="api.read"
      :row-action="hasPermission('EditRole') ? openEditRole : undefined"
      :row-action-disabled="row => row.builtIn"
    >
      <template #query-actions>
        <NButton v-permission="'AddRole'" type="primary" @click="openCreateRole">
          <i class="i-material-symbols:add mr-4 text-18" />
          新增角色
        </NButton>
      </template>

      <MeQueryItem label="关键字" :label-width="60">
        <n-input
          v-model:value="queryItems.keyword"
          type="text"
          placeholder="角色名称"
          clearable
        />
      </MeQueryItem>
      <MeQueryItem label="状态" :label-width="50">
        <n-select
          v-model:value="queryItems.enable"
          clearable
          :options="enabledOptions"
          placeholder="全部状态"
        />
      </MeQueryItem>
    </MeCrud>

    <MeModal ref="modalRef" width="780px">
      <n-form
        ref="modalFormRef"
        label-placement="top"
        :model="modalForm"
      >
        <n-grid cols="1 m:2" :x-gap="12" responsive="screen">
          <n-form-item-gi
            label="角色名称"
            path="name"
            :rule="{
              required: true,
              message: '请输入角色名称',
              trigger: ['input', 'blur'],
            }"
          >
            <n-input v-model:value="modalForm.name" placeholder="例如：业务人员" />
          </n-form-item-gi>
          <n-form-item-gi label="状态" path="enable">
            <NSwitch v-model:value="modalForm.enable" :disabled="!!modalForm.builtIn">
              <template #checked>
                启用
              </template>
              <template #unchecked>
                停用
              </template>
            </NSwitch>
          </n-form-item-gi>
        </n-grid>

        <n-form-item label="菜单权限" path="permissionIds">
          <n-spin :show="permissionLoading" class="w-full">
            <n-tree
              key-field="id"
              label-field="name"
              :selectable="false"
              :data="permissionTree"
              :checked-keys="modalForm.permissionIds"
              checkable
              check-on-click
              cascade
              default-expand-all
              class="role-permission-tree cus-scroll w-full"
              @update:checked-keys="handlePermissionChecked"
            />
          </n-spin>
        </n-form-item>
      </n-form>
    </MeModal>

    <MeModal ref="roleUserModalRef" width="min(1280px, 92vw)" :show-footer="false">
      <div class="h-70vh">
        <RoleUserTable
          v-if="currentRoleForUsers"
          :role-id="currentRoleForUsers.id"
          :role-name="currentRoleForUsers.name"
          @changed="refreshRoleList"
        />
      </div>
    </MeModal>
  </CommonPage>
</template>

<script setup>
import { NButton, NSwitch, NTag } from 'naive-ui'
import { MeCrud, MeModal, MeQueryItem } from '@/components'
import { useCrud } from '@/composables'
import { hasPermission, withPermission } from '@/directives'
import { formatDateTime } from '@/utils'
import api from './api'
import RoleUserTable from './components/RoleUserTable.vue'

defineOptions({ name: 'RoleMgt' })

const route = useRoute()
const $table = ref(null)
const queryItems = ref({})
const permissionTree = ref([])
const permissionLoading = ref(false)
const roleUserModalRef = ref(null)
const currentRoleForUsers = ref(null)
const currentButtonCodes = computed(() => (route.meta?.btns || []).map(item => item.code))

const enabledOptions = [
  { label: '启用', value: 1 },
  { label: '停用', value: 0 },
]

const {
  modalRef,
  modalFormRef,
  modalAction,
  modalForm,
  handleDelete,
  handleOpen,
  handleSave,
} = useCrud({
  name: '角色',
  doCreate: api.create,
  doDelete: api.delete,
  doUpdate: api.update,
  initForm: createInitialForm(),
  refresh: (_, keepCurrentPage) => $table.value?.handleSearch(keepCurrentPage),
})
const columns = [
  {
    title: '角色',
    key: 'name',
    minWidth: 260,
    render(row) {
      return h('div', { class: 'role-name-cell' }, [
        h('div', { class: 'role-name-line' }, [
          h('span', { class: 'role-name-text' }, row.name),
          row.builtIn
            ? h(NTag, { size: 'small', type: 'info', bordered: false }, { default: () => '内置' })
            : null,
        ]),
      ])
    },
  },
  { title: '菜单权限', key: 'permissionCount', width: 110, sortable: false, align: 'center', render: row => row.permissionCount ?? 0 },
  { title: '授权员工', key: 'userCount', width: 110, sortable: false, align: 'center', render: row => row.userCount ?? 0 },
  {
    title: '创建时间',
    key: 'createTime',
    width: 180,
    render: row => h('span', formatDateTime(row.createTime)),
  },
  {
    title: '状态',
    key: 'enable',
    width: 120,
    render: (row) => {
      if (!hasButtonPermission('ToggleRole')) {
        return h(
          NTag,
          { size: 'small', type: row.enable ? 'success' : 'error' },
          { default: () => row.enable ? '启用' : '停用' },
        )
      }
      return h(
        NSwitch,
        {
          size: 'small',
          rubberBand: false,
          value: row.enable,
          loading: !!row.enableLoading,
          disabled: row.builtIn,
          onUpdateValue: () => handleEnable(row),
        },
        {
          checked: () => '启用',
          unchecked: () => '停用',
        },
      )
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 320,
    align: 'right',
    fixed: 'right',
    hideInExcel: true,
    render(row) {
      return [
        withPermission(h(
          NButton,
          {
            size: 'small',
            type: 'primary',
            secondary: true,
            disabled: row.builtIn,
            onClick: () => openRoleUsers(row),
          },
          {
            default: () => '员工授权',
            icon: () => h('i', { class: 'i-fe:user-plus text-14' }),
          },
        ), 'AssignRoleUsers'),
        withPermission(h(
          NButton,
          {
            size: 'small',
            type: 'primary',
            style: 'margin-left: 12px;',
            disabled: row.builtIn,
            onClick: () => openEditRole(row),
          },
          {
            default: () => '编辑',
            icon: () => h('i', { class: 'i-material-symbols:edit-outline text-14' }),
          },
        ), 'EditRole'),
        withPermission(h(
          NButton,
          {
            size: 'small',
            type: 'error',
            style: 'margin-left: 12px;',
            disabled: row.builtIn || row.userCount > 0,
            onClick: () => handleDelete(row.id, {
              title: '删除角色',
              content: `确认删除角色「${row.name}」？`,
            }),
          },
          {
            default: () => '删除',
            icon: () => h('i', { class: 'i-material-symbols:delete-outline text-14' }),
          },
        ), 'DeleteRole'),
      ].filter(Boolean)
    },
  },
]

onMounted(async () => {
  await loadPermissionTree()
  $table.value?.handleSearch()
})

function createInitialForm() {
  return {
    name: '',
    enable: true,
    permissionIds: [],
  }
}

async function loadPermissionTree() {
  permissionLoading.value = true
  try {
    const { data = [] } = await api.getAllPermissionTree()
    permissionTree.value = data
  }
  finally {
    permissionLoading.value = false
  }
}

function openCreateRole() {
  handleOpen({
    action: 'add',
    title: '新增角色',
    row: createInitialForm(),
    onOk: onSaveRole,
  })
}

function openEditRole(row) {
  handleOpen({
    action: 'edit',
    title: `编辑角色 - ${row.name}`,
    row: {
      ...row,
      permissionIds: row.permissionIds || [],
    },
    onOk: onSaveRole,
  })
}

function openRoleUsers(row) {
  currentRoleForUsers.value = { id: row.id, name: row.name }
  roleUserModalRef.value?.open({ title: '员工授权' })
}

function handlePermissionChecked(keys) {
  modalForm.value.permissionIds = keys
}

function hasButtonPermission(code) {
  return currentButtonCodes.value.includes(code)
}

async function onSaveRole() {
  const payload = {
    id: modalForm.value.id,
    name: modalForm.value.name,
    enable: modalForm.value.enable,
    permissionIds: modalForm.value.permissionIds || [],
  }
  return handleSave({
    api: () => modalAction.value === 'add' ? api.create(payload) : api.update(payload),
    cb: () => $message.success(modalAction.value === 'add' ? '新增成功' : '保存成功'),
  })
}

async function handleEnable(row) {
  row.enableLoading = true
  try {
    await api.update({ id: row.id, enable: !row.enable })
    $message.success('操作成功')
    $table.value?.handleSearch(true)
  }
  finally {
    row.enableLoading = false
  }
}

function refreshRoleList() {
  $table.value?.handleSearch(true)
}
</script>

<style scoped>
.role-permission-tree {
  max-height: 360px;
  overflow: auto;
  border: 1px solid rgb(224 224 230);
  border-radius: 6px;
  padding: 12px;
}

.role-name-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.role-name-line {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.role-name-text {
  min-width: 0;
  overflow: hidden;
  color: #0f172a;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
