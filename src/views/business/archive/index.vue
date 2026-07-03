<template>
  <CommonPage title="资料中心" class="archive-center-page zenith-data-page">
    <section class="archive-summary">
      <div v-for="item in summaryCards" :key="item.key" class="archive-summary__item">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </section>

    <n-tabs v-model:value="activeTab" type="line" animated class="zenith-data-tabs">
      <n-tab-pane name="business" tab="业务归档">
        <div class="zenith-data-stack">
          <n-form class="zenith-filter-bar" data-filter-collapsed-rows="all" inline label-placement="left" :show-feedback="false">
            <n-form-item label="关键词">
              <n-input v-model:value="attachmentQuery.keyword" clearable placeholder="文件、客户、关联对象" @keyup.enter="searchAttachments" />
            </n-form-item>
            <n-form-item label="关联">
              <n-select v-model:value="attachmentQuery.entityType" clearable class="w-130px" :options="entityTypeOptions" placeholder="全部类型" @update:value="searchAttachments" />
            </n-form-item>
            <n-form-item label="标签">
              <n-select v-model:value="attachmentQuery.tag" clearable class="w-130px" :options="businessTagOptions" placeholder="全部标签" @update:value="searchAttachments" />
            </n-form-item>
            <n-form-item class="zenith-filter-actions">
              <NSpace>
                <NButton type="primary" @click="searchAttachments">
                  <i class="i-fe:search mr-4" />
                  查询
                </NButton>
                <NButton secondary @click="resetAttachments">
                  <i class="i-fe:rotate-ccw mr-4" />
                  重置
                </NButton>
                <NButton v-if="canUploadArchive" type="primary" @click="openAttachmentDrawer()">
                  <i class="i-fe:upload mr-4" />
                  上传归档
                </NButton>
              </NSpace>
            </n-form-item>
          </n-form>
          <EnhancedDataTable
            storage-key="business.archive.attachments"
            :columns="enhancedAttachmentColumns"
            :data="attachments"
            :pagination="attachmentPagination"
            :row-action="previewAttachment"
            mobile-primary-key="name"
            mobile-status-key="tag"
            :mobile-secondary-keys="['linkedTo', 'currentClientName', 'uploadedByName', 'uploadedAt']"
            remote
            size="small"
            @update:page="handleAttachmentPageChange"
            @update:page-size="handleAttachmentPageSizeChange"
            @update:sorter="handleAttachmentSorterChange"
          />
        </div>
      </n-tab-pane>

      <n-tab-pane name="materials" tab="公司资料">
        <div class="zenith-data-stack">
          <n-form class="zenith-filter-bar" data-filter-collapsed-rows="all" inline label-placement="left" :show-feedback="false">
            <n-form-item label="关键词">
              <n-input v-model:value="materialQuery.keyword" clearable placeholder="标题、分类、说明" @keyup.enter="searchMaterials" />
            </n-form-item>
            <n-form-item label="类型">
              <n-select v-model:value="materialQuery.documentType" clearable class="w-130px" :options="materialTypeOptions" placeholder="全部类型" @update:value="searchMaterials" />
            </n-form-item>
            <n-form-item label="状态">
              <n-select v-model:value="materialQuery.status" clearable class="w-130px" :options="materialStatusOptions" placeholder="全部状态" @update:value="searchMaterials" />
            </n-form-item>
            <n-form-item class="zenith-filter-actions">
              <NSpace>
                <NButton type="primary" @click="searchMaterials">
                  <i class="i-fe:search mr-4" />
                  查询
                </NButton>
                <NButton secondary @click="resetMaterials">
                  <i class="i-fe:rotate-ccw mr-4" />
                  重置
                </NButton>
                <NButton v-if="canManageMaterials" type="primary" @click="openMaterialDrawer()">
                  <i class="i-fe:plus mr-4" />
                  发布资料
                </NButton>
              </NSpace>
            </n-form-item>
          </n-form>
          <EnhancedDataTable
            storage-key="business.archive.materials"
            :columns="enhancedMaterialColumns"
            :data="materials"
            :pagination="materialPagination"
            :row-action="openMaterialRow"
            mobile-primary-key="title"
            mobile-status-key="documentType"
            :mobile-secondary-keys="['category', 'version', 'status', 'publishedAt']"
            remote
            size="small"
            @update:page="handleMaterialPageChange"
            @update:page-size="handleMaterialPageSizeChange"
            @update:sorter="handleMaterialSorterChange"
          />
        </div>
      </n-tab-pane>

      <n-tab-pane name="weekly" tab="周报汇总">
        <div class="zenith-data-stack">
          <n-form class="zenith-filter-bar" data-filter-collapsed-rows="all" inline label-placement="left" :show-feedback="false">
            <n-form-item label="关键词">
              <n-input v-model:value="weeklyQuery.keyword" clearable placeholder="标题、员工、内容" @keyup.enter="searchWeeklyReports" />
            </n-form-item>
            <n-form-item label="员工">
              <n-select v-model:value="weeklyQuery.ownerUserId" clearable filterable class="w-150px" :options="store.employeeOptions" placeholder="全部员工" @update:value="searchWeeklyReports" />
            </n-form-item>
            <n-form-item label="部门">
              <n-select v-model:value="weeklyQuery.departmentName" clearable filterable class="w-150px" :options="weeklyDepartmentOptions" placeholder="全部部门" @update:value="searchWeeklyReports" />
            </n-form-item>
            <n-form-item label="状态">
              <n-select v-model:value="weeklyQuery.status" clearable class="w-130px" :options="weeklyStatusOptions" placeholder="全部状态" @update:value="searchWeeklyReports" />
            </n-form-item>
            <n-form-item label="周开始">
              <AppDatePicker v-model:formatted-value="weeklyQuery.weekStart" clearable class="w-140px" placeholder="周开始" />
            </n-form-item>
            <n-form-item label="周结束">
              <AppDatePicker v-model:formatted-value="weeklyQuery.weekEnd" clearable class="w-140px" placeholder="周结束" />
            </n-form-item>
            <n-form-item class="zenith-filter-actions">
              <NSpace>
                <NButton type="primary" @click="searchWeeklyReports">
                  <i class="i-fe:search mr-4" />
                  查询
                </NButton>
                <NButton secondary @click="resetWeeklyReports">
                  <i class="i-fe:rotate-ccw mr-4" />
                  重置
                </NButton>
                <NButton secondary @click="openGenerateWeeklyDrawer">
                  生成草稿
                </NButton>
                <NButton type="primary" @click="openWeeklyDrawer()">
                  <i class="i-fe:edit-3 mr-4" />
                  填写周报
                </NButton>
              </NSpace>
            </n-form-item>
          </n-form>
          <EnhancedDataTable
            storage-key="business.archive.weeklyReports"
            :columns="enhancedWeeklyColumns"
            :data="weeklyReports"
            :pagination="weeklyPagination"
            :row-action="openWeeklyDrawer"
            mobile-primary-key="title"
            mobile-status-key="status"
            :mobile-secondary-keys="['ownerName', 'weekStart', 'weekEnd', 'weeklySummary', 'sourceType']"
            remote
            size="small"
            @update:page="handleWeeklyPageChange"
            @update:page-size="handleWeeklyPageSizeChange"
            @update:sorter="handleWeeklySorterChange"
          />
        </div>
      </n-tab-pane>
    </n-tabs>

    <n-drawer v-model:show="attachmentDrawerVisible" width="min(720px, 100vw)">
      <n-drawer-content title="上传业务归档" closable>
        <n-form label-placement="top">
          <n-grid cols="1 m:2" :x-gap="12">
            <n-form-item-gi label="资料标签">
              <n-select v-model:value="attachmentForm.tag" :options="businessTagOptions" />
            </n-form-item-gi>
            <n-form-item-gi label="文件名称">
              <n-input v-model:value="attachmentForm.name" clearable />
            </n-form-item-gi>
            <n-form-item-gi label="关联类型">
              <n-select v-model:value="attachmentForm.entityType" :options="entityTypeOptions" @update:value="handleAttachmentEntityTypeChange" />
            </n-form-item-gi>
            <n-form-item-gi label="关联对象">
              <n-select
                v-model:value="attachmentForm.entityId"
                filterable
                remote
                clearable
                :options="linkTargetOptions"
                :loading="linkTargetLoading"
                placeholder="输入关键词搜索"
                @search="loadLinkTargets"
              />
            </n-form-item-gi>
          </n-grid>
          <n-form-item label="文件">
            <n-upload :max="1" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.mp4,.webm,.mov" :default-upload="false" @change="handleAttachmentFileChange">
              <n-upload-dragger>
                <div class="archive-upload-box">
                  <i class="i-fe:upload-cloud" />
                  <span>{{ attachmentFile ? attachmentFile.name : '选择业务归档文件' }}</span>
                </div>
              </n-upload-dragger>
            </n-upload>
          </n-form-item>
          <n-form-item label="备注">
            <n-input v-model:value="attachmentForm.remark" type="textarea" clearable :autosize="{ minRows: 2, maxRows: 4 }" />
          </n-form-item>
        </n-form>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="attachmentDrawerVisible = false">
              取消
            </NButton>
            <NButton type="primary" :loading="attachmentSaving" :disabled="!attachmentFile" @click="submitAttachment">
              上传
            </NButton>
          </NSpace>
        </template>
      </n-drawer-content>
    </n-drawer>

    <n-drawer v-model:show="materialDrawerVisible" width="min(760px, 100vw)">
      <n-drawer-content :title="editingMaterial ? '编辑公司资料' : '发布公司资料'" closable>
        <n-form label-placement="top">
          <n-grid cols="1 m:2" :x-gap="12">
            <n-form-item-gi label="标题">
              <n-input v-model:value="materialForm.title" clearable />
            </n-form-item-gi>
            <n-form-item-gi label="分类">
              <n-input v-model:value="materialForm.category" clearable placeholder="制度、政策、培训等" />
            </n-form-item-gi>
            <n-form-item-gi label="类型">
              <n-select v-model:value="materialForm.documentType" :options="materialTypeOptions" />
            </n-form-item-gi>
            <n-form-item-gi label="版本">
              <n-input v-model:value="materialForm.version" clearable />
            </n-form-item-gi>
            <n-form-item-gi label="状态">
              <n-select v-model:value="materialForm.status" :options="materialStatusOptions" />
            </n-form-item-gi>
            <n-form-item-gi label="置顶">
              <n-switch v-model:value="materialForm.pinned" />
            </n-form-item-gi>
            <n-form-item-gi label="生效日期">
              <AppDatePicker v-model:formatted-value="materialForm.effectiveDate" clearable />
            </n-form-item-gi>
            <n-form-item-gi label="废止日期">
              <AppDatePicker v-model:formatted-value="materialForm.expiredDate" clearable />
            </n-form-item-gi>
          </n-grid>
          <n-form-item label="文件">
            <n-upload :max="1" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.mp4,.webm,.mov" :default-upload="false" @change="handleMaterialFileChange">
              <n-upload-dragger>
                <div class="archive-upload-box">
                  <i class="i-fe:upload-cloud" />
                  <span>{{ materialFile ? materialFile.name : editingMaterial ? '不选择则保留原文件' : '选择公司资料文件' }}</span>
                </div>
              </n-upload-dragger>
            </n-upload>
          </n-form-item>
          <n-form-item label="说明">
            <n-input v-model:value="materialForm.description" type="textarea" clearable :autosize="{ minRows: 3, maxRows: 6 }" />
          </n-form-item>
        </n-form>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="materialDrawerVisible = false">
              取消
            </NButton>
            <NButton type="primary" :loading="materialSaving" @click="submitMaterial">
              保存
            </NButton>
          </NSpace>
        </template>
      </n-drawer-content>
    </n-drawer>

    <n-drawer v-model:show="weeklyDrawerVisible" width="min(760px, 100vw)">
      <n-drawer-content :title="editingWeeklyReport ? weeklyReadonly ? '查看周报' : '编辑周报' : '填写周报'" closable>
        <n-form label-placement="top">
          <n-grid cols="1 m:2" :x-gap="12">
            <n-form-item-gi label="周开始">
              <AppDatePicker v-model:formatted-value="weeklyForm.weekStart" :disabled="Boolean(editingWeeklyReport) || weeklyReadonly" @update:formatted-value="syncWeeklyDays" />
            </n-form-item-gi>
            <n-form-item-gi label="周结束">
              <AppDatePicker v-model:formatted-value="weeklyForm.weekEnd" :disabled="Boolean(editingWeeklyReport) || weeklyReadonly" @update:formatted-value="syncWeeklyDays" />
            </n-form-item-gi>
          </n-grid>
          <n-form-item label="标题">
            <n-input v-model:value="weeklyForm.title" clearable :disabled="weeklyReadonly" />
          </n-form-item>
          <n-form-item label="每日工作内容">
            <div class="weekly-day-list">
              <div v-for="day in weeklyForm.dailyWork" :key="day.date" class="weekly-day-row">
                <div class="weekly-day-row__label">
                  <strong>{{ day.weekday }}</strong>
                  <span>{{ day.date }}</span>
                </div>
                <n-input v-model:value="day.content" type="textarea" clearable :disabled="weeklyReadonly" :autosize="{ minRows: 2, maxRows: 5 }" placeholder="填写当天工作内容，多个事项可换行" />
              </div>
            </div>
          </n-form-item>
          <n-form-item label="本周总结">
            <n-input v-model:value="weeklyForm.weeklySummary" type="textarea" clearable :disabled="weeklyReadonly" :autosize="{ minRows: 2, maxRows: 4 }" placeholder="例如：累计处理系统操作与业务咨询事项35件" />
          </n-form-item>
          <n-form-item label="问题和风险">
            <n-input v-model:value="weeklyForm.blockers" type="textarea" clearable :disabled="weeklyReadonly" :autosize="{ minRows: 3, maxRows: 6 }" />
          </n-form-item>
          <n-form-item label="下周计划">
            <n-input v-model:value="weeklyForm.nextPlan" type="textarea" clearable :disabled="weeklyReadonly" :autosize="{ minRows: 4, maxRows: 8 }" />
          </n-form-item>
        </n-form>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="weeklyDrawerVisible = false">
              {{ weeklyReadonly ? '关闭' : '取消' }}
            </NButton>
            <NButton v-if="!weeklyReadonly" type="primary" :loading="weeklySaving" @click="submitWeeklyReport">
              保存
            </NButton>
          </NSpace>
        </template>
      </n-drawer-content>
    </n-drawer>
  </CommonPage>
</template>

<script setup>
import { NButton, NPopconfirm, NSpace, NTag } from 'naive-ui'
import { AppDatePicker, EnhancedDataTable } from '@/components/common'
import { hasPermission } from '@/directives'
import { createTablePagination, createTableSorter, DEFAULT_PAGE_SIZE, enhanceTableColumns, formatDate, getTableSorterParams, normalizeTableSorter } from '@/utils'
import { businessApi } from '../shared/api'
import { useBusinessStore } from '../shared/useBusinessStore'

defineOptions({ name: 'ArchiveFiles' })

const store = useBusinessStore()
const activeTab = ref('business')
const summary = ref({})
const attachments = ref([])
const materials = ref([])
const weeklyReports = ref([])
const linkTargetOptions = ref([])
const linkTargetLoading = ref(false)
const attachmentFile = ref(null)
const materialFile = ref(null)
const editingMaterial = ref(null)
const editingWeeklyReport = ref(null)
const attachmentDrawerVisible = ref(false)
const materialDrawerVisible = ref(false)
const weeklyDrawerVisible = ref(false)
const attachmentSaving = ref(false)
const materialSaving = ref(false)
const weeklySaving = ref(false)

const canUploadArchive = computed(() => hasPermission('UploadArchiveFile') || hasPermission('ArchiveFiles'))
const canDeleteArchive = computed(() => hasPermission('DeleteArchiveFile'))
const canManageMaterials = computed(() => hasPermission('ManageArchiveMaterial'))

const entityTypes = ['客户', '订单', '服务项', '合同', '发票', '收款']
const businessTags = ['合同', '发票', '银行流水', '报告', '上报证明', '截图', '客户资料', '其他']
const materialTypes = ['制度文件', '操作说明', '政策文件', '培训资料', '视频', '其他']
const materialStatuses = ['已发布', '已废止']
const weeklyStatuses = ['草稿', '已提交']

const entityTypeOptions = entityTypes.map(value => ({ label: value, value }))
const businessTagOptions = businessTags.map(value => ({ label: value, value }))
const materialTypeOptions = materialTypes.map(value => ({ label: value, value }))
const materialStatusOptions = materialStatuses.map(value => ({ label: value, value }))
const weeklyStatusOptions = weeklyStatuses.map(value => ({ label: value, value }))
const weeklyDepartmentOptions = computed(() => store.departmentOptions.map(item => ({ label: item.label, value: item.label })))

const attachmentQuery = reactive({ keyword: '', entityType: null, tag: null })
const materialQuery = reactive({ keyword: '', documentType: null, status: null })
const weeklyQuery = reactive({ keyword: '', ownerUserId: null, departmentName: null, status: null, weekStart: null, weekEnd: null })

const attachmentPagination = reactive(createTablePagination({ page: 1, pageSize: DEFAULT_PAGE_SIZE, itemCount: 0 }))
const materialPagination = reactive(createTablePagination({ page: 1, pageSize: DEFAULT_PAGE_SIZE, itemCount: 0 }))
const weeklyPagination = reactive(createTablePagination({ page: 1, pageSize: DEFAULT_PAGE_SIZE, itemCount: 0 }))
const attachmentSorter = ref(createTableSorter())
const materialSorter = ref(createTableSorter())
const weeklySorter = ref(createTableSorter())
const loadedTabs = reactive({ business: false, materials: false, weekly: false })

const attachmentForm = reactive(createEmptyAttachmentForm())
const materialForm = reactive(createEmptyMaterialForm())
const weeklyForm = reactive(createEmptyWeeklyForm())

const summaryCards = computed(() => [
  { key: 'fileCount', label: '资料文件', value: summary.value.fileCount || 0 },
  { key: 'businessLinkCount', label: '业务关联', value: summary.value.businessLinkCount || 0 },
  { key: 'materialCount', label: '公司资料', value: summary.value.materialCount || 0 },
  { key: 'weeklyReportCount', label: '周报', value: summary.value.weeklyReportCount || 0 },
  { key: 'missingContractOrders', label: '缺合同归档', value: summary.value.missingContractOrders || 0 },
  { key: 'missingInvoiceOrders', label: '缺发票归档', value: summary.value.missingInvoiceOrders || 0 },
])

const enhancedAttachmentColumns = computed(() => enhanceTableColumns(attachmentColumns, { remote: true }))
const enhancedMaterialColumns = computed(() => enhanceTableColumns(materialColumns, { remote: true }))
const enhancedWeeklyColumns = computed(() => enhanceTableColumns(weeklyColumns, { remote: true }))
const weeklyReadonly = computed(() => editingWeeklyReport.value?.status === '已提交')

const tagTypeMap = {
  合同: 'info',
  发票: 'success',
  银行流水: 'warning',
  视频: 'error',
  已发布: 'success',
  已废止: 'default',
  草稿: 'warning',
  已提交: 'success',
}

const attachmentColumns = [
  { title: '文件名', key: 'name', minWidth: 260, ellipsis: { tooltip: true }, remoteSortable: true },
  { title: '标签', key: 'tag', width: 110, remoteSortable: true, render: row => renderTag(row.tag) },
  { title: '关联对象', key: 'linkedTo', minWidth: 240, ellipsis: { tooltip: true }, render: row => row.linkedTo || '-' },
  { title: '客户', key: 'currentClientName', minWidth: 220, ellipsis: { tooltip: true }, remoteSortable: true, render: row => row.currentClientName || '-' },
  { title: '大小', key: 'sizeBytes', width: 100, remoteSortable: true, render: row => formatFileSize(row.sizeBytes) },
  { title: '上传人', key: 'uploadedByName', width: 120, render: row => row.uploadedByName || '-' },
  { title: '上传时间', key: 'uploadedAt', width: 120, remoteSortable: true, render: row => row.uploadedAt ? formatDate(row.uploadedAt) : '-' },
  {
    title: '操作',
    key: 'actions',
    width: 190,
    fixed: 'right',
    render(row) {
      return h(NSpace, { size: 6 }, {
        default: () => [
          isPreviewable(row) ? h(NButton, { size: 'small', secondary: true, onClick: () => previewAttachment(row) }, { default: () => '预览' }) : null,
          h(NButton, { size: 'small', secondary: true, type: 'primary', onClick: () => downloadAttachment(row) }, { default: () => '下载' }),
          canDeleteArchive.value
            ? h(NPopconfirm, { onPositiveClick: () => removeAttachment(row) }, {
                trigger: () => h(NButton, { size: 'small', secondary: true, type: 'error' }, { default: () => '删除' }),
                default: () => '确认删除该资料文件？',
              })
            : null,
        ].filter(Boolean),
      })
    },
  },
]

const materialColumns = [
  { title: '标题', key: 'title', minWidth: 260, ellipsis: { tooltip: true }, remoteSortable: true },
  { title: '分类', key: 'category', width: 130, remoteSortable: true },
  { title: '类型', key: 'documentType', width: 120, remoteSortable: true, render: row => renderTag(row.documentType) },
  { title: '版本', key: 'version', width: 90 },
  { title: '状态', key: 'status', width: 100, remoteSortable: true, render: row => renderTag(row.status) },
  { title: '置顶', key: 'pinned', width: 80, remoteSortable: true, render: row => row.pinned ? '是' : '否' },
  { title: '发布人', key: 'publishedByName', width: 120, render: row => row.publishedByName || '-' },
  { title: '发布时间', key: 'publishedAt', width: 120, remoteSortable: true, render: row => row.publishedAt ? formatDate(row.publishedAt) : '-' },
  {
    title: '操作',
    key: 'actions',
    width: 230,
    fixed: 'right',
    render(row) {
      return h(NSpace, { size: 6 }, {
        default: () => [
          row.attachment && isPreviewable(row.attachment) ? h(NButton, { size: 'small', secondary: true, onClick: () => previewAttachment(row.attachment) }, { default: () => '预览' }) : null,
          row.attachment ? h(NButton, { size: 'small', secondary: true, type: 'primary', onClick: () => downloadAttachment(row.attachment) }, { default: () => '下载' }) : null,
          canManageMaterials.value ? h(NButton, { size: 'small', secondary: true, onClick: () => openMaterialDrawer(row) }, { default: () => '编辑' }) : null,
          canManageMaterials.value
            ? h(NPopconfirm, { onPositiveClick: () => removeMaterial(row) }, {
                trigger: () => h(NButton, { size: 'small', secondary: true, type: 'error' }, { default: () => '删除' }),
                default: () => '确认删除该公司资料？',
              })
            : null,
        ].filter(Boolean),
      })
    },
  },
]

const weeklyColumns = [
  { title: '标题', key: 'title', minWidth: 240, ellipsis: { tooltip: true } },
  { title: '员工', key: 'ownerName', width: 120, remoteSortable: true },
  { title: '部门', key: 'departmentName', width: 140, render: row => row.departmentName || '-' },
  { title: '周开始', key: 'weekStart', width: 120, remoteSortable: true },
  { title: '周结束', key: 'weekEnd', width: 120, remoteSortable: true },
  { title: '本周总结', key: 'weeklySummary', minWidth: 240, ellipsis: { tooltip: true }, render: row => row.weeklySummary || '-' },
  { title: '来源', key: 'sourceType', width: 100 },
  { title: '状态', key: 'status', width: 100, remoteSortable: true, render: row => renderTag(row.status) },
  {
    title: '操作',
    key: 'actions',
    width: 360,
    fixed: 'right',
    render(row) {
      return h(NSpace, { size: 6 }, {
        default: () => [
          h(NButton, { size: 'small', secondary: true, onClick: () => openWeeklyDrawer(row) }, { default: () => row.status === '已提交' ? '查看' : '编辑' }),
          row.status !== '已提交' ? h(NButton, { size: 'small', secondary: true, type: 'success', onClick: () => submitWeekly(row) }, { default: () => '提交' }) : null,
          row.status === '已提交'
            ? h(NPopconfirm, { onPositiveClick: () => withdrawWeekly(row) }, {
                trigger: () => h(NButton, { size: 'small', secondary: true, type: 'warning' }, { default: () => '撤回' }),
                default: () => '确认撤回该周报？',
              })
            : null,
          h(NButton, { size: 'small', secondary: true, onClick: () => printWeeklyReport(row) }, { default: () => '打印/PDF' }),
          h(NButton, { size: 'small', secondary: true, onClick: () => exportWeeklyReportWord(row) }, { default: () => 'Word' }),
          row.status !== '已提交'
            ? h(NPopconfirm, { onPositiveClick: () => removeWeekly(row) }, {
                trigger: () => h(NButton, { size: 'small', secondary: true, type: 'error' }, { default: () => '删除' }),
                default: () => '确认删除该周报？',
              })
            : null,
        ].filter(Boolean),
      })
    },
  },
]

onMounted(async () => {
  await Promise.all([loadSummary(), loadActiveTab(true)])
})

watch(activeTab, () => {
  loadActiveTab()
})

async function loadActiveTab(force = false) {
  if (!force && loadedTabs[activeTab.value])
    return
  if (activeTab.value === 'business') {
    await loadAttachments()
    loadedTabs.business = true
    return
  }
  if (activeTab.value === 'materials') {
    await loadMaterials()
    loadedTabs.materials = true
    return
  }
  await ensureWeeklyOptions()
  await loadWeeklyReports()
  loadedTabs.weekly = true
}

async function ensureWeeklyOptions() {
  const tasks = []
  if (!store.employeeOptions.length)
    tasks.push(store.loadEmployees())
  if (!store.departmentOptions.length)
    tasks.push(store.loadDepartments())
  if (tasks.length)
    await Promise.all(tasks)
}

function createEmptyAttachmentForm() {
  return { tag: '合同', name: '', entityType: '订单', entityId: null, remark: '' }
}

function createEmptyMaterialForm() {
  return { title: '', category: '', documentType: '制度文件', version: 'V1', status: '已发布', pinned: false, effectiveDate: null, expiredDate: null, description: '' }
}

function createEmptyWeeklyForm() {
  const { start, end } = currentWeekRange()
  return { weekStart: start, weekEnd: end, title: `${start} 工作周报`, dailyWork: createWeekdayRows(start, end), weeklySummary: '', completedWork: '', blockers: '', nextPlan: '' }
}

async function loadSummary() {
  const { data } = await businessApi.archive.summary()
  summary.value = data || {}
}

async function loadAttachments() {
  const { data } = await businessApi.archive.attachments({
    pageNo: attachmentPagination.page,
    pageSize: attachmentPagination.pageSize,
    ...cleanQuery(attachmentQuery),
    ...getTableSorterParams(attachmentSorter.value),
  })
  attachments.value = data?.pageData || []
  attachmentPagination.itemCount = data?.total || 0
}

async function loadMaterials() {
  const { data } = await businessApi.archive.materials({
    pageNo: materialPagination.page,
    pageSize: materialPagination.pageSize,
    ...cleanQuery(materialQuery),
    ...getTableSorterParams(materialSorter.value),
  })
  materials.value = data?.pageData || []
  materialPagination.itemCount = data?.total || 0
}

async function loadWeeklyReports() {
  const { data } = await businessApi.archive.weeklyReports({
    pageNo: weeklyPagination.page,
    pageSize: weeklyPagination.pageSize,
    ...cleanQuery(weeklyQuery),
    ...getTableSorterParams(weeklySorter.value),
  })
  weeklyReports.value = data?.pageData || []
  weeklyPagination.itemCount = data?.total || 0
}

async function handleAttachmentPageChange(page) {
  attachmentPagination.page = page
  await loadAttachments()
}

async function handleAttachmentPageSizeChange(pageSize) {
  attachmentPagination.page = 1
  attachmentPagination.pageSize = pageSize
  await loadAttachments()
}

async function handleAttachmentSorterChange(sorter) {
  attachmentSorter.value = normalizeTableSorter(sorter)
  attachmentPagination.page = 1
  await loadAttachments()
}

async function handleMaterialPageChange(page) {
  materialPagination.page = page
  await loadMaterials()
}

async function handleMaterialPageSizeChange(pageSize) {
  materialPagination.page = 1
  materialPagination.pageSize = pageSize
  await loadMaterials()
}

async function handleMaterialSorterChange(sorter) {
  materialSorter.value = normalizeTableSorter(sorter)
  materialPagination.page = 1
  await loadMaterials()
}

async function handleWeeklyPageChange(page) {
  weeklyPagination.page = page
  await loadWeeklyReports()
}

async function handleWeeklyPageSizeChange(pageSize) {
  weeklyPagination.page = 1
  weeklyPagination.pageSize = pageSize
  await loadWeeklyReports()
}

async function handleWeeklySorterChange(sorter) {
  weeklySorter.value = normalizeTableSorter(sorter)
  weeklyPagination.page = 1
  await loadWeeklyReports()
}

async function searchAttachments() {
  attachmentPagination.page = 1
  await loadAttachments()
}

async function resetAttachments() {
  Object.assign(attachmentQuery, { keyword: '', entityType: null, tag: null })
  await searchAttachments()
}

async function searchMaterials() {
  materialPagination.page = 1
  await loadMaterials()
}

async function resetMaterials() {
  Object.assign(materialQuery, { keyword: '', documentType: null, status: null })
  await searchMaterials()
}

async function searchWeeklyReports() {
  await ensureWeeklyOptions()
  weeklyPagination.page = 1
  await loadWeeklyReports()
  loadedTabs.weekly = true
}

async function resetWeeklyReports() {
  Object.assign(weeklyQuery, { keyword: '', ownerUserId: null, departmentName: null, status: null, weekStart: null, weekEnd: null })
  await searchWeeklyReports()
}

function syncWeeklyDays() {
  if (!weeklyForm.weekStart || !weeklyForm.weekEnd)
    return
  weeklyForm.dailyWork = normalizeDailyWork(weeklyForm.dailyWork, weeklyForm.weekStart, weeklyForm.weekEnd)
}

function weeklyPayload() {
  const dailyWork = normalizeDailyWork(weeklyForm.dailyWork, weeklyForm.weekStart, weeklyForm.weekEnd)
  return {
    weekStart: weeklyForm.weekStart,
    weekEnd: weeklyForm.weekEnd,
    title: weeklyForm.title,
    dailyWork,
    weeklySummary: weeklyForm.weeklySummary,
    completedWork: dailyWork.map(day => day.content).filter(Boolean).join('\n'),
    blockers: weeklyForm.blockers,
    nextPlan: weeklyForm.nextPlan,
  }
}

function normalizeDailyWork(value, weekStart, weekEnd, fallback = '') {
  const rows = createWeekdayRows(weekStart, weekEnd)
  const inputByDate = new Map((Array.isArray(value) ? value : []).map(item => [item.date, item]))
  rows.forEach((row, index) => {
    const input = inputByDate.get(row.date)
    row.content = input?.content || (index === 0 ? fallback : '')
  })
  return rows
}

function openAttachmentDrawer() {
  Object.assign(attachmentForm, createEmptyAttachmentForm())
  attachmentFile.value = null
  linkTargetOptions.value = []
  attachmentDrawerVisible.value = true
}

function handleAttachmentEntityTypeChange() {
  attachmentForm.entityId = null
  linkTargetOptions.value = []
}

async function loadLinkTargets(keyword) {
  if (!attachmentForm.entityType)
    return
  linkTargetLoading.value = true
  try {
    const { data = [] } = await businessApi.archive.linkTargets({ entityType: attachmentForm.entityType, keyword })
    linkTargetOptions.value = data
  }
  finally {
    linkTargetLoading.value = false
  }
}

function handleAttachmentFileChange({ file }) {
  attachmentFile.value = file?.file || null
  if (attachmentFile.value && !attachmentForm.name)
    attachmentForm.name = attachmentFile.value.name
}

async function submitAttachment() {
  if (!attachmentFile.value || !attachmentForm.entityId)
    return showError('请选择文件和关联对象')
  const formData = new FormData()
  formData.append('file', attachmentFile.value)
  formData.append('tag', attachmentForm.tag)
  formData.append('name', attachmentForm.name || attachmentFile.value.name)
  formData.append('links', JSON.stringify([{ entityType: attachmentForm.entityType, entityId: attachmentForm.entityId, tag: attachmentForm.tag, remark: attachmentForm.remark }]))
  if (attachmentForm.remark)
    formData.append('remark', attachmentForm.remark)
  attachmentSaving.value = true
  try {
    const { data } = await businessApi.archive.uploadAttachment(formData)
    showUploadResult('业务归档已上传', data)
    attachmentDrawerVisible.value = false
    loadedTabs.business = false
    await Promise.all([loadSummary(), loadAttachments()])
  }
  catch (error) {
    showError(error?.message || '上传失败')
  }
  finally {
    attachmentSaving.value = false
  }
}

function openMaterialDrawer(row = null) {
  editingMaterial.value = row
  materialFile.value = null
  Object.assign(materialForm, createEmptyMaterialForm(), row
    ? {
        title: row.title,
        category: row.category,
        documentType: row.documentType,
        version: row.version,
        status: row.status,
        pinned: Boolean(row.pinned),
        effectiveDate: row.effectiveDate,
        expiredDate: row.expiredDate,
        description: row.description || '',
      }
    : {})
  materialDrawerVisible.value = true
}

function openMaterialRow(row) {
  if (canManageMaterials.value)
    return openMaterialDrawer(row)
  if (row?.attachment)
    return previewAttachment(row.attachment)
}

function handleMaterialFileChange({ file }) {
  materialFile.value = file?.file || null
  if (materialFile.value && !materialForm.title)
    materialForm.title = materialFile.value.name
}

async function submitMaterial() {
  if (!materialForm.title || !materialForm.category || !materialForm.documentType)
    return showError('标题、分类和类型不能为空')
  if (!editingMaterial.value && !materialFile.value)
    return showError('请选择资料文件')
  const formData = new FormData()
  if (materialFile.value)
    formData.append('file', materialFile.value)
  for (const [key, value] of Object.entries(materialForm)) {
    if (value !== undefined && value !== null)
      formData.append(key, String(value))
  }
  materialSaving.value = true
  try {
    let result
    if (editingMaterial.value)
      result = await businessApi.archive.updateMaterial(editingMaterial.value.id, formData)
    else
      result = await businessApi.archive.createMaterial(formData)
    showUploadResult('公司资料已保存', result?.data)
    materialDrawerVisible.value = false
    loadedTabs.materials = false
    await Promise.all([loadSummary(), loadMaterials()])
  }
  catch (error) {
    showError(error?.message || '保存失败')
  }
  finally {
    materialSaving.value = false
  }
}

function openWeeklyDrawer(row = null) {
  editingWeeklyReport.value = row
  Object.assign(weeklyForm, createEmptyWeeklyForm(), row
    ? {
        weekStart: row.weekStart,
        weekEnd: row.weekEnd,
        title: row.title,
        dailyWork: normalizeDailyWork(row.dailyWork, row.weekStart, row.weekEnd, row.completedWork),
        weeklySummary: row.weeklySummary || '',
        completedWork: row.completedWork || '',
        blockers: row.blockers || '',
        nextPlan: row.nextPlan || '',
      }
    : {})
  weeklyDrawerVisible.value = true
}

async function openGenerateWeeklyDrawer() {
  await ensureWeeklyOptions()
  const { start, end } = currentWeekRange()
  try {
    const { data } = await businessApi.archive.generateWeeklyDraft({ weekStart: start, weekEnd: end, title: `${start} 工作周报` })
    showSuccess('已生成本周周报草稿')
    loadedTabs.weekly = false
    await Promise.all([loadSummary(), loadWeeklyReports()])
    openWeeklyDrawer(data)
  }
  catch (error) {
    showError(error?.message || '生成失败')
  }
}

async function submitWeeklyReport() {
  if (!weeklyForm.weekStart || !weeklyForm.weekEnd)
    return showError('周报日期不能为空')
  if (!weeklyForm.dailyWork.some(day => day.content?.trim()) && !weeklyForm.weeklySummary?.trim())
    return showError('请填写每日工作内容或本周总结')
  weeklySaving.value = true
  try {
    const payload = weeklyPayload()
    if (editingWeeklyReport.value)
      await businessApi.archive.updateWeeklyReport(editingWeeklyReport.value.id, payload)
    else
      await businessApi.archive.createWeeklyReport(payload)
    showSuccess('周报已保存')
    weeklyDrawerVisible.value = false
    loadedTabs.weekly = false
    await Promise.all([loadSummary(), loadWeeklyReports()])
  }
  catch (error) {
    showError(error?.message || '保存失败')
  }
  finally {
    weeklySaving.value = false
  }
}

async function submitWeekly(row) {
  try {
    await businessApi.archive.submitWeeklyReport(row.id)
    showSuccess('周报已提交')
    loadedTabs.weekly = false
    await loadWeeklyReports()
  }
  catch (error) {
    showError(error?.message || '提交失败')
  }
}

async function withdrawWeekly(row) {
  try {
    await businessApi.archive.withdrawWeeklyReport(row.id)
    showSuccess('周报已撤回')
    loadedTabs.weekly = false
    await loadWeeklyReports()
  }
  catch (error) {
    showError(error?.message || '撤回失败')
  }
}

async function removeWeekly(row) {
  try {
    await businessApi.archive.deleteWeeklyReport(row.id)
    showSuccess('周报已删除')
    loadedTabs.weekly = false
    await Promise.all([loadSummary(), loadWeeklyReports()])
  }
  catch (error) {
    showError(error?.message || '删除失败')
  }
}

function printWeeklyReport(row) {
  const win = window.open('', '_blank')
  if (!win)
    return showError('浏览器阻止了打印窗口')
  win.document.write(buildWeeklyReportHtml(row))
  win.document.close()
  win.focus()
  win.print()
}

function exportWeeklyReportWord(row) {
  const blob = new Blob([buildWeeklyReportHtml(row)], { type: 'application/msword;charset=utf-8' })
  downloadBlob(blob, `${safeFilename(row.title || '工作周报')}.doc`)
}

async function previewAttachment(row) {
  if (!isPreviewable(row)) {
    showWarning('该类型不支持稳定在线预览，已开始下载')
    return downloadAttachment(row)
  }
  const data = await businessApi.archive.previewAttachment(row.id)
  openBlob(data, row.originalName || row.name)
}

async function downloadAttachment(row) {
  const data = await businessApi.archive.downloadAttachment(row.id)
  downloadBlob(data, row.originalName || row.name)
}

async function removeAttachment(row) {
  await businessApi.archive.deleteAttachment(row.id)
  showSuccess('资料文件已删除')
  await Promise.all([loadSummary(), loadAttachments()])
}

async function removeMaterial(row) {
  await businessApi.archive.deleteMaterial(row.id)
  showSuccess('公司资料已删除')
  await Promise.all([loadSummary(), loadMaterials()])
}

function renderTag(label) {
  return h(NTag, { type: tagTypeMap[label] || 'default', size: 'small', bordered: false }, { default: () => label || '-' })
}

function showUploadResult(message, row) {
  const duplicate = row?.duplicateOf
  if (duplicate) {
    showWarning(`${message}，但发现同内容文件：${duplicate.name}`)
    return
  }
  showSuccess(message)
}

function buildWeeklyReportHtml(row) {
  const days = normalizeDailyWork(row.dailyWork, row.weekStart, row.weekEnd, row.completedWork)
  const summary = row.weeklySummary || row.completedWork || ''
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(row.title)}</title>
<style>
body{font-family:"Microsoft YaHei",Arial,sans-serif;color:#111;margin:32px}
h1{margin:0 0 12px;text-align:center;font-size:22px}
.week{text-align:center;margin-bottom:16px;font-size:15px}
table{width:100%;border-collapse:collapse;table-layout:fixed}
th,td{border:1px solid #333;padding:10px;vertical-align:top;font-size:14px;line-height:1.7}
th{background:#f5f5f5;text-align:center}
.date{width:120px;text-align:center;font-weight:600}
.footer{margin-top:14px;text-align:right;font-size:14px}
@media print{body{margin:18mm}.no-print{display:none}}
</style>
</head>
<body>
<h1>${escapeHtml(row.title)}</h1>
<div class="week">${escapeHtml(formatChineseWeekRange(row.weekStart, row.weekEnd))}</div>
<table>
<thead><tr><th class="date">日期</th><th>工作内容</th></tr></thead>
<tbody>
${days.map(day => `<tr><td class="date">${escapeHtml(day.weekday)}<br>${escapeHtml(day.date)}</td><td>${formatMultiline(day.content)}</td></tr>`).join('')}
<tr><td class="date">本周总结</td><td>${formatMultiline(summary)}</td></tr>
</tbody>
</table>
<div class="footer">完成人：${escapeHtml(row.ownerName || '')}</div>
</body>
</html>`
}

function formatChineseWeekRange(start, end) {
  return `${formatChineseDate(start)}—${formatChineseDate(end)}`
}

function formatChineseDate(value) {
  const date = parseDateValue(value)
  if (!date)
    return value || ''
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

function formatMultiline(value) {
  const text = escapeHtml(value || '')
  return text ? text.replace(/\n/g, '<br>') : '&nbsp;'
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function isPreviewable(row) {
  const mimeType = row?.mimeType || ''
  const ext = (row?.fileExt || '').toLowerCase()
  return mimeType.startsWith('image/')
    || mimeType === 'application/pdf'
    || mimeType.startsWith('video/')
    || ['.pdf', '.png', '.jpg', '.jpeg', '.mp4', '.webm', '.mov'].includes(ext)
}

function cleanQuery(query) {
  return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== null && value !== undefined && value !== ''))
}

function formatFileSize(bytes) {
  const size = Number(bytes || 0)
  if (size < 1024)
    return `${size} B`
  if (size < 1024 * 1024)
    return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024)
    return `${(size / 1024 / 1024).toFixed(1)} MB`
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function openBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank', 'noopener,noreferrer')
  if (!win)
    downloadBlob(blob, filename)
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename || '资料文件'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function safeFilename(value) {
  return String(value).replace(/[\\/:*?"<>|]/g, '_')
}

function currentWeekRange() {
  const today = new Date()
  const day = today.getDay() || 7
  const start = new Date(today)
  start.setDate(today.getDate() - day + 1)
  const end = new Date(start)
  end.setDate(start.getDate() + 4)
  return { start: formatDateValue(start), end: formatDateValue(end) }
}

function createWeekdayRows(startValue, endValue) {
  const start = parseDateValue(startValue)
  const end = parseDateValue(endValue)
  if (!start || !end || start > end)
    return []
  const rows = []
  for (let timestamp = start.getTime(); timestamp <= end.getTime(); timestamp += 24 * 60 * 60 * 1000) {
    const date = new Date(timestamp)
    rows.push({
      date: formatDateValue(date),
      weekday: `星期${['日', '一', '二', '三', '四', '五', '六'][date.getDay()]}`,
      content: '',
    })
  }
  return rows
}

function parseDateValue(value) {
  if (!value)
    return null
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!matched)
    return null
  const date = new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDateValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function showSuccess(message) {
  window.$message?.success(message)
}

function showWarning(message) {
  window.$message?.warning(message)
}

function showError(message) {
  window.$message?.error(message)
}
</script>

<style scoped>
.archive-center-page :deep(.n-tabs) {
  min-height: 0;
}

.archive-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.archive-summary__item {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid #e6eaf0;
  border-radius: 6px;
  background: #fff;
}

.archive-summary__item span {
  overflow: hidden;
  color: #667085;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.archive-summary__item strong {
  color: #1f2937;
  font-size: 20px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.archive-upload-box {
  display: flex;
  min-height: 96px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #667085;
}

.archive-upload-box i {
  color: #3b82f6;
  font-size: 28px;
}

.weekly-day-list {
  display: grid;
  width: 100%;
  gap: 10px;
}

.weekly-day-row {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.weekly-day-row__label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 5px;
  color: #243449;
  line-height: 1.35;
}

.weekly-day-row__label span {
  color: #6b7788;
  font-size: 12px;
}

@media (max-width: 640px) {
  .weekly-day-row {
    grid-template-columns: 1fr;
    gap: 6px;
  }
}
</style>
