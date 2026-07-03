<template>
  <CommonPage title="菜单管理" class="zenith-data-page">
    <div class="resource-layout">
      <n-spin size="small" :show="treeLoading">
        <MenuTree
          v-model:current-menu="currentMenu"
          class="resource-tree"
          :tree-data="treeData"
          @refresh="handleResourceChanged"
        />
      </n-spin>

      <div class="resource-detail">
        <template v-if="currentMenu">
          <div class="mb-12 flex items-center justify-between">
            <div>
              <h3 class="mb-4 text-18 font-medium">
                {{ currentMenu.name }}
              </h3>
              <div class="text-13 text-#666">
                {{ currentMenu.code }}
              </div>
            </div>
            <NButton v-permission="'EditMenu'" size="small" type="primary" @click="handleEditMenu(currentMenu)">
              <template #icon>
                <i class="i-material-symbols:edit-outline text-14" />
              </template>
              编辑菜单
            </NButton>
          </div>

          <n-descriptions label-placement="left" bordered :column="descriptionColumn">
            <n-descriptions-item label="菜单编码">
              {{ currentMenu.code }}
            </n-descriptions-item>
            <n-descriptions-item label="菜单名称">
              {{ currentMenu.name }}
            </n-descriptions-item>
            <n-descriptions-item label="路由地址">
              {{ currentMenu.path || '--' }}
            </n-descriptions-item>
            <n-descriptions-item label="组件路径">
              {{ currentMenu.component || '--' }}
            </n-descriptions-item>
            <n-descriptions-item label="菜单图标">
              <span v-if="currentMenu.icon" class="flex items-center">
                <i :class="`${currentMenu.icon}?mask text-22 mr-8`" />
                <span class="opacity-60">{{ currentMenu.icon }}</span>
              </span>
              <span v-else>无</span>
            </n-descriptions-item>
            <n-descriptions-item label="布局">
              {{ layoutLabel(currentMenu.layout) }}
            </n-descriptions-item>
            <n-descriptions-item label="高亮菜单">
              {{ currentMenu.activeMenuCode || '--' }}
            </n-descriptions-item>
            <n-descriptions-item label="显示状态">
              <NTag size="small" :type="currentMenu.show ? 'success' : 'default'">
                {{ currentMenu.show ? '显示' : '隐藏' }}
              </NTag>
            </n-descriptions-item>
            <n-descriptions-item label="启用状态">
              <NTag size="small" :type="currentMenu.enable ? 'success' : 'error'">
                {{ currentMenu.enable ? '启用' : '停用' }}
              </NTag>
            </n-descriptions-item>
            <n-descriptions-item label="KeepAlive">
              {{ currentMenu.keepAlive ? '是' : '否' }}
            </n-descriptions-item>
            <n-descriptions-item label="排序">
              {{ currentMenu.order ?? '--' }}
            </n-descriptions-item>
          </n-descriptions>

          <div class="mb-12 mt-32 flex items-center justify-between">
            <h3 class="text-18 font-medium">
              按钮权限
            </h3>
            <NButton v-permission="'AddButton'" size="small" type="primary" @click="handleAddButton">
              <template #icon>
                <i class="i-fe:plus text-14" />
              </template>
              新增按钮
            </NButton>
          </div>

          <MeCrud
            ref="$table"
            :columns="buttonColumns"
            :remote="false"
            :scroll-x="900"
            :get-data="api.getButtons"
            :query-items="{ parentId: currentMenu.id }"
            :row-action="hasPermission('EditButton') ? handleEditButton : undefined"
            @on-data-change="buttonRows = $event"
          />

          <n-empty
            v-if="!buttonRows.length"
            class="mt-24"
            description="当前菜单暂无按钮权限，可点击新增按钮配置页面级操作权限"
          />
        </template>

        <n-empty
          v-else
          class="h-450 f-c-c"
          size="large"
          description="请选择左侧菜单查看菜单详情"
        />
      </div>
    </div>

    <ResAddOrEdit ref="modalRef" :menus="treeData" @refresh="handleResourceChanged" />
  </CommonPage>
</template>

<script setup>
import { NButton, NSwitch, NTag } from 'naive-ui'
import { MeCrud } from '@/components'
import { useResponsiveLayout } from '@/composables'
import { hasPermission, withPermission } from '@/directives'
import { usePermissionStore, useRouterStore } from '@/store'
import { getPermissions } from '@/store/helper'
import { formatDateTime } from '@/utils'
import api from './api'
import MenuTree from './components/MenuTree.vue'
import ResAddOrEdit from './components/ResAddOrEdit.vue'

const routeComponents = import.meta.glob('@/views/**/*.vue')
const permissionStore = usePermissionStore()
const routerStore = useRouterStore()
const treeData = ref([])
const treeLoading = ref(false)
const $table = ref(null)
const modalRef = ref(null)
const currentMenu = ref(null)
const buttonRows = ref([])
const { isMobile } = useResponsiveLayout()
const descriptionColumn = computed(() => (isMobile.value ? 1 : 2))

const layoutOptions = [
  { label: '跟随系统', value: '' },
  { label: '简洁 simple', value: 'simple' },
  { label: '通用 normal', value: 'normal' },
  { label: '全面 full', value: 'full' },
  { label: '空白 empty', value: 'empty' },
]

const buttonColumns = [
  { title: '按钮名称', key: 'name', minWidth: 160, ellipsis: { tooltip: true } },
  { title: '权限编码', key: 'code', minWidth: 180, ellipsis: { tooltip: true } },
  { title: '排序', key: 'order', width: 90 },
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
          onUpdateValue: () => handleEnableButton(row),
        },
        {
          checked: () => '启用',
          unchecked: () => '停用',
        },
      ), 'ToggleButton'),
  },
  {
    title: '更新时间',
    key: 'updateTime',
    width: 170,
    render(row) {
      return row.updateTime ? formatDateTime(row.updateTime) : '-'
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 190,
    align: 'right',
    fixed: 'right',
    render(row) {
      return [
        withPermission(h(
          NButton,
          {
            size: 'small',
            type: 'primary',
            onClick: () => handleEditButton(row),
          },
          {
            default: () => '编辑',
            icon: () => h('i', { class: 'i-material-symbols:edit-outline text-14' }),
          },
        ), 'EditButton'),
        withPermission(h(
          NButton,
          {
            size: 'small',
            type: 'error',
            style: 'margin-left: 12px;',
            onClick: () => handleDeleteButton(row),
          },
          {
            default: () => '删除',
            icon: () => h('i', { class: 'i-material-symbols:delete-outline text-14' }),
          },
        ), 'DeleteButton'),
      ].filter(Boolean)
    },
  },
]

initData()

watch(
  () => currentMenu.value?.id,
  async (id) => {
    await nextTick()
    if (id)
      $table.value?.handleSearch()
  },
)

async function initData(selectedId) {
  treeLoading.value = true
  try {
    const { data = [] } = await api.getMenuTree()
    treeData.value = data
    if (selectedId) {
      currentMenu.value = findMenuById(treeData.value, selectedId)
      return
    }
    if (currentMenu.value?.id) {
      currentMenu.value = findMenuById(treeData.value, currentMenu.value.id)
      return
    }
    currentMenu.value = findFirstPageMenu(treeData.value)
  }
  finally {
    treeLoading.value = false
  }
}

async function handleResourceChanged(resource) {
  if (resource?.type === 'BUTTON') {
    $table.value?.handleSearch(true)
    await refreshAccessMenus()
    return
  }
  await initData(resource?.id)
  await refreshAccessMenus()
}

function handleEditMenu(item) {
  modalRef.value?.handleOpen({
    action: 'edit',
    title: `编辑菜单 - ${item.name}`,
    row: item,
    okText: '保存',
  })
}

function handleAddButton() {
  modalRef.value?.handleOpen({
    action: 'add',
    title: '新增按钮',
    row: {
      type: 'BUTTON',
      parentId: currentMenu.value.id,
      order: 1,
    },
    okText: '保存',
  })
}

function handleEditButton(row) {
  modalRef.value?.handleOpen({
    action: 'edit',
    title: `编辑按钮 - ${row.name}`,
    row,
    okText: '保存',
  })
}

function handleDeleteButton(row) {
  const dialog = $dialog.warning({
    content: `确定删除按钮“${row.name}”？`,
    title: '提示',
    positiveText: '删除',
    negativeText: '取消',
    async onPositiveClick() {
      try {
        dialog.loading = true
        await api.deletePermission(row.id)
        $message.success('删除成功')
        $table.value?.handleSearch(true)
      }
      finally {
        dialog.loading = false
      }
    },
  })
}

async function handleEnableButton(row) {
  row.enableLoading = true
  try {
    await api.savePermission(row.id, { enable: !row.enable })
    $message.success('操作成功')
    $table.value?.handleSearch(true)
  }
  finally {
    row.enableLoading = false
  }
}

function findMenuById(nodes, id) {
  for (const node of nodes) {
    if (node.id === id)
      return node
    const child = findMenuById(node.children || [], id)
    if (child)
      return child
  }
  return null
}

function findFirstPageMenu(nodes) {
  for (const node of nodes) {
    if (node.path)
      return node
    const child = findFirstPageMenu(node.children || [])
    if (child)
      return child
  }
  return nodes[0] || null
}

function layoutLabel(value) {
  return layoutOptions.find(item => item.value === (value || ''))?.label || value
}

async function refreshAccessMenus() {
  const previousRoutes = [...permissionStore.accessRoutes]
  const permissions = await getPermissions()
  routerStore.resetRouter(previousRoutes)
  permissionStore.setPermissions(permissions)
  permissionStore.accessRoutes.forEach((route) => {
    route.component = routeComponents[route.component] || undefined
    routerStore.router.addRoute(route)
  })
}
</script>

<style scoped>
.resource-layout {
  display: flex;
  min-height: 100%;
}

.resource-tree {
  width: 320px;
  flex-shrink: 0;
}

.resource-detail {
  margin-left: 40px;
  min-width: 0;
  width: 0;
  flex: 1;
}

@media (max-width: 1023px) {
  .resource-layout {
    flex-direction: column;
    gap: 16px;
  }

  .resource-tree,
  .resource-detail {
    width: 100%;
  }

  .resource-detail {
    margin-left: 0;
  }
}
</style>
