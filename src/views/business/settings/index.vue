<template>
  <CommonPage title="基础设置" class="settings-page zenith-data-page">
    <div class="settings-workbench">
      <aside class="settings-tree" aria-label="设置分类">
        <n-tree
          block-line
          class="settings-category-tree"
          :data="settingTreeData"
          :selected-keys="selectedSettingKeys"
          :on-update:selected-keys="handleSettingTreeSelect"
        />
      </aside>

      <section class="settings-main">
        <n-form class="settings-filter-bar zenith-filter-bar" data-filter-collapsed-rows="all" inline label-placement="left" :show-feedback="false">
          <n-form-item label="关键字">
            <n-input v-model:value="configFilters.keyword" clearable :placeholder="keywordPlaceholder" />
          </n-form-item>
          <n-form-item label="状态">
            <n-select v-model:value="configFilters.enabled" clearable :options="enabledFilterOptions" placeholder="全部状态" />
          </n-form-item>
          <n-form-item v-if="activeSettingKey === 'service'" label="类别">
            <n-select v-model:value="configFilters.category" clearable :options="serviceCategoryOptions" placeholder="全部类别" />
          </n-form-item>
          <n-form-item v-if="activeSettingKey === 'announcement'" label="类型">
            <n-select v-model:value="configFilters.type" clearable :options="announcementTypeOptions" placeholder="全部类型" />
          </n-form-item>
          <n-form-item class="zenith-filter-actions">
            <n-space>
              <NButton secondary @click="resetConfigFilters">
                <i class="i-fe:rotate-ccw mr-4" />
                重置
              </NButton>

              <template v-if="activeSettingKey === 'dictionary'">
                <NButton v-permission="'AddDictionaryItem'" type="primary" secondary :disabled="!selectedDefinition" @click="openCreateItemForm(selectedDefinitionType)">
                  <i class="i-fe:plus mr-4" />
                  新增项
                </NButton>
                <NButton v-permission="'ExportDictionary'" secondary @click="exportDictionaryDefinitions">
                  <i class="i-fe:download mr-4" />
                  导出
                </NButton>
              </template>
              <NButton v-else-if="activeSettingKey === 'service'" v-permission="'AddServiceCatalog'" type="primary" secondary @click="openCreateServiceForm">
                <i class="i-fe:plus mr-4" />
                新增
              </NButton>
              <NButton v-else type="primary" secondary @click="openCreateAnnouncementForm">
                <i class="i-fe:plus mr-4" />
                新增公告
              </NButton>
            </n-space>
          </n-form-item>
        </n-form>

        <section class="settings-table-shell">
          <EnhancedDataTable
            v-if="activeSettingKey === 'dictionary'"
            storage-key="business.settings.dictionary-definitions"
            :loading="settingsLoading"
            :columns="enhancedDictionaryDefinitionColumns"
            :data="filteredDefinitionRows"
            :row-key="row => row.dictionaryType"
            :row-props="dictionaryDefinitionRowProps"
            :row-action="hasPermission('MaintainDictionary') ? openDictionaryItemsModal : undefined"
            :show-toolbar="false"
            :min-scroll-x="720"
            mobile-mode="table"
            mobile-primary-key="dictionaryName"
            :mobile-secondary-keys="['manageMode']"
            :mobile-meta-keys="['businessScene']"
            size="small"
          />

          <EnhancedDataTable
            v-else-if="activeSettingKey === 'service'"
            storage-key="business.settings.service-catalog"
            :loading="settingsLoading"
            :columns="enhancedServiceColumns"
            :data="filteredServiceCatalogRows"
            :row-key="row => row.id"
            :row-action="hasPermission('EditServiceCatalog') ? openEditServiceForm : undefined"
            :show-toolbar="false"
            :min-scroll-x="1040"
            mobile-mode="table"
            mobile-primary-key="name"
            mobile-status-key="enabled"
            :mobile-secondary-keys="['category', 'defaultPrice', 'sort']"
            :mobile-meta-keys="['remark']"
            size="small"
          />

          <EnhancedDataTable
            v-else
            storage-key="business.settings.announcements"
            :loading="settingsLoading"
            :columns="enhancedAnnouncementColumns"
            :data="filteredAnnouncementRows"
            :row-key="row => row.id"
            :row-action="openEditAnnouncementForm"
            :show-toolbar="false"
            :min-scroll-x="1080"
            mobile-mode="table"
            mobile-primary-key="title"
            mobile-status-key="enabled"
            :mobile-secondary-keys="['type', 'publishAt', 'expireAt']"
            :mobile-meta-keys="['content']"
            size="small"
          />
        </section>
      </section>
    </div>

    <n-modal
      v-model:show="showDictionaryItemsModal"
      preset="card"
      :title="dictionaryItemsModalTitle"
      closable
      style="width: min(880px, 94vw)"
    >
      <div class="settings-modal-head">
        <n-space>
          <NButton v-permission="'AddDictionaryItem'" size="small" type="primary" secondary :disabled="!selectedDefinition" @click="openCreateItemForm(selectedDefinitionType)">
            <i class="i-fe:plus mr-4" />
            新增项
          </NButton>
          <NButton v-permission="'ExportDictionary'" size="small" secondary :disabled="!selectedDefinition" @click="exportCurrentItems">
            <i class="i-fe:download mr-4" />
            导出
          </NButton>
        </n-space>
      </div>

      <EnhancedDataTable
        storage-key="business.settings.dictionary-items"
        :loading="settingsLoading"
        :columns="enhancedDictionaryItemColumns"
        :data="filteredItems"
        :row-key="row => row.id"
        :row-action="hasPermission('EditDictionaryItem') ? openEditItemForm : undefined"
        :show-toolbar="false"
        :min-scroll-x="760"
        mobile-mode="table"
        mobile-primary-key="name"
        mobile-status-key="enabled"
        :mobile-secondary-keys="['code', 'sort']"
        :mobile-meta-keys="['remark']"
        size="small"
      />
    </n-modal>

    <n-modal
      v-model:show="showItemFormModal"
      preset="card"
      :title="itemFormTitle"
      closable
      style="width: min(620px, 92vw)"
    >
      <n-alert v-if="itemFormError" class="mb-16" type="error" :bordered="false">
        {{ itemFormError }}
      </n-alert>

      <n-form label-placement="top" :model="itemForm">
        <n-grid cols="1 m:2" :x-gap="12" responsive="screen">
          <n-form-item-gi :label="activeDefinition.itemCodeLabel">
            <n-input
              :value="itemCodePreview"
              disabled
              placeholder="填写名称后自动生成"
            />
          </n-form-item-gi>
          <n-form-item-gi :label="activeDefinition.nameLabel">
            <n-input v-model:value="itemForm.name" :placeholder="activeDefinition.namePlaceholder" />
          </n-form-item-gi>
        </n-grid>

        <n-grid cols="1 m:2" :x-gap="12" responsive="screen">
          <n-form-item-gi label="排序">
            <n-input-number v-model:value="itemForm.sort" class="w-full" :min="1" :precision="0" :show-button="false" />
          </n-form-item-gi>
          <n-form-item-gi label="是否启用">
            <NSwitch v-model:value="itemForm.enabled" />
          </n-form-item-gi>
        </n-grid>

        <n-form-item label="备注">
          <n-input v-model:value="itemForm.remark" type="textarea" placeholder="可选" />
        </n-form-item>
      </n-form>

      <template #footer>
        <n-space justify="end">
          <NButton @click="showItemFormModal = false">
            取消
          </NButton>
          <NButton type="primary" :loading="saving" @click="submitItemForm">
            保存
          </NButton>
        </n-space>
      </template>
    </n-modal>

    <n-modal
      v-model:show="showServiceFormModal"
      preset="card"
      :title="serviceFormTitle"
      closable
      style="width: min(720px, 92vw)"
    >
      <n-alert v-if="serviceFormError" class="mb-16" type="error" :bordered="false">
        {{ serviceFormError }}
      </n-alert>

      <n-form label-placement="top" :model="serviceForm">
        <n-grid cols="1 m:2" :x-gap="12" responsive="screen">
          <n-form-item-gi label="服务名称">
            <n-input v-model:value="serviceForm.name" placeholder="例如：部门决算" />
          </n-form-item-gi>
        </n-grid>

        <n-grid cols="1 m:2" :x-gap="12" responsive="screen">
          <n-form-item-gi label="类别">
            <n-select v-model:value="serviceForm.category" :options="serviceCategoryOptions" placeholder="选择类别" />
          </n-form-item-gi>
          <n-form-item-gi label="默认价格">
            <n-input-number v-model:value="serviceForm.defaultPrice" class="w-full" :min="0" :precision="2" :show-button="false" />
          </n-form-item-gi>
        </n-grid>

        <n-grid cols="1 m:2" :x-gap="12" responsive="screen">
          <n-form-item-gi label="期限提醒">
            <n-input :value="serviceFormRuleText" disabled />
          </n-form-item-gi>
          <n-form-item-gi label="是否启用">
            <NSwitch v-model:value="serviceForm.enabled" />
          </n-form-item-gi>
          <n-form-item-gi label="排序">
            <n-input-number v-model:value="serviceForm.sort" class="w-full" :min="1" :precision="0" :show-button="false" />
          </n-form-item-gi>
        </n-grid>

        <n-form-item label="备注">
          <n-input v-model:value="serviceForm.remark" type="textarea" placeholder="可选" />
        </n-form-item>
      </n-form>

      <template #footer>
        <n-space justify="end">
          <NButton @click="showServiceFormModal = false">
            取消
          </NButton>
          <NButton type="primary" :loading="serviceSaving" @click="submitServiceForm">
            保存
          </NButton>
        </n-space>
      </template>
    </n-modal>

    <n-modal
      v-model:show="showAnnouncementFormModal"
      preset="card"
      :title="announcementFormTitle"
      closable
      style="width: min(760px, 92vw)"
    >
      <n-alert v-if="announcementFormError" class="mb-16" type="error" :bordered="false">
        {{ announcementFormError }}
      </n-alert>

      <n-form label-placement="top" :model="announcementForm">
        <n-grid cols="1 m:2" :x-gap="12" responsive="screen">
          <n-form-item-gi label="公告标题">
            <n-input v-model:value="announcementForm.title" placeholder="例如：服务项状态变更通知" />
          </n-form-item-gi>
          <n-form-item-gi label="类型">
            <n-select v-model:value="announcementForm.type" :options="announcementTypeOptions" />
          </n-form-item-gi>
        </n-grid>

        <n-grid cols="1 m:2" :x-gap="12" responsive="screen">
          <n-form-item-gi label="发布日期">
            <AppDatePicker v-model:formatted-value="announcementForm.publishAt" clearable placeholder="不填则立即展示" />
          </n-form-item-gi>
          <n-form-item-gi label="过期日期">
            <AppDatePicker v-model:formatted-value="announcementForm.expireAt" clearable placeholder="不填则长期有效" />
          </n-form-item-gi>
        </n-grid>

        <n-grid cols="1 m:3" :x-gap="12" responsive="screen">
          <n-form-item-gi label="是否启用">
            <NSwitch v-model:value="announcementForm.enabled" />
          </n-form-item-gi>
          <n-form-item-gi label="是否置顶">
            <NSwitch v-model:value="announcementForm.pinned" />
          </n-form-item-gi>
          <n-form-item-gi label="排序">
            <n-input-number v-model:value="announcementForm.sort" class="w-full" :min="1" :precision="0" :show-button="false" />
          </n-form-item-gi>
        </n-grid>

        <n-form-item label="公告内容">
          <n-input v-model:value="announcementForm.content" type="textarea" placeholder="面向全员展示的通知内容" :autosize="{ minRows: 4, maxRows: 7 }" />
        </n-form-item>
      </n-form>

      <template #footer>
        <n-space justify="end">
          <NButton @click="showAnnouncementFormModal = false">
            取消
          </NButton>
          <NButton type="primary" :loading="announcementSaving" @click="submitAnnouncementForm">
            保存
          </NButton>
        </n-space>
      </template>
    </n-modal>
  </CommonPage>
</template>

<script setup>
import { NButton, NSwitch, NTag } from 'naive-ui'
import { AppDatePicker, EnhancedDataTable } from '@/components/common'
import { hasPermission, withPermission } from '@/directives'
import { ALL_PAGE_SIZE, createGeneratedCode, downloadCsv, enhanceTableColumns } from '@/utils'
import { businessApi } from '../shared/api'
import { formatCurrency } from '../shared/format'
import { useBusinessStore } from '../shared/useBusinessStore'

defineOptions({ name: 'BusinessSettings' })

const store = useBusinessStore()
const route = useRoute()

const enabledFilterOptions = [
  { label: '启用', value: true },
  { label: '停用', value: false },
]

const serviceCategoryOptions = [
  { label: '一次性', value: '一次性' },
  { label: '周期性', value: '周期性' },
]
const announcementTypeOptions = [
  { label: '通知', value: '通知' },
  { label: '公告', value: '公告' },
  { label: '提醒', value: '提醒' },
]

const serviceCategoryRules = {
  一次性: '不需要服务期限，不启用到期提醒',
  周期性: '默认一年服务期限，自动启用到期提醒',
}

const configFilters = reactive({
  keyword: '',
  enabled: null,
  category: null,
  type: null,
})
const activeSettingKey = ref('dictionary')
const selectedDefinitionType = ref('region')
const showDictionaryItemsModal = ref(false)
const showItemFormModal = ref(false)
const showServiceFormModal = ref(false)
const showAnnouncementFormModal = ref(false)
const itemFormMode = ref('create')
const serviceFormMode = ref('create')
const announcementFormMode = ref('create')
const itemFormError = ref('')
const serviceFormError = ref('')
const announcementFormError = ref('')
const saving = ref(false)
const serviceSaving = ref(false)
const announcementSaving = ref(false)
const serviceCatalogLoading = ref(false)
const announcementsLoading = ref(false)
const announcementRows = ref([])
const itemForm = reactive(createEmptyItemForm('region'))
const serviceForm = reactive(createEmptyServiceForm())
const announcementForm = reactive(createEmptyAnnouncementForm())

onMounted(async () => {
  syncSettingFromRoute()
  serviceCatalogLoading.value = true
  announcementsLoading.value = true
  try {
    await Promise.all([
      store.loadDictionaryDefinitions(),
      store.loadDictionaries(),
      store.loadServiceCatalog({}),
      loadAnnouncements(),
    ])
  }
  finally {
    serviceCatalogLoading.value = false
    announcementsLoading.value = false
  }
})

watch(() => route.query.section, syncSettingFromRoute)

const definitionRows = computed(() => {
  return store.dictionaryDefinitions.map((definition, index) => {
    const items = store.dictionaryRows.filter(item => item.dictionaryType === definition.dictionaryType)
    const enabledCount = items.filter(item => item.enabled).length
    const disabledCount = items.length - enabledCount
    return {
      ...definition,
      index: index + 1,
      dictionaryCode: definition.dictionaryCode || createGeneratedCode(definition.dictionaryName),
      itemCount: items.length,
      enabledCount,
      disabledCount,
      hasEnabledItems: enabledCount > 0,
      systemPreset: definition.systemPreset ? '是' : '否',
    }
  })
})

const filteredDefinitionRows = computed(() => {
  return definitionRows.value.filter(dictionaryDefinitionMatchesFilters)
})

const selectedDefinition = computed(() => {
  return definitionRows.value.find(row => row.dictionaryType === selectedDefinitionType.value) || definitionRows.value[0] || null
})

const activeDefinition = computed(() => {
  return resolveDictionaryDefinition(itemForm.dictionaryType)
})

const currentItems = computed(() => {
  return getDictionaryItemsForType(selectedDefinitionType.value)
})

const filteredItems = computed(() => {
  return currentItems.value.filter(row => dictionaryItemMatchesFilters(row, selectedDefinition.value))
})

const serviceCatalogRows = computed(() => {
  return store.serviceCatalog
    .slice()
    .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0) || Number(a.id || 0) - Number(b.id || 0))
})

const settingsLoading = computed(() => store.loading || serviceCatalogLoading.value || announcementsLoading.value)
const keywordPlaceholder = computed(() => activeSettingKey.value === 'announcement' ? '标题、内容' : '名称、编码、备注')

const filteredServiceCatalogRows = computed(() => {
  return serviceCatalogRows.value.filter(serviceMatchesFilters)
})

const filteredAnnouncementRows = computed(() => {
  return announcementRows.value.filter(announcementMatchesFilters)
})

const settingGroups = [
  {
    key: 'dictionary',
    label: '数据字典',
  },
  {
    key: 'service',
    label: '服务项',
  },
  {
    key: 'announcement',
    label: '通知公告',
  },
]
const settingTreeData = settingGroups
const selectedSettingKeys = computed(() => [activeSettingKey.value])

const dictionaryItemsModalTitle = computed(() => {
  return selectedDefinition.value ? `维护${selectedDefinition.value.dictionaryName}` : '维护字典项'
})

const dictionaryDefinitionColumns = [
  { title: '字典名称', key: 'dictionaryName', minWidth: 180, fixed: 'left' },
  { title: '管理方式', key: 'manageMode', width: 150, render: row => row.manageMode || '-' },
  { title: '业务用途', key: 'businessScene', minWidth: 240, ellipsis: { tooltip: true }, render: row => row.businessScene || row.remark || '-' },
  {
    title: '操作',
    key: 'actions',
    width: 150,
    align: 'right',
    fixed: 'right',
    render: renderDictionaryDefinitionActions,
  },
]

const dictionaryItemColumns = [
  { title: '名称', key: 'name', minWidth: 180, fixed: 'left' },
  { title: '编码', key: 'code', width: 150, ellipsis: { tooltip: true } },
  { title: '状态', key: 'enabled', width: 110, render: renderDictionaryItemStatus },
  { title: '排序', key: 'sort', width: 80 },
  { title: '备注', key: 'remark', minWidth: 220, ellipsis: { tooltip: true }, render: row => row.remark || '-' },
  {
    title: '操作',
    key: 'actions',
    width: 150,
    align: 'right',
    fixed: 'right',
    render: renderDictionaryItemActions,
  },
]

const serviceColumns = [
  { title: '服务名称', key: 'name', minWidth: 180, fixed: 'left' },
  { title: '类别', key: 'category', width: 110, render: row => normalizeServiceCategory(row.category) },
  { title: '默认价格', key: 'defaultPrice', width: 120, render: row => `￥${formatCurrency(row.defaultPrice)}` },
  { title: '状态', key: 'enabled', width: 110, render: renderServiceStatus },
  { title: '排序', key: 'sort', width: 80 },
  { title: '备注', key: 'remark', minWidth: 220, ellipsis: { tooltip: true }, render: row => row.remark || '-' },
  {
    title: '操作',
    key: 'actions',
    width: 150,
    align: 'right',
    fixed: 'right',
    render: renderServiceActions,
  },
]

const announcementColumns = [
  { title: '公告标题', key: 'title', minWidth: 220, fixed: 'left', ellipsis: { tooltip: true } },
  { title: '类型', key: 'type', width: 90, render: renderAnnouncementType },
  { title: '发布日期', key: 'publishAt', width: 120, render: row => row.publishAt || '-' },
  { title: '过期日期', key: 'expireAt', width: 120, render: row => row.expireAt || '长期有效' },
  { title: '置顶', key: 'pinned', width: 90, render: renderPinnedStatus },
  { title: '状态', key: 'enabled', width: 110, render: renderAnnouncementStatus },
  { title: '排序', key: 'sort', width: 80 },
  { title: '内容', key: 'content', minWidth: 260, ellipsis: { tooltip: true }, render: row => row.content || '-' },
  {
    title: '操作',
    key: 'actions',
    width: 150,
    align: 'right',
    fixed: 'right',
    render: renderAnnouncementActions,
  },
]

const enhancedDictionaryDefinitionColumns = computed(() => enhanceTableColumns(dictionaryDefinitionColumns, { index: false }))
const enhancedDictionaryItemColumns = computed(() => enhanceTableColumns(dictionaryItemColumns, { index: false }))
const enhancedServiceColumns = computed(() => enhanceTableColumns(serviceColumns, { index: false }))
const enhancedAnnouncementColumns = computed(() => enhanceTableColumns(announcementColumns, { index: false }))

const itemFormTitle = computed(() => {
  const action = itemFormMode.value === 'create' ? '新增' : '编辑'
  return `${action}${getDictionaryItemScopeName(activeDefinition.value)}`
})

const itemCodePreview = computed(() => {
  const name = itemForm.name.trim()
  return name ? createGeneratedCode(name) : ''
})

const serviceFormTitle = computed(() => {
  return serviceFormMode.value === 'create' ? '新增服务项' : '编辑服务项'
})

const announcementFormTitle = computed(() => {
  return announcementFormMode.value === 'create' ? '新增通知公告' : '编辑通知公告'
})

const serviceFormRuleText = computed(() => {
  return serviceCategoryRules[serviceForm.category] || '请选择类别'
})

function createEmptyItemForm(dictionaryType) {
  return {
    id: null,
    dictionaryType,
    code: '',
    name: '',
    sort: nextItemSort(dictionaryType),
    enabled: true,
    remark: '',
  }
}

function createEmptyServiceForm() {
  return {
    id: null,
    name: '',
    category: '一次性',
    defaultPrice: 0,
    enabled: true,
    sort: nextServiceSort(),
    remark: '',
  }
}

function createEmptyAnnouncementForm() {
  return {
    id: null,
    title: '',
    type: '通知',
    content: '',
    enabled: true,
    pinned: false,
    sort: nextAnnouncementSort(),
    publishAt: formatToday(),
    expireAt: null,
  }
}

function getDictionaryItemScopeName(definition) {
  return definition.dictionaryName.endsWith('项') ? definition.dictionaryName : `${definition.dictionaryName}项`
}

function nextItemSort(dictionaryType) {
  const rows = getDictionaryItemsForType(dictionaryType)
  if (!rows.length)
    return 1
  return Math.max(...rows.map(item => Number(item.sort || 0))) + 1
}

function nextServiceSort() {
  if (!store.serviceCatalog.length)
    return 1
  return Math.max(...store.serviceCatalog.map(item => Number(item.sort || 0))) + 1
}

function nextAnnouncementSort() {
  if (!announcementRows.value.length)
    return 1
  return Math.max(...announcementRows.value.map(item => Number(item.sort || 0))) + 1
}

function formatToday() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDictionaryItemsForType(dictionaryType) {
  return store.dictionaryRows
    .filter(item => item.dictionaryType === dictionaryType)
    .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0) || Number(a.id || 0) - Number(b.id || 0))
}

function dictionaryDefinitionMatchesFilters(definition) {
  return matchesEnabled(definition.hasEnabledItems) && matchesKeyword(getDefinitionSearchValues(definition))
}

function dictionaryItemMatchesFilters(item, definition) {
  if (!matchesEnabled(item.enabled))
    return false
  return matchesKeyword(getDictionaryItemSearchValues(item))
    || (definition ? matchesKeyword(getDefinitionSearchValues(definition)) : false)
}

function serviceMatchesFilters(service) {
  if (!matchesEnabled(service.enabled))
    return false
  if (configFilters.category && normalizeServiceCategory(service.category) !== configFilters.category)
    return false
  return matchesKeyword(getServiceSearchValues(service))
}

function announcementMatchesFilters(announcement) {
  if (!matchesEnabled(announcement.enabled))
    return false
  if (configFilters.type && announcement.type !== configFilters.type)
    return false
  return matchesKeyword(getAnnouncementSearchValues(announcement))
}

function matchesEnabled(enabled) {
  return configFilters.enabled === null || enabled === configFilters.enabled
}

function matchesKeyword(values) {
  const keyword = configFilters.keyword.trim().toLowerCase()
  if (!keyword)
    return true
  return values.some((value) => {
    if (value === null || value === undefined)
      return false
    return String(value).toLowerCase().includes(keyword)
  })
}

function getDefinitionSearchValues(definition) {
  return [
    definition.dictionaryName,
    definition.dictionaryCode,
    definition.businessScene,
    definition.manageMode,
    definition.remark,
  ]
}

function getDictionaryItemSearchValues(item) {
  return [item.name, item.code, item.remark]
}

function getServiceSearchValues(service) {
  return [service.name, service.code, normalizeServiceCategory(service.category), service.remark]
}

function getAnnouncementSearchValues(announcement) {
  return [announcement.title, announcement.type, announcement.content]
}

function normalizeServiceCategory(category) {
  if (category === '报表')
    return '一次性'
  if (category === '服务')
    return '周期性'
  return category || '一次性'
}

function selectSettingGroup(key) {
  activeSettingKey.value = key
  if (key === 'dictionary')
    configFilters.category = null
  if (key !== 'announcement')
    configFilters.type = null
}

function syncSettingFromRoute() {
  const section = route.query.section
  if (['dictionary', 'service', 'announcement'].includes(section))
    selectSettingGroup(section)
}

function handleSettingTreeSelect(keys) {
  const key = keys[0]
  if (!key)
    return

  if (key === 'dictionary') {
    selectSettingGroup('dictionary')
    return
  }

  if (key === 'service') {
    selectSettingGroup('service')
    configFilters.category = null
    return
  }

  if (key === 'announcement') {
    selectSettingGroup('announcement')
    configFilters.category = null
  }
}

function resetConfigFilters() {
  Object.assign(configFilters, {
    keyword: '',
    enabled: null,
    category: null,
    type: null,
  })
}

function selectDefinition(dictionaryType) {
  selectedDefinitionType.value = dictionaryType
}

function openDictionaryItemsModal(definition) {
  selectDefinition(definition.dictionaryType)
  showDictionaryItemsModal.value = true
}

function dictionaryDefinitionRowProps(row) {
  return {
    class: [
      'settings-definition-row',
      row.dictionaryType === selectedDefinitionType.value ? 'settings-definition-row--current' : '',
    ].filter(Boolean).join(' '),
    onClick(event) {
      if (isInteractiveEvent(event))
        return
      selectDefinition(row.dictionaryType)
    },
  }
}

function isInteractiveEvent(event) {
  return event.target instanceof Element
    && !!event.target.closest('button,a,input,textarea,.n-base-selection,.n-switch,.n-checkbox,.n-data-table-resize-button')
}

function renderDictionaryItemStatus(row) {
  const switchNode = withPermission(h(NSwitch, {
    'value': row.enabled,
    'size': 'small',
    'loading': row._savingEnabled,
    'onUpdate:value': value => toggleItemEnabled(row, value),
  }), 'ToggleDictionaryItem')
  return switchNode || renderTag(row.enabled ? '启用' : '停用', row.enabled ? 'success' : 'default')
}

function renderServiceStatus(row) {
  const switchNode = withPermission(h(NSwitch, {
    'value': row.enabled,
    'size': 'small',
    'loading': row._savingEnabled,
    'onUpdate:value': value => toggleServiceEnabled(row, value),
  }), 'ToggleServiceCatalog')
  return switchNode || renderTag(row.enabled ? '启用' : '停用', row.enabled ? 'success' : 'default')
}

function renderAnnouncementStatus(row) {
  return h(NSwitch, {
    'value': row.enabled,
    'size': 'small',
    'loading': row._savingEnabled,
    'onUpdate:value': value => toggleAnnouncementEnabled(row, value),
  })
}

function renderAnnouncementType(row) {
  const typeMap = {
    公告: 'info',
    提醒: 'warning',
    通知: 'success',
  }
  return renderTag(row.type || '通知', typeMap[row.type] || 'default')
}

function renderPinnedStatus(row) {
  return renderTag(row.pinned ? '置顶' : '普通', row.pinned ? 'warning' : 'default')
}

function renderDictionaryDefinitionActions(row) {
  return [
    renderActionButton('MaintainDictionary', { type: 'primary', onClick: () => openDictionaryItemsModal(row) }, '维护'),
    renderActionButton('ExportDictionary', { onClick: () => exportItemsForDefinition(row) }, '导出'),
  ].filter(Boolean)
}

function renderDictionaryItemActions(row) {
  return [
    renderActionButton('EditDictionaryItem', { type: 'primary', onClick: () => openEditItemForm(row) }, '编辑'),
    renderActionButton('DeleteDictionaryItem', { type: 'error', onClick: () => removeItem(row) }, '删除'),
  ].filter(Boolean)
}

function renderServiceActions(row) {
  return [
    renderActionButton('EditServiceCatalog', { type: 'primary', onClick: () => openEditServiceForm(row) }, '编辑'),
    renderActionButton('DeleteServiceCatalog', { type: 'error', onClick: () => removeService(row) }, '删除'),
  ].filter(Boolean)
}

function renderAnnouncementActions(row) {
  return [
    h(NButton, { size: 'small', secondary: true, type: 'primary', onClick: () => openEditAnnouncementForm(row) }, { default: () => '编辑' }),
    h(NButton, { size: 'small', secondary: true, type: 'error', onClick: () => removeAnnouncement(row) }, { default: () => '删除' }),
  ]
}

function renderTag(text, type = 'default') {
  return h(NTag, { size: 'small', type, bordered: false }, { default: () => text })
}

function renderActionButton(permissionCode, props, text) {
  return withPermission(h(
    NButton,
    { size: 'small', secondary: true, ...props },
    { default: () => text },
  ), permissionCode)
}

function openCreateItemForm(dictionaryType = selectedDefinitionType.value) {
  selectDefinition(dictionaryType)
  itemFormMode.value = 'create'
  Object.assign(itemForm, createEmptyItemForm(dictionaryType))
  itemFormError.value = ''
  showItemFormModal.value = true
}

function openEditItemForm(row) {
  selectDefinition(row.dictionaryType)
  itemFormMode.value = 'edit'
  Object.assign(itemForm, {
    id: row.id,
    dictionaryType: row.dictionaryType,
    code: row.code || '',
    name: row.name || '',
    sort: Number(row.sort || 1),
    enabled: Boolean(row.enabled),
    remark: row.remark || '',
  })
  itemFormError.value = ''
  showItemFormModal.value = true
}

async function submitItemForm() {
  const error = validateItemForm()
  if (error) {
    itemFormError.value = error
    return
  }

  try {
    saving.value = true
    if (itemFormMode.value === 'create') {
      await store.addDictionaryItem({
        dictionaryType: itemForm.dictionaryType,
        name: itemForm.name.trim(),
        sort: Number(itemForm.sort || 1),
        enabled: itemForm.enabled,
        remark: itemForm.remark.trim(),
      })
    }
    else {
      await store.updateDictionaryItem({
        id: itemForm.id,
        name: itemForm.name.trim(),
        sort: Number(itemForm.sort || 1),
        enabled: itemForm.enabled,
        remark: itemForm.remark.trim(),
      })
    }
    showItemFormModal.value = false
    $message.success(itemFormMode.value === 'create' ? '字典项已新增' : '字典项已更新')
  }
  catch (error) {
    itemFormError.value = error?.message || '保存失败'
  }
  finally {
    saving.value = false
  }
}

function validateItemForm() {
  const name = itemForm.name.trim()
  const rows = getDictionaryItemsForType(itemForm.dictionaryType)
  if (!name)
    return `请填写${activeDefinition.value.nameLabel}。`
  if (rows.some(item => item.name === name && item.id !== itemForm.id))
    return '字典名称已存在。'
  if (Number(itemForm.sort || 0) < 1)
    return '排序必须大于等于 1。'
  return ''
}

async function toggleItemEnabled(row, enabled) {
  try {
    row._savingEnabled = true
    await store.updateDictionaryItem({
      id: row.id,
      enabled,
    })
    $message.success(enabled ? '字典项已启用' : '字典项已停用')
  }
  catch (error) {
    await store.loadDictionaries()
    $message.error(error?.message || '状态更新失败')
  }
  finally {
    row._savingEnabled = false
  }
}

function removeItem(row) {
  confirmRemoveItems([row])
}

function confirmRemoveItems(rows) {
  const names = rows.map(row => row.name).join('、')
  const d = $dialog.warning({
    title: '删除字典项',
    content: `确认删除「${names}」？删除后业务页面将不再显示这些字典项。`,
    positiveText: '删除',
    negativeText: '取消',
    async onPositiveClick() {
      try {
        d.loading = true
        for (const row of rows)
          await store.deleteDictionaryItem(row.id)
        $message.success('字典项已删除')
      }
      finally {
        d.loading = false
      }
    },
  })
}

function openCreateServiceForm() {
  serviceFormMode.value = 'create'
  Object.assign(serviceForm, createEmptyServiceForm())
  serviceFormError.value = ''
  showServiceFormModal.value = true
}

function openCreateAnnouncementForm() {
  announcementFormMode.value = 'create'
  Object.assign(announcementForm, createEmptyAnnouncementForm())
  announcementFormError.value = ''
  showAnnouncementFormModal.value = true
}

function openEditServiceForm(row) {
  serviceFormMode.value = 'edit'
  Object.assign(serviceForm, {
    id: row.id,
    name: row.name || '',
    category: serviceCategoryRules[normalizeServiceCategory(row.category)] ? normalizeServiceCategory(row.category) : '',
    defaultPrice: Number(row.defaultPrice || 0),
    enabled: Boolean(row.enabled),
    sort: Number(row.sort || 1),
    remark: row.remark || '',
  })
  serviceFormError.value = ''
  showServiceFormModal.value = true
}

function openEditAnnouncementForm(row) {
  announcementFormMode.value = 'edit'
  Object.assign(announcementForm, {
    id: row.id,
    title: row.title || '',
    type: row.type || '通知',
    content: row.content || '',
    enabled: Boolean(row.enabled),
    pinned: Boolean(row.pinned),
    sort: Number(row.sort || 1),
    publishAt: row.publishAt || null,
    expireAt: row.expireAt || null,
  })
  announcementFormError.value = ''
  showAnnouncementFormModal.value = true
}

async function submitServiceForm() {
  const error = validateServiceForm()
  if (error) {
    serviceFormError.value = error
    return
  }

  const payload = {
    name: serviceForm.name.trim(),
    category: serviceForm.category.trim(),
    defaultPrice: Number(serviceForm.defaultPrice || 0),
    enabled: serviceForm.enabled,
    sort: Number(serviceForm.sort || 1),
    remark: serviceForm.remark.trim(),
  }

  try {
    serviceSaving.value = true
    if (serviceFormMode.value === 'create')
      await store.addServiceCatalog(payload)
    else
      await store.updateServiceCatalog(serviceForm.id, payload)

    showServiceFormModal.value = false
    await store.loadServiceCatalog({})
    $message.success(serviceFormMode.value === 'create' ? '服务项已新增' : '服务项已更新')
  }
  catch (error) {
    serviceFormError.value = error?.message || '保存失败'
  }
  finally {
    serviceSaving.value = false
  }
}

async function submitAnnouncementForm() {
  const error = validateAnnouncementForm()
  if (error) {
    announcementFormError.value = error
    return
  }

  const payload = {
    title: announcementForm.title.trim(),
    type: announcementForm.type,
    content: announcementForm.content.trim(),
    enabled: announcementForm.enabled,
    pinned: announcementForm.pinned,
    sort: Number(announcementForm.sort || 1),
    publishAt: announcementForm.publishAt || null,
    expireAt: announcementForm.expireAt || null,
  }

  try {
    announcementSaving.value = true
    if (announcementFormMode.value === 'create')
      await businessApi.announcements.create(payload)
    else
      await businessApi.announcements.update(announcementForm.id, payload)

    showAnnouncementFormModal.value = false
    await loadAnnouncements()
    $message.success(announcementFormMode.value === 'create' ? '通知公告已新增' : '通知公告已更新')
  }
  catch (error) {
    announcementFormError.value = error?.message || '保存失败'
  }
  finally {
    announcementSaving.value = false
  }
}

function validateServiceForm() {
  const name = serviceForm.name.trim()
  if (!name)
    return '请填写服务名称。'
  if (!serviceCategoryRules[serviceForm.category])
    return '请选择类别。'
  if (serviceCatalogRows.value.some(item => item.name === name && item.id !== serviceForm.id))
    return '服务名称已存在。'
  if (Number(serviceForm.defaultPrice || 0) < 0)
    return '默认价格不能小于 0。'
  if (Number(serviceForm.sort || 0) < 1)
    return '排序必须大于等于 1。'
  return ''
}

function validateAnnouncementForm() {
  if (!announcementForm.title.trim())
    return '请填写公告标题。'
  if (!announcementForm.content.trim())
    return '请填写公告内容。'
  if (!announcementTypeOptions.some(item => item.value === announcementForm.type))
    return '请选择公告类型。'
  if (Number(announcementForm.sort || 0) < 1)
    return '排序必须大于等于 1。'
  if (announcementForm.publishAt && announcementForm.expireAt && announcementForm.expireAt < announcementForm.publishAt)
    return '过期日期不能早于发布日期。'
  return ''
}

async function toggleServiceEnabled(row, enabled) {
  try {
    row._savingEnabled = true
    await store.updateServiceCatalog(row.id, { enabled })
    await store.loadServiceCatalog({})
    $message.success(enabled ? '服务项已启用' : '服务项已停用')
  }
  catch (error) {
    await store.loadServiceCatalog({})
    $message.error(error?.message || '状态更新失败')
  }
  finally {
    row._savingEnabled = false
  }
}

async function toggleAnnouncementEnabled(row, enabled) {
  try {
    row._savingEnabled = true
    await businessApi.announcements.update(row.id, { enabled })
    await loadAnnouncements()
    $message.success(enabled ? '通知公告已启用' : '通知公告已停用')
  }
  catch (error) {
    await loadAnnouncements()
    $message.error(error?.message || '状态更新失败')
  }
  finally {
    row._savingEnabled = false
  }
}

function removeService(row) {
  confirmRemoveServices([row])
}

function removeAnnouncement(row) {
  const d = $dialog.warning({
    title: '删除通知公告',
    content: `确认删除「${row.title}」？删除后首页将不再展示这条公告。`,
    positiveText: '删除',
    negativeText: '取消',
    async onPositiveClick() {
      try {
        d.loading = true
        await businessApi.announcements.delete(row.id)
        await loadAnnouncements()
        $message.success('通知公告已删除')
      }
      finally {
        d.loading = false
      }
    },
  })
}

async function loadAnnouncements() {
  const { data } = await businessApi.announcements.page({ pageNo: 1, pageSize: ALL_PAGE_SIZE })
  announcementRows.value = data?.pageData || []
  return announcementRows.value
}

function confirmRemoveServices(rows) {
  const names = rows.map(row => row.name).join('、')
  const d = $dialog.warning({
    title: '删除服务项',
    content: `确认删除「${names}」？删除后订单和提成页面将不再显示这些服务项。`,
    positiveText: '删除',
    negativeText: '取消',
    async onPositiveClick() {
      try {
        d.loading = true
        for (const row of rows)
          await store.deleteServiceCatalog(row.id)
        await store.loadServiceCatalog({})
        $message.success('服务项已删除')
      }
      finally {
        d.loading = false
      }
    },
  })
}

function exportDictionaryDefinitions() {
  const rows = filteredDefinitionRows.value.map(row => ({
    序号: row.index,
    字典编码: row.dictionaryCode,
    字典名称: row.dictionaryName,
    业务用途: row.businessScene,
    字典项数: row.itemCount,
    启用项: row.enabledCount,
    停用项: row.disabledCount,
    管理方式: row.manageMode,
    系统预设: row.systemPreset,
    备注: row.remark,
  }))
  if (!downloadCsv('数据字典主表.csv', rows))
    $message.warning('没有可导出的数据')
}

function exportItemsForDefinition(definition) {
  selectDefinition(definition.dictionaryType)
  exportCurrentItems()
}

function resolveDictionaryDefinition(dictionaryType) {
  const definition = store.dictionaryDefinitions.find(item => item.dictionaryType === dictionaryType)
  if (definition)
    return definition
  return fixedDictionaryDefinitions[dictionaryType] || fixedDictionaryDefinitions.region
}

const fixedDictionaryDefinitions = {
  region: {
    dictionaryType: 'region',
    dictionaryName: '区划',
    itemCodeLabel: '区划项编码',
    nameLabel: '区划名称',
    codePlaceholder: '例如：KJ_Code',
    namePlaceholder: '例如：达州市',
  },
  position: {
    dictionaryType: 'position',
    dictionaryName: '职位',
    itemCodeLabel: '职位项编码',
    nameLabel: '职位名称',
    codePlaceholder: '例如：TBY_Code',
    namePlaceholder: '例如：财报完成人',
  },
}

function exportCurrentItems() {
  const definition = selectedDefinition.value
  if (!definition) {
    $message.warning('请先选择字典类型')
    return
  }
  const rows = filteredItems.value.map((row, index) => ({
    序号: index + 1,
    字典编码: row.code,
    字典名称: row.name,
    排序: row.sort,
    是否启用: row.enabled ? '启用' : '停用',
    备注: row.remark || '',
  }))
  if (!downloadCsv(`${definition.dictionaryName}项.csv`, rows))
    $message.warning('没有可导出的数据')
}
</script>

<style scoped>
.settings-workbench {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
  min-height: 100%;
  gap: 14px;
  color: #18212f;
}

.settings-tree {
  min-width: 0;
  border-right: 1px solid #edf2f7;
  padding: 2px 10px 2px 0;
}

.settings-category-tree {
  font-size: 14px;
  --n-node-height: 32px;
}

.settings-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0;
}

.settings-table-shell {
  min-width: 0;
  overflow: hidden;
  border: 1px solid #e5ebf0;
  border-radius: 6px;
}

.settings-modal-head {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-bottom: 12px;
}

:deep(.n-data-table-td) {
  color: #263445;
  font-size: 13px;
}

:deep(.n-data-table-td),
:deep(.n-data-table-th) {
  border-color: #edf1f5;
}

:deep(.settings-definition-row) {
  cursor: pointer;
}

:deep(.settings-definition-row--current td) {
  background: rgba(var(--zenith-primary-color), 0.035);
  color: rgb(var(--zenith-primary-color));
  font-weight: 600;
}

:deep(.enhanced-table-actions) {
  gap: 6px;
}

@media (max-width: 980px) {
  .settings-workbench {
    grid-template-columns: 128px minmax(0, 1fr);
    gap: 12px;
  }
}

@media (max-width: 760px) {
  .settings-workbench {
    display: flex;
    flex-direction: column;
  }

  .settings-tree {
    border-right: 0;
    border-bottom: 1px solid #edf2f7;
    padding: 0 0 10px;
  }

  .settings-modal-head {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
