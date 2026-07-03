<template>
  <MeModal ref="modalRef" width="760px">
    <n-form
      ref="modalFormRef"
      label-placement="left"
      require-mark-placement="left"
      :label-width="100"
      :model="modalForm"
    >
      <n-grid :cols="24" :x-gap="24">
        <n-form-item-gi :span="12" label="菜单类型">
          <n-tag :type="modalForm.type === 'MENU' ? 'primary' : 'success'">
            {{ modalForm.type === 'MENU' ? '菜单' : '按钮' }}
          </n-tag>
        </n-form-item-gi>

        <n-form-item-gi :span="12" label="所属菜单" path="parentId" :rule="parentRule">
          <n-tree-select
            v-model:value="modalForm.parentId"
            :options="menuOptions"
            :disabled="parentSelectDisabled"
            label-field="name"
            key-field="id"
            placeholder="根菜单"
            clearable
          />
        </n-form-item-gi>

        <n-form-item-gi :span="12" path="name" :rule="required">
          <template #label>
            <QuestionLabel label="名称" content="菜单或按钮在界面上的显示名称" />
          </template>
          <n-input v-model:value="modalForm.name" placeholder="请输入名称" />
        </n-form-item-gi>

        <n-form-item-gi :span="12" path="code" :rule="required">
          <template #label>
            <QuestionLabel label="编码" content="菜单编码对应前端路由 name，建议使用大驼峰" />
          </template>
          <n-input v-model:value="modalForm.code" placeholder="请输入唯一编码" />
        </n-form-item-gi>

        <template v-if="modalForm.type === 'MENU'">
          <n-form-item-gi :span="12" path="path" :rule="pathRule">
            <template #label>
              <QuestionLabel label="路由地址" content="父级菜单可不填；页面菜单以 /、http:// 或 https:// 开头" />
            </template>
            <n-input v-model:value="modalForm.path" placeholder="/example" />
          </n-form-item-gi>

          <n-form-item-gi v-if="isHiddenRoute" :span="12" path="activeMenuCode" :rule="activeMenuRule">
            <template #label>
              <QuestionLabel label="高亮菜单" content="隐藏路由进入后在侧边栏保持选中的可见菜单" />
            </template>
            <n-tree-select
              v-model:value="modalForm.activeMenuCode"
              :options="activeMenuOptions"
              label-field="name"
              key-field="code"
              clearable
              placeholder="请选择可见菜单"
            />
          </n-form-item-gi>

          <n-form-item-gi :span="12" path="icon">
            <template #label>
              <QuestionLabel label="菜单图标" content="例如 i-fe:grid，可从 Iconify 图标库选择" />
            </template>
            <n-select v-model:value="modalForm.icon" :options="iconOptions" clearable filterable />
          </n-form-item-gi>

          <n-form-item-gi :span="12" path="layout">
            <template #label>
              <QuestionLabel label="布局" content="对应 layouts 目录下的布局名称；为空时跟随系统默认布局" />
            </template>
            <n-select v-model:value="modalForm.layout" :options="layoutOptions" clearable />
          </n-form-item-gi>

          <n-form-item-gi :span="12" path="show">
            <template #label>
              <QuestionLabel label="显示状态" content="控制是否在菜单栏显示，不影响路由注册" />
            </template>
            <n-switch v-model:value="modalForm.show">
              <template #checked>
                显示
              </template>
              <template #unchecked>
                隐藏
              </template>
            </n-switch>
          </n-form-item-gi>

          <n-form-item-gi :span="24" path="component">
            <template #label>
              <QuestionLabel label="组件路径" content="前端组件路径，以 /src 开头；父级菜单可不填" />
            </template>
            <n-select
              v-model:value="modalForm.component"
              :options="componentOptions"
              clearable
              filterable
              tag
              placeholder="/src/views/example/index.vue"
            />
          </n-form-item-gi>
        </template>

        <n-form-item-gi :span="12" path="enable">
          <template #label>
            <QuestionLabel label="启用状态" content="停用菜单后不会加入动态路由，普通角色无法进入页面" />
          </template>
          <n-switch v-model:value="modalForm.enable">
            <template #checked>
              启用
            </template>
            <template #unchecked>
              停用
            </template>
          </n-switch>
        </n-form-item-gi>

        <n-form-item-gi v-if="modalForm.type === 'MENU'" :span="12" path="keepAlive">
          <template #label>
            <QuestionLabel label="KeepAlive" content="启用后组件 name 需与当前菜单编码保持一致" />
          </template>
          <n-switch v-model:value="modalForm.keepAlive">
            <template #checked>
              是
            </template>
            <template #unchecked>
              否
            </template>
          </n-switch>
        </n-form-item-gi>

        <n-form-item-gi :span="12" label="排序" path="order" :rule="orderRule">
          <n-input-number v-model:value="modalForm.order" class="w-full" :min="1" :precision="0" />
        </n-form-item-gi>
      </n-grid>
    </n-form>
  </MeModal>
</template>

<script setup>
import icons from 'isme:icons'
import pagePathes from 'isme:page-pathes'
import { MeModal } from '@/components'
import { useForm, useModal } from '@/composables'
import api from '../api'
import QuestionLabel from './QuestionLabel.vue'

const props = defineProps({
  menus: {
    type: Array,
    required: true,
  },
})
const emit = defineEmits(['refresh'])

const defaultForm = {
  type: 'MENU',
  enable: true,
  show: true,
  keepAlive: false,
  layout: '',
  order: 1,
}
const [modalFormRef, modalForm, validation] = useForm()
const [modalRef, okLoading] = useModal()
const modalAction = ref('')
const parentIdDisabled = ref(false)

const menuOptions = computed(() => {
  return [{ name: '根菜单', id: '', children: cloneMenuOptions(props.menus, modalForm.value?.id) }]
})
const componentOptions = pagePathes.map(path => ({ label: path, value: path }))
const iconOptions = icons.map(item => ({
  label: () =>
    h('span', { class: 'flex items-center' }, [h('i', { class: `${item} text-18 mr-8` }), item]),
  value: item,
}))
const layoutOptions = [
  { label: '跟随系统', value: '' },
  { label: '简洁 simple', value: 'simple' },
  { label: '通用 normal', value: 'normal' },
  { label: '全面 full', value: 'full' },
  { label: '空白 empty', value: 'empty' },
]
const required = {
  required: true,
  message: '此为必填项',
  trigger: ['blur', 'change'],
}
const parentRule = computed(() => ({
  required: modalForm.value?.type === 'BUTTON',
  message: '按钮必须选择所属菜单',
  trigger: ['blur', 'change'],
}))
const activeMenuRule = computed(() => ({
  required: modalForm.value?.type === 'MENU' && modalForm.value?.show === false && !!modalForm.value?.path,
  message: '隐藏路由必须选择高亮菜单',
  trigger: ['blur', 'change'],
}))
const pathRule = {
  trigger: ['blur', 'change'],
  type: 'string',
  message: '必须以 /、http:// 或 https:// 开头',
  validator(_rule, value) {
    if (!value)
      return true
    return value.startsWith('/') || value.startsWith('http://') || value.startsWith('https://')
  },
}
const orderRule = {
  type: 'number',
  required: true,
  message: '此为必填项',
  trigger: ['blur', 'change'],
}
const isHiddenRoute = computed(() => modalForm.value?.type === 'MENU' && modalForm.value?.show === false && !!modalForm.value?.path)
const parentSelectDisabled = computed(() => parentIdDisabled.value || isHiddenRoute.value)
const activeMenuOptions = computed(() => cloneActiveMenuOptions(props.menus, modalForm.value?.id))

watch(isHiddenRoute, (hiddenRoute) => {
  if (hiddenRoute)
    modalForm.value.parentId = null
})

watch(
  () => modalForm.value?.show,
  (show) => {
    if (show)
      modalForm.value.activeMenuCode = null
  },
)

function handleOpen(options = {}) {
  const { action, row = {}, ...rest } = options
  modalAction.value = action
  modalForm.value = { ...defaultForm, ...row }
  parentIdDisabled.value = modalForm.value.type === 'BUTTON'
  modalRef.value.open({ ...rest, onOk: onSave })
}

async function onSave() {
  await validation()
  okLoading.value = true
  try {
    const payload = buildPayload(modalForm.value)
    let savedResource = payload
    if (modalAction.value === 'add') {
      const { data } = await api.addPermission(payload)
      savedResource = data
    }
    else if (modalAction.value === 'edit') {
      const { data } = await api.savePermission(modalForm.value.id, payload)
      savedResource = data
    }
    $message.success('保存成功')
    emit('refresh', savedResource)
  }
  catch (error) {
    console.error(error)
    return false
  }
  finally {
    okLoading.value = false
  }
}

function buildPayload(form) {
  const parentId = isHiddenRoute.value || form.parentId === '' || form.parentId === undefined ? null : form.parentId
  const payload = {
    code: form.code,
    name: form.name,
    type: form.type,
    parentId,
    enable: form.enable,
    order: form.order,
  }
  if (form.type === 'MENU') {
    Object.assign(payload, {
      path: form.path || null,
      component: form.component || null,
      icon: form.icon || null,
      layout: form.layout || null,
      activeMenuCode: isHiddenRoute.value ? form.activeMenuCode || null : null,
      show: form.show,
      keepAlive: form.keepAlive,
    })
  }
  return payload
}

function cloneMenuOptions(nodes, excludedId) {
  return (nodes || [])
    .filter(node => node.id !== excludedId)
    .map(node => ({
      ...node,
      children: cloneMenuOptions(node.children || [], excludedId),
    }))
}

function cloneActiveMenuOptions(nodes, excludedId) {
  return (nodes || [])
    .filter(node => node.id !== excludedId && node.show && node.enable)
    .map(node => ({
      ...node,
      children: cloneActiveMenuOptions(node.children || [], excludedId),
    }))
}

defineExpose({
  handleOpen,
})
</script>
