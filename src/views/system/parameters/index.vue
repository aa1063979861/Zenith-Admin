<template>
  <CommonPage title="系统参数" class="zenith-data-page">
    <MeCrud
      ref="$table"
      v-model:query-items="queryItems"
      :scroll-x="1660"
      :columns="columns"
      :get-data="api.read"
      :row-action="hasPermission('EditSystemParameter') ? openEditParameter : undefined"
    >
      <template #query-actions>
        <NButton v-permission="'AddSystemParameter'" type="primary" secondary @click="openCreateParameter">
          <i class="i-fe:plus mr-4" />
          新增参数
        </NButton>
      </template>

      <MeQueryItem label="关键字" :label-width="50">
        <n-input v-model:value="queryItems.keyword" placeholder="参数键或名称" clearable />
      </MeQueryItem>
      <MeQueryItem label="状态" :label-width="50">
        <n-select
          v-model:value="queryItems.enabled"
          clearable
          :options="[
            { label: '启用', value: 1 },
            { label: '停用', value: 0 },
          ]"
        />
      </MeQueryItem>
      <MeQueryItem label="生效" :label-width="50">
        <n-select
          v-model:value="queryItems.bound"
          clearable
          :options="boundFilterOptions"
          placeholder="全部"
        />
      </MeQueryItem>
      <MeQueryItem label="分组" :label-width="50">
        <n-select
          v-model:value="queryItems.groupName"
          clearable
          filterable
          :options="groupOptions"
          placeholder="全部分组"
        />
      </MeQueryItem>
      <MeQueryItem label="类型" :label-width="50">
        <n-select
          v-model:value="queryItems.valueType"
          clearable
          :options="valueTypeOptions"
          placeholder="全部类型"
        />
      </MeQueryItem>
      <MeQueryItem label="来源" :label-width="50">
        <n-select
          v-model:value="queryItems.builtIn"
          clearable
          :options="builtInFilterOptions"
          placeholder="全部来源"
        />
      </MeQueryItem>
    </MeCrud>

    <MeModal ref="modalRef" width="820px">
      <n-form ref="modalFormRef" label-placement="left" label-align="left" :label-width="90" :model="modalForm" :rules="parameterFormRules">
        <n-form-item
          label="参数键"
          path="paramKey"
        >
          <n-input v-model:value="modalForm.paramKey" :disabled="modalAction !== 'add'" placeholder="例如：order.notice_days" />
        </n-form-item>
        <n-form-item
          label="参数名称"
          path="paramName"
        >
          <n-input v-model:value="modalForm.paramName" :disabled="isLockedParameter" />
        </n-form-item>
        <n-form-item label="参数分组" path="groupName">
          <n-input v-model:value="modalForm.groupName" :disabled="isLockedParameter" placeholder="可选" />
        </n-form-item>
        <n-form-item label="值类型" path="valueType">
          <n-select v-model:value="modalForm.valueType" :options="valueTypeOptions" :disabled="isLockedParameter" @update:value="handleValueTypeChange" />
        </n-form-item>
        <n-form-item v-if="modalForm.bound" label="生效位置">
          <n-input :value="modalForm.usageScene || '-'" disabled />
        </n-form-item>
        <n-form-item v-if="modalForm.bound" label="影响范围">
          <n-input :value="modalForm.effectiveScope || '-'" type="textarea" disabled :autosize="{ minRows: 3, maxRows: 6 }" />
        </n-form-item>
        <n-form-item
          label="参数值"
          path="paramValue"
        >
          <NSwitch v-if="modalForm.valueType === 'boolean'" v-model:value="booleanParamValue">
            <template #checked>
              true
            </template>
            <template #unchecked>
              false
            </template>
          </NSwitch>
          <n-input-number
            v-else-if="modalForm.valueType === 'number'"
            v-model:value="numberParamValue"
            class="w-full"
            :min="modalForm.minNumber"
            :max="modalForm.maxNumber"
            :precision="modalForm.integer ? 0 : undefined"
            :show-button="false"
          />
          <n-input
            v-else-if="isJsonTextParameter"
            v-model:value="modalForm.paramValue"
            type="textarea"
            :autosize="{ minRows: 4, maxRows: 8 }"
            :placeholder="paramValuePlaceholder"
          />
          <n-input
            v-else
            v-model:value="modalForm.paramValue"
            :type="modalForm.valueType === 'password' ? 'password' : 'text'"
            show-password-on="mousedown"
            :placeholder="paramValuePlaceholder"
          />
          <div v-if="parameterValueHint" class="parameter-value-hint">
            {{ parameterValueHint }}
          </div>
        </n-form-item>
        <n-form-item label="排序" path="sort">
          <n-input-number v-model:value="modalForm.sort" class="w-full" :min="1" :show-button="false" />
        </n-form-item>
        <n-form-item label="状态" path="enabled">
          <NSwitch v-model:value="modalForm.enabled" :disabled="isLockedParameter">
            <template #checked>
              启用
            </template>
            <template #unchecked>
              停用
            </template>
          </NSwitch>
        </n-form-item>
        <n-form-item label="备注" path="remark">
          <n-input v-model:value="modalForm.remark" type="textarea" placeholder="可选" />
        </n-form-item>
      </n-form>
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

defineOptions({ name: 'SystemParameters' })

const $table = ref(null)
const queryItems = ref({})
const groupOptions = ref([])

onMounted(async () => {
  await loadGroups()
  await nextTick()
  $table.value?.handleSearch(true)
})

const valueTypeOptions = [
  { label: '文本', value: 'string' },
  { label: '数字', value: 'number' },
  { label: '布尔', value: 'boolean' },
  { label: '密码', value: 'password' },
]

const builtInFilterOptions = [
  { label: '内置', value: 1 },
  { label: '自定义', value: 0 },
]

const boundFilterOptions = [
  { label: '已绑定业务', value: 1 },
  { label: '未绑定业务', value: 0 },
]

const parameterFormRules = {
  paramKey: [
    { required: true, message: '请输入参数键', trigger: ['input', 'blur'] },
    {
      trigger: ['input', 'blur'],
      validator(_rule, value) {
        if (/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/.test(String(value || '').trim()))
          return true
        return new Error('参数键必须使用小写字母、数字、下划线和点号')
      },
    },
  ],
  paramName: [
    { required: true, message: '请输入参数名称', trigger: ['input', 'blur'] },
  ],
  paramValue: [
    {
      trigger: ['input', 'blur', 'change'],
      validator() {
        const value = String(modalForm.value.paramValue ?? '').trim()
        if (modalAction.value === 'edit' && modalForm.value.valueType === 'password' && !value)
          return true
        if (!value)
          return new Error('请输入参数值')
        if (modalForm.value.valueType === 'number') {
          const numberValue = Number(value)
          if (!Number.isFinite(numberValue))
            return new Error('数字类型参数值必须是有效数字')
          if (modalForm.value.integer && !Number.isInteger(numberValue))
            return new Error(`${modalForm.value.paramName || '当前参数'}必须是整数`)
          if (modalForm.value.minNumber !== undefined && numberValue < modalForm.value.minNumber)
            return new Error(`${modalForm.value.paramName || '当前参数'}不能小于 ${modalForm.value.minNumber}`)
          if (modalForm.value.maxNumber !== undefined && numberValue > modalForm.value.maxNumber)
            return new Error(`${modalForm.value.paramName || '当前参数'}不能大于 ${modalForm.value.maxNumber}`)
        }
        return true
      },
    },
  ],
}

const {
  modalRef,
  modalFormRef,
  modalAction,
  modalForm,
  handleDelete,
  handleEdit,
  handleAdd,
} = useCrud({
  name: '参数',
  initForm: { paramKey: '', paramName: '', paramValue: '', valueType: 'string', enabled: true, sort: 1, groupName: '', remark: '' },
  doCreate: api.create,
  doDelete: api.delete,
  doUpdate: api.update,
  refresh: async (_, keepCurrentPage) => {
    await loadGroups()
    $table.value?.handleSearch(keepCurrentPage)
  },
})

const isLockedParameter = computed(() => Boolean(modalForm.value.builtIn || modalForm.value.bound))
const isJsonTextParameter = computed(() => modalForm.value.paramKey === 'kdocs.history_links')
const paramValuePlaceholder = computed(() => {
  if (modalAction.value === 'edit' && modalForm.value.valueType === 'password')
    return '留空则不修改当前密码'
  if (isJsonTextParameter.value)
    return '例如：[{"name":"2025一体化增值业务","url":"https://www.kdocs.cn/l/xxxx"}]'
  return '请输入参数值'
})

const parameterValueHint = computed(() => {
  if (modalForm.value.valueType !== 'number')
    return ''
  const hints = []
  if (modalForm.value.integer)
    hints.push('仅允许整数')
  if (modalForm.value.minNumber !== undefined)
    hints.push(`最小值 ${modalForm.value.minNumber}`)
  if (modalForm.value.maxNumber !== undefined)
    hints.push(`最大值 ${modalForm.value.maxNumber}`)
  return hints.join('，')
})

const booleanParamValue = computed({
  get() {
    return modalForm.value.paramValue === true || modalForm.value.paramValue === 'true' || modalForm.value.paramValue === '1'
  },
  set(value) {
    modalForm.value.paramValue = value ? 'true' : 'false'
  },
})

const numberParamValue = computed({
  get() {
    if (modalForm.value.paramValue === undefined || modalForm.value.paramValue === null || modalForm.value.paramValue === '')
      return null
    return Number(modalForm.value.paramValue)
  },
  set(value) {
    modalForm.value.paramValue = value === null || value === undefined ? '' : String(value)
  },
})

const columns = [
  { title: '参数名称', key: 'paramName', minWidth: 160, ellipsis: { tooltip: true } },
  { title: '参数键', key: 'paramKey', minWidth: 220, ellipsis: { tooltip: true } },
  {
    title: '参数值',
    key: 'paramValue',
    minWidth: 150,
    ellipsis: { tooltip: true },
    render(row) {
      return formatParamValue(row)
    },
  },
  {
    title: '类型',
    key: 'valueType',
    width: 90,
    render(row) {
      return valueTypeOptions.find(item => item.value === row.valueType)?.label || row.valueType
    },
  },
  { title: '分组', key: 'groupName', width: 120, render: row => row.groupName || '-' },
  {
    title: '生效状态',
    key: 'bound',
    width: 110,
    sortable: false,
    render(row) {
      return h(NTag, { type: row.bound ? 'success' : 'warning', size: 'small' }, { default: () => (row.bound ? '已绑定' : '未绑定') })
    },
  },
  {
    title: '生效位置',
    key: 'usageScene',
    minWidth: 190,
    sortable: false,
    render(row) {
      return renderWrapText(row.usageScene)
    },
  },
  {
    title: '影响范围',
    key: 'effectiveScope',
    minWidth: 260,
    sortable: false,
    render(row) {
      return renderWrapText(row.effectiveScope)
    },
  },
  {
    title: '状态',
    key: 'enabled',
    width: 90,
    render(row) {
      return h(NTag, { type: row.enabled ? 'success' : 'default', size: 'small' }, { default: () => (row.enabled ? '启用' : '停用') })
    },
  },
  {
    title: '内置',
    key: 'builtIn',
    width: 90,
    render(row) {
      return h(NTag, { type: row.builtIn ? 'info' : 'default', size: 'small' }, { default: () => (row.builtIn ? '是' : '否') })
    },
  },
  { title: '排序', key: 'sort', width: 80, sorter: 'default' },
  {
    title: '更新时间',
    key: 'updateTime',
    width: 170,
    render(row) {
      return row.updateTime ? formatDateTime(row.updateTime) : '-'
    },
  },
  { title: '备注', key: 'remark', minWidth: 180, ellipsis: { tooltip: true } },
  {
    title: '操作',
    key: 'actions',
    width: 180,
    align: 'right',
    fixed: 'right',
    render(row) {
      return [
        withPermission(h(
          NButton,
          { size: 'small', type: 'primary', secondary: true, onClick: () => openEditParameter(row) },
          { default: () => '编辑' },
        ), 'EditSystemParameter'),
        withPermission(h(
          NButton,
          {
            size: 'small',
            type: 'error',
            secondary: true,
            class: 'ml-12px',
            disabled: row.builtIn || row.bound,
            onClick: () => handleDelete(row.id),
          },
          { default: () => '删除' },
        ), 'DeleteSystemParameter'),
      ].filter(Boolean)
    },
  },
]

async function loadGroups() {
  try {
    const { data = [] } = await api.groups()
    groupOptions.value = data.map(groupName => ({ label: groupName, value: groupName }))
  }
  catch {
    groupOptions.value = []
  }
}

function handleValueTypeChange(valueType) {
  if (valueType === 'boolean') {
    modalForm.value.paramValue = 'false'
    return
  }
  if (valueType === 'number') {
    modalForm.value.paramValue = ''
    return
  }
  modalForm.value.paramValue = ''
}

function openCreateParameter() {
  handleAdd()
}

function openEditParameter(row) {
  handleEdit({
    ...row,
    paramValue: row.valueType === 'password' ? '' : String(row.paramValue ?? ''),
  })
}

function formatParamValue(row) {
  if (row.valueType === 'password')
    return '******'
  if (row.valueType === 'boolean')
    return row.paramValue === 'true' || row.paramValue === '1' ? 'true' : 'false'
  return row.paramValue || '-'
}

function renderWrapText(value) {
  return h('span', { class: 'cell-wrap-text' }, value || '-')
}
</script>

<style scoped>
.cell-wrap-text {
  display: inline-block;
  max-width: 100%;
  white-space: normal;
  word-break: break-all;
  line-height: 1.5;
}

.parameter-value-hint {
  width: 100%;
  margin-top: 6px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}
</style>
