<template>
  <div>
    <n-space vertical :size="12">
      <h3 class="text-18 font-medium">
        菜单
      </h3>
      <div class="flex">
        <n-input v-model:value="pattern" placeholder="搜索菜单" clearable />
        <NButton v-permission="'AddMenu'" class="ml-12" type="primary" @click="handleAddMenu()">
          <template #icon>
            <i class="i-material-symbols:add text-14" />
          </template>
          新增
        </NButton>
      </div>

      <n-tree
        block-line
        default-expand-all
        key-field="code"
        label-field="name"
        :data="treeData"
        :pattern="pattern"
        :selected-keys="selectedKeys"
        :show-irrelevant-nodes="false"
        :render-prefix="renderPrefix"
        :render-suffix="renderSuffix"
        :on-update:selected-keys="onSelect"
      />
    </n-space>

    <ResAddOrEdit ref="modalRef" :menus="treeData" @refresh="data => emit('refresh', data)" />
  </div>
</template>

<script setup>
import { NButton } from 'naive-ui'
import { withModifiers } from 'vue'
import { withPermission } from '@/directives'
import api from '../api'
import ResAddOrEdit from './ResAddOrEdit.vue'

const props = defineProps({
  treeData: {
    type: Array,
    default: () => [],
  },
  currentMenu: {
    type: Object,
    default: () => null,
  },
})
const emit = defineEmits(['refresh', 'update:currentMenu'])

const pattern = ref('')
const modalRef = ref(null)
const selectedKeys = computed(() => (props.currentMenu?.code ? [props.currentMenu.code] : []))

function handleAddMenu(row = {}) {
  modalRef.value?.handleOpen({
    action: 'add',
    title: row.parentId ? '新增下级菜单' : '新增菜单',
    row: {
      type: 'MENU',
      order: 1,
      ...row,
    },
    okText: '保存',
  })
}

function onSelect(_keys, _option, { action, node }) {
  emit('update:currentMenu', action === 'select' ? node : null)
}

function renderPrefix({ option }) {
  if (!option.icon)
    return null
  return h('i', { class: `${option.icon}?mask text-16` })
}

function renderSuffix({ option }) {
  const hasChildResource = Number(option.directChildCount || 0) > 0
  return [
    withPermission(h(
      NButton,
      {
        text: true,
        type: 'primary',
        title: '新增下级菜单',
        size: 'tiny',
        onClick: withModifiers(() => handleAddMenu({ parentId: option.id }), ['stop']),
      },
      { default: () => '新增下级' },
    ), 'AddMenu'),
    withPermission(h(
      NButton,
      {
        text: true,
        type: 'error',
        title: hasChildResource ? '请先删除下级菜单或按钮' : '删除菜单',
        size: 'tiny',
        style: 'margin-left: 12px;',
        disabled: hasChildResource,
        onClick: withModifiers(() => handleDeleteMenu(option), ['stop']),
      },
      { default: () => '删除' },
    ), 'DeleteMenu'),
  ].filter(Boolean)
}

function handleDeleteMenu(item) {
  $dialog.confirm({
    content: `确定删除菜单“${item.name}”？`,
    title: '提示',
    positiveText: '删除',
    async confirm() {
      try {
        $message.loading('正在删除', { key: 'deleteMenu' })
        await api.deletePermission(item.id)
        $message.success('删除成功', { key: 'deleteMenu' })
        emit('refresh')
        emit('update:currentMenu', null)
      }
      catch (error) {
        console.error(error)
        $message.destroy('deleteMenu')
      }
    },
  })
}
</script>
