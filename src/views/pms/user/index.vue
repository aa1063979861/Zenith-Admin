<!--------------------------------
 - @Author: Ronnie Zhang
 - @LastEditor: Ronnie Zhang
 - @LastEditTime: 2023/12/05 21:29:56
 - @Email: zclzone@outlook.com
 - Copyright © 2023 Ronnie Zhang(大脸怪) | https://isme.top
 --------------------------------->

<template>
  <CommonPage class="zenith-data-page">
    <MeCrud
      ref="$table"
      v-model:query-items="queryItems"
      :scroll-x="1120"
      :columns="columns"
      :get-data="api.read"
      :row-action="hasPermission('AssignUserRoles') ? handleOpenRolesSet : undefined"
    >
      <template #query-actions>
        <NButton v-permission="'AddUser'" type="primary" @click="openCreateUser">
          <i class="i-material-symbols:add mr-4 text-18" />
          创建员工账号
        </NButton>
      </template>

      <MeQueryItem label="关键字" :label-width="60">
        <n-input
          v-model:value="queryItems.keyword"
          type="text"
          placeholder="姓名、登录账号、显示名"
          clearable
        />
      </MeQueryItem>

      <MeQueryItem label="角色" :label-width="50">
        <n-select
          v-model:value="queryItems.roleId"
          clearable
          filterable
          :options="roles"
          label-field="name"
          value-field="id"
          placeholder="全部角色"
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

    <MeModal ref="modalRef" width="560px">
      <n-form
        ref="modalFormRef"
        label-placement="top"
        :model="modalForm"
        :disabled="modalAction === 'view'"
      >
        <template v-if="modalAction === 'add'">
          <n-grid cols="1 m:2" :x-gap="12" responsive="screen">
            <n-form-item-gi
              label="员工姓名"
              path="employeeName"
              :rule="{
                required: true,
                message: '请输入员工姓名',
                trigger: ['input', 'blur'],
              }"
            >
              <n-input v-model:value="modalForm.employeeName" placeholder="员工真实姓名" />
            </n-form-item-gi>
            <n-form-item-gi label="账号状态" path="enable">
              <NSwitch v-model:value="modalForm.enable">
                <template #checked>
                  启用
                </template>
                <template #unchecked>
                  停用
                </template>
              </NSwitch>
            </n-form-item-gi>
          </n-grid>

          <n-form-item label="角色">
            <n-select
              v-model:value="modalForm.roleIds"
              :options="roles"
              :render-option="renderRoleOption"
              label-field="name"
              value-field="id"
              clearable
              filterable
              multiple
              placeholder="请选择角色"
            />
          </n-form-item>
        </template>

        <template v-else-if="modalAction === 'setRole'">
          <n-form-item label="登录账号">
            <n-input v-model:value="modalForm.username" disabled />
          </n-form-item>
          <n-form-item label="角色" path="roleIds">
            <n-select
              v-model:value="modalForm.roleIds"
              :options="roles"
              :render-option="renderRoleOption"
              label-field="name"
              value-field="id"
              clearable
              filterable
              multiple
              placeholder="请选择角色"
            />
          </n-form-item>
        </template>
      </n-form>
    </MeModal>
  </CommonPage>
</template>

<script setup>
import { NButton, NCheckbox, NSwitch, NTag, NTooltip } from 'naive-ui'
import { MeCrud, MeModal, MeQueryItem } from '@/components'
import { useCrud } from '@/composables'
import { hasPermission, withPermission } from '@/directives'
import { formatDateTime } from '@/utils'
import { useBusinessStore } from '@/views/business/shared/useBusinessStore'
import api from './api'

defineOptions({ name: 'UserMgt' })

const $table = ref(null)
const businessStore = useBusinessStore()
/** QueryBar筛选参数（可选） */
const queryItems = ref({})
const roles = ref([])

onMounted(async () => {
  await loadRoles()
  $table.value?.handleSearch()
})

const enabledOptions = [
  { label: '启用', value: 1 },
  { label: '停用', value: 0 },
]

const {
  modalRef,
  modalFormRef,
  modalForm,
  modalAction,
  handleDelete,
  handleOpen,
  handleSave,
} = useCrud({
  name: '员工账号',
  initForm: createInitialForm(),
  doCreate: api.create,
  doDelete: api.delete,
  doUpdate: api.update,
  refresh: async () => {
    $table.value?.handleSearch(true)
    await businessStore.loadEmployees()
  },
})

const columns = [
  { title: '员工姓名', key: 'employeeName', width: 130, ellipsis: { tooltip: true } },
  { title: '登录账号', key: 'username', width: 140, ellipsis: { tooltip: true } },
  {
    title: '角色',
    key: 'roles',
    minWidth: 220,
    sortable: false,
    ellipsis: { tooltip: true },
    render: ({ roles }) => {
      if (roles?.length) {
        const visibleRoles = roles.slice(0, 2)
        const hiddenRoles = roles.slice(2)
        return [
          ...visibleRoles.map((item, index) =>
            h(
              NTag,
              { type: 'success', style: index > 0 ? 'margin-left: 8px;' : '' },
              { default: () => item.name },
            ),
          ),
          hiddenRoles.length
            ? h(
                NTooltip,
                { trigger: 'hover' },
                {
                  trigger: () =>
                    h(
                      NTag,
                      { type: 'default', style: 'margin-left: 8px;' },
                      { default: () => `+${hiddenRoles.length}` },
                    ),
                  default: () => hiddenRoles.map(item => item.name).join('、'),
                },
              )
            : null,
        ].filter(Boolean)
      }
      return '暂无角色'
    },
  },
  {
    title: '创建时间',
    key: 'createDate',
    width: 180,
    render(row) {
      return h('span', formatDateTime(row.createTime))
    },
  },
  {
    title: '状态',
    key: 'enable',
    width: 120,
    render: row =>
      withPermission(h(
        NSwitch,
        {
          size: 'small',
          rubberBand: false,
          value: row.enable,
          loading: !!row.enableLoading,
          onUpdateValue: () => handleEnable(row),
        },
        {
          checked: () => '启用',
          unchecked: () => '停用',
        },
      ), 'ToggleUser'),
  },
  {
    title: '操作',
    key: 'actions',
    width: 360,
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
            onClick: () => handleOpenRolesSet(row),
          },
          {
            default: () => '分配角色',
            icon: () => h('i', { class: 'i-carbon:user-role text-14' }),
          },
        ), 'AssignUserRoles'),
        withPermission(h(
          NButton,
          {
            size: 'small',
            secondary: true,
            style: 'margin-left: 12px;',
            loading: !!row.resetLoading,
            disabled: !!row.resetLoading,
            onClick: () => handleResetPassword(row),
          },
          {
            default: () => '重置密码',
            icon: () => h('i', { class: 'i-radix-icons:reset text-14' }),
          },
        ), 'ResetUserPassword'),
        withPermission(h(
          NButton,
          {
            size: 'small',
            type: 'error',
            style: 'margin-left: 12px;',
            onClick: () => handleDelete(row.id, {
              title: '删除员工账号',
              content: `确认删除员工账号「${row.employeeName || row.username}」？删除后该员工不能再登录系统。`,
            }),
          },
          {
            default: () => '删除',
            icon: () => h('i', { class: 'i-material-symbols:delete-outline text-14' }),
          },
        ), 'DeleteUser'),
      ].filter(Boolean)
    },
  },
]
function createInitialForm() {
  return {
    enable: true,
    employeeName: '',
    roleIds: [],
  }
}

async function loadRoles() {
  const { data = [] } = await api.getAllRoles()
  roles.value = data
}

function renderRoleOption({ node, option, selected }) {
  return h('div', node.props, [
    h('div', { class: 'n-base-select-option__content', style: 'display: flex; align-items: center; gap: 8px;' }, [
      h(NCheckbox, {
        checked: selected,
        focusable: false,
        style: 'pointer-events: none;',
      }),
      h('span', option.name || option.label),
    ]),
  ])
}

function openCreateUser() {
  handleOpen({
    action: 'add',
    title: '创建员工账号',
    row: createInitialForm(),
    onOk: onSave,
  })
}

async function handleEnable(row) {
  row.enableLoading = true
  try {
    await api.update({ id: row.id, enable: !row.enable })
    row.enableLoading = false
    $message.success('操作成功')
    $table.value?.handleSearch(true)
  }
  catch (error) {
    console.error(error)
    row.enableLoading = false
  }
}

async function handleResetPassword(row) {
  row.resetLoading = true
  try {
    await api.resetPwd(row.id)
    $message.success('密码已重置为初始密码')
  }
  catch (error) {
    console.error(error)
  }
  finally {
    row.resetLoading = false
  }
}

function handleOpenRolesSet(row) {
  const roleIds = row.roles.map(item => item.id)
  handleOpen({
    action: 'setRole',
    title: '分配角色',
    row: { id: row.id, username: row.username, roleIds },
    onOk: onSave,
  })
}

function onSave() {
  if (modalAction.value === 'setRole') {
    return handleSave({
      api: () => api.update(modalForm.value),
      cb: () => $message.success('分配成功'),
    })
  }
  return handleSave()
}
</script>
