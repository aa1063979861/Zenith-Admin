<template>
  <CommonPage back title="客户详情" class="client-detail-page">
    <n-spin :show="loading">
      <div v-if="client" class="client-detail">
        <NSpace justify="end">
          <NButton secondary @click="router.back()">
            <template #icon>
              <i class="i-fe:arrow-left" />
            </template>
            返回
          </NButton>
          <n-tooltip :disabled="!identityChangeDisabledReason">
            <template #trigger>
              <span class="action-tooltip-trigger">
                <NButton secondary :disabled="!canChangeClientIdentity" @click="openIdentityDrawer">
                  <template #icon>
                    <i class="i-fe:edit-3" />
                  </template>
                  变更单位信息
                </NButton>
              </span>
            </template>
            {{ identityChangeDisabledReason }}
          </n-tooltip>
          <NButton secondary @click="reloadAll">
            <template #icon>
              <i class="i-fe:refresh-cw" />
            </template>
            刷新
          </NButton>
          <NButton :type="client?.mergedToClientId ? 'warning' : 'primary'" @click="client?.mergedToClientId ? goMergedTarget() : goCreateOrder()">
            <template #icon>
              <i :class="client?.mergedToClientId ? 'i-fe:external-link' : 'i-fe:file-plus'" />
            </template>
            {{ client?.mergedToClientId ? '查看合并后单位' : '新建订单' }}
          </NButton>
        </NSpace>
        <section class="client-overview-panel">
          <div class="client-summary">
            <div class="client-title-row">
              <h2>{{ client.unitName }}</h2>
            </div>
            <div class="client-meta-line">
              <span>{{ client.regionName }}</span>
              <span>{{ client.unitCode }}</span>
            </div>
            <div class="client-status-group">
              <NTag :type="stageMeta.type" :bordered="false">
                {{ stageMeta.label }}
              </NTag>
              <NTag :type="levelMeta.type" :bordered="false">
                {{ levelMeta.label }}
              </NTag>
              <NTag :type="statusMeta.type" :bordered="false">
                {{ statusMeta.label }}
              </NTag>
            </div>
          </div>
          <div class="client-kpi-grid">
            <div
              v-for="item in metrics"
              :key="item.label"
              class="client-kpi" :class="[`client-kpi--${item.tone}`]"
            >
              <span class="client-kpi-label">
                <i :class="item.icon" aria-hidden="true" />
                {{ item.label }}
              </span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
        </section>

        <n-alert v-if="client.mergedToClientId" type="warning" :bordered="false">
          该客户已合并到 {{ mergedTargetText }}。历史订单、服务项、联系人、账号资料、发票和收款仍保留在原客户；订单上的服务单位仍保留原单位快照。
          <template #action>
            <NButton size="small" secondary @click="goMergedTarget">
              查看合并后单位
            </NButton>
          </template>
        </n-alert>

        <n-tabs v-model:value="activeTab" type="line" animated>
          <n-tab-pane name="overview" tab="概览">
            <n-grid cols="1 l:2" :x-gap="12" :y-gap="12" responsive="screen">
              <n-grid-item>
                <section class="detail-section">
                  <header>
                    <h3>基础信息</h3>
                    <NButton v-if="canEditClient" size="small" secondary @click="openBasicDrawer">
                      编辑资料
                    </NButton>
                  </header>
                  <div class="info-list">
                    <div class="info-item">
                      <span class="info-label">统一社会信用代码</span>
                      <span class="info-value">{{ client.unifiedSocialCreditCode || '未录入' }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">单位地址</span>
                      <span class="info-value">{{ client.address || '未录入' }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">备注</span>
                      <span class="info-value">{{ client.remark || '无' }}</span>
                    </div>
                  </div>
                </section>
              </n-grid-item>
              <n-grid-item>
                <section class="detail-section">
                  <header>
                    <h3>主要联系人</h3>
                    <NButton v-if="canEditClient" size="small" secondary @click="openContactDrawer()">
                      新增联系人
                    </NButton>
                  </header>
                  <n-empty v-if="!contacts.length" description="暂无联系人" />
                  <div v-else class="contact-list">
                    <div v-for="contact in contacts" :key="contact.id" class="contact-row" :class="{ 'is-primary': contact.isPrimary }">
                      <div class="contact-avatar">
                        {{ contactInitial(contact.name) }}
                      </div>
                      <div class="contact-main">
                        <div class="contact-title">
                          <strong>{{ contact.name }}</strong>
                          <NTag size="small" :bordered="false">
                            {{ contactRoleLabel(contact.role) }}
                          </NTag>
                          <NTag v-if="contact.isPrimary" size="small" type="success" :bordered="false">
                            主要
                          </NTag>
                        </div>
                        <div class="contact-meta">
                          <i class="i-fe:phone" />
                          <span>{{ contact.phone || '未录入电话' }}</span>
                        </div>
                      </div>
                      <NButton v-if="canEditClient" size="small" text type="primary" @click="openContactDrawer(contact)">
                        编辑
                      </NButton>
                    </div>
                  </div>
                </section>
              </n-grid-item>
            </n-grid>
          </n-tab-pane>

          <n-tab-pane name="services" tab="订单服务">
            <section class="detail-section">
              <EnhancedDataTable storage-key="business.clients.detail.services" :columns="serviceColumns" :data="serviceItems" :pagination="servicePagination" :row-action="openOrderFromService" size="small" remote @update:page="page => loadRelationPage(servicePagination, loadServiceItems, page)" @update:page-size="pageSize => loadRelationPageSize(servicePagination, loadServiceItems, pageSize)" />
            </section>
          </n-tab-pane>

          <n-tab-pane name="finance" tab="财务概览">
            <n-grid cols="1 l:2" :x-gap="12" :y-gap="12" responsive="screen">
              <n-grid-item>
                <section class="detail-section">
                  <h3>发票</h3>
                  <EnhancedDataTable storage-key="business.clients.detail.invoices" :columns="invoiceColumns" :data="invoices" :pagination="invoicePagination" :row-action="openFinanceInvoice" size="small" remote @update:page="page => loadRelationPage(invoicePagination, loadInvoices, page)" @update:page-size="pageSize => loadRelationPageSize(invoicePagination, loadInvoices, pageSize)" />
                </section>
              </n-grid-item>
              <n-grid-item>
                <section class="detail-section">
                  <h3>收款</h3>
                  <EnhancedDataTable storage-key="business.clients.detail.payments" :columns="paymentColumns" :data="payments" :pagination="paymentPagination" :row-action="openFinancePayment" size="small" remote @update:page="page => loadRelationPage(paymentPagination, loadPayments, page)" @update:page-size="pageSize => loadRelationPageSize(paymentPagination, loadPayments, pageSize)" />
                </section>
              </n-grid-item>
            </n-grid>
          </n-tab-pane>

          <n-tab-pane name="attachments" tab="资料归档">
            <section class="detail-section">
              <EnhancedDataTable storage-key="business.clients.detail.attachments" :columns="attachmentColumns" :data="attachments" :pagination="attachmentPagination" :row-action="previewAttachment" size="small" remote @update:page="page => loadRelationPage(attachmentPagination, loadAttachments, page)" @update:page-size="pageSize => loadRelationPageSize(attachmentPagination, loadAttachments, pageSize)" />
            </section>
          </n-tab-pane>

          <n-tab-pane name="credentials" tab="账号资料">
            <section class="detail-section">
              <header>
                <h3>账号资料</h3>
                <NButton v-if="canEditCredential" size="small" type="primary" @click="openCredentialDrawer()">
                  新增账号
                </NButton>
              </header>
              <n-alert v-if="!canViewCredential" type="warning" :show-icon="false">
                当前角色无账号资料查看权限。
              </n-alert>
              <EnhancedDataTable v-else storage-key="business.clients.detail.credentials" :columns="credentialColumns" :data="credentials" :row-action="canEditCredential ? openCredentialDrawer : undefined" size="small" />
            </section>
          </n-tab-pane>

          <n-tab-pane name="history" tab="身份历史">
            <section class="detail-section">
              <EnhancedDataTable storage-key="business.clients.detail.identityHistory" :columns="identityHistoryColumns" :data="identityHistories" size="small" />
            </section>
          </n-tab-pane>

          <n-tab-pane name="merge" tab="合并记录">
            <section class="detail-section">
              <header>
                <h3>合并记录</h3>
                <NButton v-if="canMergeClient" size="small" secondary type="warning" @click="openMergeDrawer">
                  手动合并
                </NButton>
              </header>
              <EnhancedDataTable storage-key="business.clients.detail.mergeLogs" :columns="mergeLogColumns" :data="mergeLogs" size="small" />
            </section>
          </n-tab-pane>
        </n-tabs>
      </div>
    </n-spin>

    <n-drawer v-model:show="showBasicDrawer" :width="drawerWidth" placement="right">
      <n-drawer-content title="编辑基础信息" closable>
        <n-form :model="basicForm" label-placement="top" :show-feedback="false">
          <n-grid cols="1 m:2" :x-gap="12" :y-gap="12" responsive="screen">
            <n-form-item-gi label="统一社会信用代码">
              <n-input v-model:value="basicForm.unifiedSocialCreditCode" />
            </n-form-item-gi>
            <n-form-item-gi span="1 m:2" label="单位地址">
              <n-input v-model:value="basicForm.address" />
            </n-form-item-gi>
            <n-form-item-gi v-if="canMaintainClientLevel" label="客户等级">
              <n-select v-model:value="basicForm.customerLevel" :options="customerLevelOptions" />
            </n-form-item-gi>
            <n-form-item-gi v-if="canMaintainClientLevel" label="单位状态">
              <n-select v-model:value="basicForm.unitStatus" :disabled="Boolean(client.mergedToClientId)" :options="unitStatusOptions" />
            </n-form-item-gi>
            <n-form-item-gi span="1 m:2" label="备注">
              <n-input v-model:value="basicForm.remark" type="textarea" />
            </n-form-item-gi>
          </n-grid>
        </n-form>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="showBasicDrawer = false">
              取消
            </NButton>
            <NButton type="primary" :loading="saving" @click="saveBasic">
              保存
            </NButton>
          </NSpace>
        </template>
      </n-drawer-content>
    </n-drawer>

    <n-drawer v-model:show="showIdentityDrawer" :width="drawerWidth" placement="right">
      <n-drawer-content title="变更单位信息" closable>
        <n-form :model="identityForm" label-placement="top" :show-feedback="false">
          <n-grid cols="1 m:2" :x-gap="12" :y-gap="12" responsive="screen">
            <n-form-item-gi label="区划" required>
              <n-select v-model:value="identityForm.regionCode" filterable :options="store.regionOptions" />
            </n-form-item-gi>
            <n-form-item-gi label="单位编码" required>
              <n-input v-model:value="identityForm.unitCode" maxlength="6" />
            </n-form-item-gi>
            <n-form-item-gi span="1 m:2" label="单位名称" required>
              <n-input v-model:value="identityForm.unitName" />
            </n-form-item-gi>
            <n-form-item-gi span="1 m:2" label="变更原因" required>
              <n-input v-model:value="identityForm.reason" type="textarea" :autosize="{ minRows: 3, maxRows: 5 }" />
            </n-form-item-gi>
          </n-grid>
        </n-form>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="showIdentityDrawer = false">
              取消
            </NButton>
            <NButton type="primary" :loading="saving" @click="saveIdentity">
              保存变更
            </NButton>
          </NSpace>
        </template>
      </n-drawer-content>
    </n-drawer>

    <n-drawer v-model:show="showContactDrawer" :width="drawerWidth" placement="right">
      <n-drawer-content :title="editingContact ? '编辑联系人' : '新增联系人'" closable>
        <n-form :model="contactForm" label-placement="top" :show-feedback="false">
          <n-form-item label="角色">
            <n-select v-model:value="contactForm.role" :options="contactRoleOptions" />
          </n-form-item>
          <n-form-item label="姓名">
            <n-input v-model:value="contactForm.name" />
          </n-form-item>
          <n-form-item label="联系电话">
            <n-input v-model:value="contactForm.phone" />
          </n-form-item>
          <n-form-item>
            <n-checkbox v-model:checked="contactForm.isPrimary">
              设为主要联系人
            </n-checkbox>
          </n-form-item>
          <n-form-item label="备注">
            <n-input v-model:value="contactForm.remark" type="textarea" />
          </n-form-item>
        </n-form>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="showContactDrawer = false">
              取消
            </NButton>
            <NButton type="primary" :loading="saving" @click="saveContact">
              保存
            </NButton>
          </NSpace>
        </template>
      </n-drawer-content>
    </n-drawer>

    <n-drawer v-model:show="showCredentialDrawer" :width="drawerWidth" placement="right">
      <n-drawer-content :title="editingCredential ? '编辑账号资料' : '新增账号资料'" closable>
        <n-form :model="credentialForm" label-placement="top" :show-feedback="false">
          <n-form-item label="系统名称">
            <n-select v-model:value="credentialForm.systemName" clearable filterable tag :options="credentialSystemOptions" @update:value="handleCredentialSystemChange" />
          </n-form-item>
          <n-form-item label="登录账号">
            <n-input v-model:value="credentialForm.username" />
          </n-form-item>
          <n-form-item label="登录密码">
            <n-input v-model:value="credentialForm.password" />
          </n-form-item>
          <n-form-item label="登录地址">
            <n-input v-model:value="credentialForm.loginUrl" />
          </n-form-item>
          <n-form-item label="备注">
            <n-input v-model:value="credentialForm.remark" type="textarea" />
          </n-form-item>
        </n-form>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="showCredentialDrawer = false">
              取消
            </NButton>
            <NButton type="primary" :loading="saving" @click="saveCredential">
              保存
            </NButton>
          </NSpace>
        </template>
      </n-drawer-content>
    </n-drawer>

    <n-drawer v-model:show="showMergeDrawer" :width="mergeDrawerWidth" placement="right">
      <n-drawer-content title="手动合并客户" closable>
        <n-alert type="warning" :bordered="false">
          合并只标记客户归属关系，不迁移订单、服务项、联系人、账号资料、发票和收款；新合并记录可在合并记录中撤销。
        </n-alert>
        <n-form class="mt-16" :model="mergeForm" label-placement="top" :show-feedback="false">
          <n-form-item label="合并到">
            <n-select v-model:value="mergeForm.targetClientId" filterable remote clearable :loading="clientOptionsLoading" :options="clientOptions" placeholder="搜索合并后单位" @focus="() => searchClientOptions('')" @search="searchClientOptions" />
          </n-form-item>
          <n-form-item label="合并原因">
            <n-input v-model:value="mergeForm.reason" type="textarea" />
          </n-form-item>
        </n-form>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="showMergeDrawer = false">
              取消
            </NButton>
            <NButton type="warning" :loading="saving" :disabled="!mergeForm.targetClientId" @click="submitMerge">
              确认合并
            </NButton>
          </NSpace>
        </template>
      </n-drawer-content>
    </n-drawer>
  </CommonPage>
</template>

<script setup>
import { NButton, NPopconfirm, NSpace, NTag } from 'naive-ui'
import { h } from 'vue'
import { CommonPage, EnhancedDataTable } from '@/components/common'
import { useResponsiveLayout } from '@/composables'
import { hasPermission } from '@/directives'
import { createTablePagination, enhanceTableColumns, formatDate } from '@/utils'
import { businessApi } from '../shared/api'
import {
  CLIENT_UNIT_STATUS,
  CLIENT_UNIT_STATUS_META,
  CONTACT_ROLE,
  CONTACT_ROLE_LABELS,
  CUSTOMER_LEVEL,
  CUSTOMER_LEVEL_META,
  CUSTOMER_STAGE_META,
  labelMapToOptions,
  metaToOptions,
} from '../shared/constants'
import { useBusinessStore } from '../shared/useBusinessStore'

const route = useRoute()
const router = useRouter()
const store = useBusinessStore()
const { isMobile } = useResponsiveLayout()
const drawerWidth = computed(() => (isMobile.value ? '100%' : 760))
const mergeDrawerWidth = computed(() => (isMobile.value ? '100%' : 620))
const CLIENT_MERGE_OPTION_PAGE_SIZE = 20

const clientId = computed(() => Number(route.params.id))
const detailTabs = new Set(['overview', 'services', 'finance', 'attachments', 'credentials', 'history', 'merge'])
const activeTab = ref(detailTabs.has(String(route.query.tab)) ? String(route.query.tab) : 'overview')
const loading = ref(false)
const saving = ref(false)
const client = ref(null)
const contacts = ref([])
const credentials = ref([])
const serviceItems = ref([])
const invoices = ref([])
const payments = ref([])
const attachments = ref([])
const identityHistories = ref([])
const mergeLogs = ref([])
const clientOptions = ref([])
const clientOptionsLoading = ref(false)

const showBasicDrawer = ref(false)
const showIdentityDrawer = ref(false)
const showContactDrawer = ref(false)
const showCredentialDrawer = ref(false)
const showMergeDrawer = ref(false)
const editingContact = ref(null)
const editingCredential = ref(null)
const credentialSystemOptions = ref([])

const servicePagination = reactive(createTablePagination({ page: 1 }))
const invoicePagination = reactive(createTablePagination({ page: 1 }))
const paymentPagination = reactive(createTablePagination({ page: 1 }))
const attachmentPagination = reactive(createTablePagination({ page: 1 }))

const isMergedClient = computed(() => Boolean(client.value?.mergedToClientId))
const hasEditClientPermission = computed(() => hasPermission('EditClient'))
const identityChangeDisabledReason = computed(() => {
  if (!client.value)
    return '客户资料加载中'
  if (!hasEditClientPermission.value)
    return '当前账号没有客户编辑权限'
  if (isMergedClient.value)
    return '已合并客户不能变更单位信息'
  return ''
})
const canChangeClientIdentity = computed(() => !identityChangeDisabledReason.value)
const canEditClient = computed(() => hasEditClientPermission.value && !isMergedClient.value)
const canDeleteClient = computed(() => hasPermission('DeleteClient'))
const canMaintainClientLevel = computed(() => hasPermission('MaintainClientLevel'))
const canViewCredential = computed(() => hasPermission('ViewClientCredential'))
const canEditCredential = computed(() => hasPermission('EditClientCredential') && !isMergedClient.value)
const canMergeClient = computed(() => canDeleteClient.value && !isMergedClient.value)

const unitStatusMap = CLIENT_UNIT_STATUS_META
const customerStageMap = CUSTOMER_STAGE_META
const customerLevelMap = CUSTOMER_LEVEL_META
const contactRoleMap = CONTACT_ROLE_LABELS

const unitStatusOptions = metaToOptions(unitStatusMap)
const customerLevelOptions = Object.values(CUSTOMER_LEVEL).map(value => ({ label: customerLevelMap[value].label, value }))
const contactRoleOptions = labelMapToOptions(contactRoleMap)

const levelMeta = computed(() => customerLevelMap[client.value?.customerLevel] || customerLevelMap[CUSTOMER_LEVEL.NORMAL])
const stageMeta = computed(() => customerStageMap[client.value?.customerStage] || customerStageMap.POTENTIAL)
const statusMeta = computed(() => unitStatusMap[client.value?.unitStatus] || unitStatusMap[CLIENT_UNIT_STATUS.NORMAL])
const mergedTargetText = computed(() => {
  if (!client.value?.mergedToClientId)
    return '合并后单位'
  if (!client.value.mergedToClientUnitCode || !client.value.mergedToClientUnitName)
    return '合并后单位信息加载中'
  return `${client.value.mergedToClientUnitCode} ${client.value.mergedToClientUnitName}`
})
const metrics = computed(() => [
  { label: '订单数', value: client.value?.orderCount || 0, tone: 'count', icon: 'i-fe:file-text' },
  { label: '服务项', value: client.value?.serviceItemCount || 0, tone: 'count', icon: 'i-fe:layers' },
  { label: '累计应收', value: `￥${formatMoney(client.value?.receivableAmount)}`, tone: 'amount', icon: 'i-fe:credit-card' },
  { label: '已收金额', value: `￥${formatMoney(client.value?.receivedAmount)}`, tone: 'paid', icon: 'i-fe:check-circle' },
  { label: '未收金额', value: `￥${formatMoney(client.value?.unpaidAmount)}`, tone: 'unpaid', icon: 'i-fe:alert-circle' },
])

const basicForm = reactive(createBasicForm())
const identityForm = reactive(createIdentityForm())
const contactForm = reactive(createContactForm())
const credentialForm = reactive(createCredentialForm())
const mergeForm = reactive({ targetClientId: null, reason: '' })

const serviceColumns = computed(() => enhanceTableColumns([
  { title: '订单号', key: 'orderNo', width: 150 },
  { title: '接单日期', key: 'orderDate', width: 120, remoteSortable: true, render: row => row.orderDate ? formatDate(row.orderDate) : '-' },
  { title: '服务项', key: 'serviceName', minWidth: 160 },
  { title: '服务年度', key: 'serviceYear', width: 100 },
  { title: '接单人', key: 'receiverName', width: 120 },
  { title: '完成人', key: 'performerName', width: 120 },
  { title: '应收', key: 'billableAmount', width: 120, render: row => `￥${formatMoney(row.billableAmount)}` },
  { title: '状态', key: 'status', width: 100 },
], { remote: true }))
const invoiceColumns = computed(() => enhanceTableColumns([
  { title: '发票号', key: 'invoiceNo', minWidth: 140 },
  { title: '开票日期', key: 'invoiceDate', width: 120 },
  { title: '金额', key: 'invoiceAmount', width: 120, render: row => `￥${formatMoney(row.invoiceAmount)}` },
  { title: '收款状态', key: 'paymentStatus', width: 110, render: row => row.paymentStatus || '-' },
  { title: '交付状态', key: 'deliveryStatus', width: 110, render: row => row.deliveryStatus || '-' },
], { remote: true }))
const paymentColumns = computed(() => enhanceTableColumns([
  { title: '收款日期', key: 'paymentDate', width: 120 },
  { title: '金额', key: 'amount', width: 120, render: row => `￥${formatMoney(row.amount)}` },
  { title: '匹配状态', key: 'matchStatus', width: 110, render: row => row.matchStatus || '-' },
  { title: '备注', key: 'remark', minWidth: 160, render: row => row.remark || '-' },
], { remote: true }))
const attachmentColumns = computed(() => enhanceTableColumns([
  { title: '文件名', key: 'name', minWidth: 240, ellipsis: { tooltip: true } },
  { title: '标签', key: 'tag', width: 110, render: row => h(NTag, { size: 'small', bordered: false }, { default: () => row.tag || '-' }) },
  { title: '关联对象', key: 'linkedTo', minWidth: 220, ellipsis: { tooltip: true }, render: row => row.linkedTo || '-' },
  { title: '上传人', key: 'uploadedByName', width: 120, render: row => row.uploadedByName || '-' },
  { title: '上传时间', key: 'uploadedAt', width: 120, render: row => row.uploadedAt ? formatDate(row.uploadedAt) : '-' },
  {
    title: '操作',
    key: 'actions',
    width: 130,
    render(row) {
      return h(NSpace, { size: 6 }, {
        default: () => [
          h(NButton, { size: 'small', secondary: true, onClick: () => previewAttachment(row) }, { default: () => '预览' }),
          h(NButton, { size: 'small', secondary: true, type: 'primary', onClick: () => downloadAttachment(row) }, { default: () => '下载' }),
        ],
      })
    },
  },
], { remote: true }))
const credentialColumns = computed(() => enhanceTableColumns([
  { title: '系统名称', key: 'systemName', width: 140 },
  { title: '账号', key: 'username', width: 180, ellipsis: false, render: row => renderCredentialValue(row, 'username', '账号') },
  { title: '密码', key: 'password', width: 180, ellipsis: false, render: row => renderCredentialValue(row, 'password', '密码') },
  { title: '登录地址', key: 'loginUrl', minWidth: 220, render: renderCredentialUrl },
  {
    title: '操作',
    key: 'actions',
    width: 120,
    render(row) {
      return [
        canEditCredential.value ? h(NButton, { size: 'small', secondary: true, onClick: () => openCredentialDrawer(row) }, { default: () => '编辑' }) : null,
        canEditCredential.value ? h(NButton, { size: 'small', text: true, type: 'error', onClick: () => removeCredential(row) }, { default: () => '删除' }) : null,
      ].filter(Boolean)
    },
  },
]))
const identityHistoryColumns = computed(() => enhanceTableColumns([
  { title: '变更前', key: 'oldUnitName', minWidth: 260, render: row => `${row.oldRegionName} · ${row.oldUnitCode} · ${row.oldUnitName}` },
  { title: '变更后', key: 'newUnitName', minWidth: 260, render: row => `${row.newRegionName} · ${row.newUnitCode} · ${row.newUnitName}` },
  { title: '原因', key: 'reason', minWidth: 180, render: row => row.reason || '-' },
  { title: '操作人', key: 'operatorName', width: 120, render: row => row.operatorName || '-' },
  { title: '变更时间', key: 'createTime', width: 120, render: row => row.createTime ? formatDate(row.createTime) : '-' },
]))
const mergeLogColumns = computed(() => enhanceTableColumns([
  { title: '被合并客户', key: 'sourceClientName', minWidth: 180 },
  { title: '合并后单位', key: 'targetClientName', minWidth: 180 },
  { title: '原因', key: 'reason', minWidth: 180, render: row => row.reason || '-' },
  { title: '操作人', key: 'operatorName', width: 120, render: row => row.operatorName || '-' },
  { title: '合并时间', key: 'createTime', width: 120, render: row => row.createTime ? formatDate(row.createTime) : '-' },
  { title: '撤销状态', key: 'revertedAt', width: 130, render: row => row.revertedAt ? `已撤销 ${row.revertedByName || ''}` : (row.canRevert ? '可撤销' : '不可撤销') },
  {
    title: '操作',
    key: 'actions',
    width: 120,
    align: 'right',
    fixed: 'right',
    render(row) {
      if (!canDeleteClient.value || !row.canRevert)
        return null
      return h(NSpace, { justify: 'end', size: 8 }, {
        default: () => h(NPopconfirm, { onPositiveClick: () => revertMerge(row) }, {
          trigger: () => h(NButton, { size: 'small', secondary: true, type: 'warning' }, { default: () => '撤销' }),
          default: () => '确认撤销本次合并？历史订单和资料不会被移动。',
        }),
      })
    },
  },
]))

onMounted(reloadAll)

async function reloadAll() {
  loading.value = true
  try {
    await Promise.all([store.loadDictionaries(), store.loadServiceCatalog(), loadCredentialSystemOptions()])
    await loadClient()
    await Promise.all([
      loadContacts(),
      loadServiceItems(),
      loadInvoices(),
      loadPayments(),
      loadAttachments(),
      loadCredentials(),
      loadIdentityHistories(),
      loadMergeLogs(),
    ])
  }
  finally {
    loading.value = false
  }
}

async function loadClient() {
  const { data } = await businessApi.clients.detail(clientId.value)
  client.value = data
}

async function loadContacts() {
  const { data = [] } = await businessApi.clients.contacts(clientId.value)
  contacts.value = data
}

async function loadCredentials() {
  if (!canViewCredential.value) {
    credentials.value = []
    return
  }
  const { data = [] } = await businessApi.clients.credentials(clientId.value)
  credentials.value = data
}

async function loadCredentialSystemOptions() {
  if (!canViewCredential.value) {
    credentialSystemOptions.value = []
    return
  }
  const { data = [] } = await businessApi.clients.credentialSystemOptions()
  credentialSystemOptions.value = data.map(item => ({
    label: item.name,
    value: item.name,
    loginUrl: item.loginUrl,
  }))
}

async function loadServiceItems() {
  const { data } = await businessApi.serviceItems.page({ clientId: clientId.value, pageNo: servicePagination.page, pageSize: servicePagination.pageSize })
  serviceItems.value = data?.pageData || []
  servicePagination.itemCount = data?.total || 0
}

async function loadInvoices() {
  const { data } = await businessApi.finance.invoices({ clientId: clientId.value, pageNo: invoicePagination.page, pageSize: invoicePagination.pageSize })
  invoices.value = data?.pageData || []
  invoicePagination.itemCount = data?.total || 0
}

async function loadPayments() {
  const { data } = await businessApi.finance.payments({ clientId: clientId.value, pageNo: paymentPagination.page, pageSize: paymentPagination.pageSize })
  payments.value = data?.pageData || []
  paymentPagination.itemCount = data?.total || 0
}

async function loadAttachments() {
  const { data } = await businessApi.archive.attachments({ clientId: clientId.value, pageNo: attachmentPagination.page, pageSize: attachmentPagination.pageSize })
  attachments.value = data?.pageData || []
  attachmentPagination.itemCount = data?.total || 0
}

async function loadIdentityHistories() {
  const { data = [] } = await businessApi.clients.identityHistories(clientId.value)
  identityHistories.value = data
}

async function loadMergeLogs() {
  const { data = [] } = await businessApi.clients.mergeLogs(clientId.value)
  mergeLogs.value = data
}

async function loadRelationPage(pagination, loader, page) {
  pagination.page = page
  await loader()
}

async function loadRelationPageSize(pagination, loader, pageSize) {
  pagination.page = 1
  pagination.pageSize = pageSize
  await loader()
}

function openBasicDrawer() {
  Object.assign(basicForm, {
    unifiedSocialCreditCode: client.value.unifiedSocialCreditCode || '',
    address: client.value.address || '',
    customerLevel: client.value.maintainedCustomerLevel || CUSTOMER_LEVEL.NORMAL,
    unitStatus: client.value.unitStatus || CLIENT_UNIT_STATUS.NORMAL,
    remark: client.value.remark || '',
  })
  showBasicDrawer.value = true
}

function openIdentityDrawer() {
  if (!canChangeClientIdentity.value) {
    $message.warning(identityChangeDisabledReason.value)
    return
  }
  Object.assign(identityForm, {
    regionCode: client.value.regionCode,
    unitCode: client.value.unitCode || '',
    unitName: client.value.unitName || '',
    reason: '',
  })
  showIdentityDrawer.value = true
}

async function saveIdentity() {
  const error = validateIdentityForm()
  if (error) {
    $message.warning(error)
    return
  }
  saving.value = true
  try {
    await businessApi.clients.changeIdentity(clientId.value, {
      regionCode: identityForm.regionCode,
      unitCode: identityForm.unitCode.trim(),
      unitName: identityForm.unitName.trim(),
      reason: identityForm.reason.trim(),
    })
    $message.success('单位信息已变更')
    showIdentityDrawer.value = false
    await reloadAll()
  }
  finally {
    saving.value = false
  }
}

function validateIdentityForm() {
  if (!identityForm.regionCode)
    return '请选择区划'
  if (!/^\d{6}$/.test(identityForm.unitCode.trim()))
    return '单位编码必须是 6 位数字'
  if (!identityForm.unitName.trim())
    return '请填写单位名称'
  if (!identityForm.reason.trim())
    return '请填写变更原因'
  return ''
}

async function saveBasic() {
  saving.value = true
  try {
    const payload = { ...basicForm }
    if (!canMaintainClientLevel.value) {
      delete payload.customerLevel
      delete payload.unitStatus
    }
    await businessApi.clients.update(clientId.value, payload)
    $message.success('客户资料已保存')
    showBasicDrawer.value = false
    await reloadAll()
  }
  finally {
    saving.value = false
  }
}

function openContactDrawer(row) {
  editingContact.value = row || null
  Object.assign(contactForm, row
    ? { role: row.role, name: row.name, department: row.department || '', phone: row.phone || '', isPrimary: !!row.isPrimary, remark: row.remark || '' }
    : createContactForm())
  showContactDrawer.value = true
}

async function saveContact() {
  if (!contactForm.name.trim()) {
    $message.warning('请填写联系人姓名')
    return
  }
  saving.value = true
  try {
    if (editingContact.value)
      await businessApi.clients.updateContact(clientId.value, editingContact.value.id, contactForm)
    else
      await businessApi.clients.createContact(clientId.value, contactForm)
    $message.success('联系人已保存')
    showContactDrawer.value = false
    await Promise.all([loadClient(), loadContacts()])
  }
  finally {
    saving.value = false
  }
}

function openCredentialDrawer(row) {
  editingCredential.value = row || null
  Object.assign(credentialForm, row
    ? { systemName: row.systemName, username: row.username, password: row.password, loginUrl: row.loginUrl || '', remark: row.remark || '' }
    : createCredentialForm())
  showCredentialDrawer.value = true
}

async function saveCredential() {
  saving.value = true
  try {
    if (editingCredential.value)
      await businessApi.clients.updateCredential(clientId.value, editingCredential.value.id, credentialForm)
    else
      await businessApi.clients.createCredential(clientId.value, credentialForm)
    $message.success('账号资料已保存')
    showCredentialDrawer.value = false
    await Promise.all([loadClient(), loadCredentials()])
  }
  finally {
    saving.value = false
  }
}

async function removeCredential(row) {
  await businessApi.clients.deleteCredential(clientId.value, row.id)
  $message.success('账号资料已删除')
  await Promise.all([loadClient(), loadCredentials()])
}

function handleCredentialSystemChange(systemName) {
  const system = credentialSystemOptions.value.find(item => item.value === systemName)
  if (system)
    credentialForm.loginUrl = system.loginUrl
}

async function copyCredentialField(row, field, label) {
  const value = row[field]
  if (!value) {
    $message.warning(`${label}为空`)
    return
  }
  await businessApi.clients.recordCredentialCopy(clientId.value, row.id, field)
  await navigator.clipboard.writeText(value)
  $message.success(`${label}已复制`)
}

function openMergeDrawer() {
  mergeForm.targetClientId = null
  mergeForm.reason = ''
  clientOptions.value = []
  showMergeDrawer.value = true
  void searchClientOptions('')
}

async function searchClientOptions(keyword) {
  clientOptionsLoading.value = true
  try {
    const { data } = await businessApi.clients.page({ keyword, pageNo: 1, pageSize: CLIENT_MERGE_OPTION_PAGE_SIZE })
    clientOptions.value = (data?.pageData || [])
      .filter(row => row.id !== clientId.value)
      .map(row => ({ label: `${row.regionName} · ${row.unitCode} · ${row.unitName}`, value: row.id }))
  }
  finally {
    clientOptionsLoading.value = false
  }
}

async function submitMerge() {
  saving.value = true
  try {
    await businessApi.clients.merge(clientId.value, mergeForm)
    $message.success('客户已合并')
    showMergeDrawer.value = false
    await reloadAll()
  }
  finally {
    saving.value = false
  }
}

function goCreateOrder() {
  router.push({ path: '/orders', query: { clientId: clientId.value } })
}

function openOrderFromService(row) {
  if (row?.orderNo)
    router.push({ path: '/orders', query: { keyword: row.orderNo } })
}

function openFinanceInvoice(row) {
  if (row?.invoiceNo)
    router.push({ path: '/finance', query: { tab: 'invoice', keyword: row.invoiceNo } })
}

function openFinancePayment(row) {
  router.push({ path: '/finance', query: { tab: 'payment', keyword: row.payerName || row.paymentDate || '' } })
}

function goMergedTarget() {
  if (client.value?.mergedToClientId)
    router.push(`/clients/${client.value.mergedToClientId}`)
}

async function revertMerge(row) {
  saving.value = true
  try {
    await businessApi.clients.revertMerge(clientId.value, row.id)
    $message.success('合并已撤销')
    await reloadAll()
  }
  finally {
    saving.value = false
  }
}

function createBasicForm() {
  return {
    unifiedSocialCreditCode: '',
    address: '',
    customerLevel: CUSTOMER_LEVEL.NORMAL,
    unitStatus: CLIENT_UNIT_STATUS.NORMAL,
    remark: '',
  }
}

function createIdentityForm() {
  return { regionCode: null, unitCode: '', unitName: '', reason: '' }
}

function createContactForm() {
  return { role: CONTACT_ROLE.OTHER, name: '', department: '', phone: '', isPrimary: false, remark: '' }
}

function createCredentialForm() {
  return { systemName: '', username: '', password: '', loginUrl: '', remark: '' }
}

function renderCredentialValue(row, field, label) {
  const value = row[field] || ''
  const text = value || '-'
  const copyField = () => copyCredentialField(row, field, label)
  const focusSelf = event => event.currentTarget?.focus?.()
  return h('div', {
    class: ['credential-copy-value', value ? 'credential-copy-value--copyable' : ''],
    title: value ? `点击聚焦，双击或按 Enter 复制${label}` : '',
    role: value ? 'button' : undefined,
    tabindex: value ? 0 : undefined,
    onClick: value ? focusSelf : undefined,
    onDblclick: value ? copyField : undefined,
    onKeydown(event) {
      if (!value || (event.key !== 'Enter' && event.key !== ' '))
        return
      event.preventDefault()
      void copyField()
    },
  }, [
    h('span', {
      class: 'credential-copy-text',
    }, text),
    value
      ? h(NButton, {
          size: 'tiny',
          quaternary: true,
          circle: true,
          title: `复制${label}`,
          onClick: (event) => {
            event.stopPropagation()
            void copyCredentialField(row, field, label)
          },
        }, { icon: () => h('i', { class: 'i-fe:copy' }) })
      : null,
  ])
}

function renderCredentialUrl(row) {
  if (!row.loginUrl)
    return '-'
  return h('a', {
    class: 'credential-link',
    href: row.loginUrl,
    target: '_blank',
    rel: 'noopener noreferrer',
    title: `打开登录地址：${row.loginUrl}`,
  }, row.loginUrl)
}

function contactRoleLabel(role) {
  return contactRoleMap[role] || role || '-'
}

function contactInitial(name) {
  return String(name || '联').trim().slice(0, 1)
}

async function previewAttachment(row) {
  const { data } = await businessApi.archive.previewAttachment(row.id)
  openBlob(data, row.originalName || row.name)
}

async function downloadAttachment(row) {
  const { data } = await businessApi.archive.downloadAttachment(row.id)
  downloadBlob(data, row.originalName || row.name)
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

function formatMoney(value) {
  return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
</script>

<style scoped>
.action-tooltip-trigger {
  display: inline-flex;
}

.client-detail {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.client-overview-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(620px, 0.9fr);
  align-items: stretch;
  gap: 18px;
  border: 1px solid rgba(18, 48, 78, 0.1);
  border-radius: 12px;
  background:
    radial-gradient(circle at 0 0, rgba(20, 184, 166, 0.08), transparent 28%),
    linear-gradient(135deg, #fff 0%, #fbfdff 100%);
  padding: 18px;
  box-shadow: 0 10px 26px rgba(18, 48, 78, 0.05);
}

.client-summary {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  min-height: 96px;
}

.client-title-row {
  display: flex;
  align-items: center;
  min-width: 0;
}

.client-title-row h2 {
  max-width: 860px;
  margin: 0;
  color: #102033;
  font-size: 21px;
  font-weight: 700;
  line-height: 1.32;
  word-break: break-word;
}

.client-meta-line {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  margin-top: 8px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.4;
}

.client-meta-line span + span::before {
  margin: 0 8px;
  color: #cbd5e1;
  content: '/';
}

.client-status-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.client-kpi-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  align-self: center;
  overflow: hidden;
  border: 1px solid rgba(18, 48, 78, 0.08);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.82);
}

.client-kpi {
  box-sizing: border-box;
  min-width: 0;
  min-height: 76px;
  border-right: 1px solid rgba(18, 48, 78, 0.07);
  background: transparent;
  padding: 13px 14px;
  text-align: left;
  transition:
    background-color 0.2s ease,
    box-shadow 0.2s ease;
}

.client-kpi:last-child {
  border-right: 0;
}

.client-kpi-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.2;
}

.client-kpi-label i {
  color: #94a3b8;
  font-size: 13px;
}

.client-kpi strong {
  display: block;
  margin-top: 8px;
  color: #102033;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
}

.client-kpi--count strong {
  font-size: 21px;
}

.client-kpi--paid strong {
  color: #0f766e;
}

.client-kpi--paid .client-kpi-label i {
  color: #0f766e;
}

.client-kpi--unpaid strong {
  color: #b42318;
}

.client-kpi--unpaid .client-kpi-label i {
  color: #b42318;
}

.detail-section {
  padding: 14px;
  border: 1px solid rgba(18, 48, 78, 0.08);
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 8px 22px rgba(18, 48, 78, 0.035);
}

.detail-section header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.detail-section h3 {
  margin: 0 0 12px;
  color: #102033;
  font-size: 15px;
  font-weight: 700;
}

.detail-section header h3 {
  margin: 0;
}

.info-list {
  display: grid;
  gap: 0;
  overflow: hidden;
  border: 1px solid rgba(18, 48, 78, 0.06);
  border-radius: 8px;
}

.info-item {
  display: grid;
  grid-template-columns: 148px minmax(0, 1fr);
  gap: 18px;
  min-height: 46px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(18, 48, 78, 0.08);
  background: #fff;
}

.info-item:nth-child(2n) {
  background: #fbfdff;
}

.info-item:last-child {
  border-bottom: 0;
}

.info-label {
  color: #607089;
  font-size: 13px;
  line-height: 1.6;
}

.info-value {
  min-width: 0;
  color: #102033;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}

.contact-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.contact-row {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-height: 66px;
  padding: 12px;
  border: 1px solid rgba(18, 48, 78, 0.07);
  border-radius: 8px;
  background: #fff;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.contact-row.is-primary {
  border-color: rgba(24, 160, 88, 0.2);
  background: linear-gradient(90deg, rgba(24, 160, 88, 0.08), rgba(255, 255, 255, 0) 48%), #fff;
}

.contact-row:hover {
  border-color: rgba(0, 104, 255, 0.18);
  box-shadow: 0 8px 22px rgba(18, 48, 78, 0.06);
}

.contact-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  color: #0f7a55;
  font-size: 15px;
  font-weight: 700;
  background: rgba(24, 160, 88, 0.12);
}

.contact-main {
  min-width: 0;
}

.contact-title,
.contact-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.contact-title strong {
  color: #102033;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.4;
}

.contact-meta {
  margin-top: 4px;
  color: #607089;
  font-size: 12px;
  line-height: 1.5;
}

.contact-meta i {
  flex: 0 0 auto;
  font-size: 13px;
}

.credential-copy-value {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 4px;
  border-radius: 4px;
  padding: 2px 4px;
  margin: -2px -4px;
  transition:
    background-color 0.16s ease,
    box-shadow 0.16s ease;
}

.credential-copy-value--copyable {
  cursor: copy;
}

.credential-copy-value--copyable:hover {
  background: rgba(var(--primary-color), 0.08);
}

.credential-copy-value--copyable:focus-visible {
  outline: 0;
  box-shadow: 0 0 0 2px rgba(var(--primary-color), 0.24);
}

.credential-copy-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.credential-link {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  color: #176d78;
  border-radius: 4px;
  padding: 1px 4px;
  margin: -1px -4px;
  text-overflow: ellipsis;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
  transition:
    background-color 0.16s ease,
    color 0.16s ease;
  vertical-align: bottom;
  white-space: nowrap;
}

.credential-link:hover,
.credential-link:focus-visible {
  background: rgba(var(--primary-color), 0.08);
  color: #0f766e;
}

@media (max-width: 1180px) {
  .client-overview-panel {
    grid-template-columns: 1fr;
  }

  .client-kpi-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .client-summary {
    min-height: auto;
    padding: 16px;
  }

  .client-title-row h2 {
    font-size: 18px;
  }

  .info-item {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .contact-row {
    grid-template-columns: 38px minmax(0, 1fr);
  }

  .contact-row > .n-button {
    grid-column: 2;
    justify-self: flex-start;
  }
}

@media (max-width: 640px) {
  .client-kpi-grid {
    grid-template-columns: 1fr 1fr;
  }

  .client-kpi {
    min-height: 64px;
    padding: 14px 16px;
  }

  .client-kpi:nth-child(2n) {
    border-right: 0;
  }

  .client-kpi:last-child {
    grid-column: 1 / -1;
  }
}
</style>
