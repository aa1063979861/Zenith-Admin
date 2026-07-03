<template>
  <CommonPage title="财务管理" class="zenith-data-page">
    <n-result
      v-if="!canViewFinance"
      status="403"
      title="无权查看财务数据"
      description="当前角色未授予财务读取权限"
    />

    <template v-else>
      <div class="finance-summary-grid">
        <div v-for="item in summaryCards" :key="item.key" class="finance-summary-item">
          <span>{{ item.label }}</span>
          <strong>{{ item.currency ? `￥${formatCurrency(item.value)}` : item.value }}</strong>
        </div>
      </div>

      <n-tabs v-model:value="activeTab" type="line" animated class="zenith-data-tabs">
        <n-tab-pane name="contracts" tab="合同底账">
          <NSpace vertical :size="12" class="zenith-data-stack">
            <n-form class="zenith-filter-bar" data-filter-collapsed-rows="all" inline label-placement="left" :show-feedback="false">
              <n-form-item label="关键字">
                <NInput v-model:value="contractQuery.keyword" clearable placeholder="合同号、名称或单位" @keyup.enter="searchContracts" />
              </n-form-item>
              <n-form-item label="状态">
                <NSelect v-model:value="contractQuery.status" clearable class="w-120px" :options="contractStatusOptions" />
              </n-form-item>
              <n-form-item class="zenith-filter-actions">
                <NSpace>
                  <NButton type="primary" @click="searchContracts">
                    <i class="i-fe:search mr-4" />
                    查询
                  </NButton>
                  <NButton secondary @click="resetContracts">
                    <i class="i-fe:rotate-ccw mr-4" />
                    重置
                  </NButton>
                  <NButton v-permission="'MaintainFinanceContract'" type="primary" secondary @click="openDocumentDrawer('contract')">
                    <i class="i-fe:file-plus mr-4" />
                    新增合同
                  </NButton>
                </NSpace>
              </n-form-item>
            </n-form>
            <EnhancedDataTable
              storage-key="business.finance.contracts"
              :columns="enhancedContractColumns"
              :data="contracts"
              :pagination="contractPagination"
              :summary="contractTableSummary"
              mobile-primary-key="clientName"
              mobile-status-key="status"
              :mobile-secondary-keys="['contractNo', 'signedAt', 'totalAmount', 'lineCount']"
              :row-action="row => openDetail('contract', row.id)"
              remote
              size="small"
              @update:page="page => handlePageChange(contractPagination, loadContracts, page)"
              @update:page-size="pageSize => handlePageSizeChange(contractPagination, loadContracts, pageSize)"
              @update:sorter="sorter => handleSorterChange(contractSorter, contractPagination, loadContracts, sorter)"
            />
          </NSpace>
        </n-tab-pane>

        <n-tab-pane name="invoice" tab="发票底账">
          <NSpace vertical :size="12" class="zenith-data-stack">
            <n-form class="zenith-filter-bar" data-filter-collapsed-rows="all" inline label-placement="left" :show-feedback="false">
              <n-form-item label="关键字">
                <NInput v-model:value="invoiceQuery.keyword" clearable placeholder="发票号、合同号或单位" @keyup.enter="searchInvoices" />
              </n-form-item>
              <n-form-item label="收款">
                <NSelect v-model:value="invoiceQuery.paymentStatus" clearable class="w-130px" :options="invoicePaymentStatusOptions" />
              </n-form-item>
              <n-form-item label="送达">
                <NSelect v-model:value="invoiceQuery.deliveryStatus" clearable class="w-130px" :options="deliveryStatusOptions" />
              </n-form-item>
              <n-form-item class="zenith-filter-actions">
                <NSpace>
                  <NButton type="primary" @click="searchInvoices">
                    <i class="i-fe:search mr-4" />
                    查询
                  </NButton>
                  <NButton secondary @click="resetInvoices">
                    <i class="i-fe:rotate-ccw mr-4" />
                    重置
                  </NButton>
                  <NButton v-permission="'MaintainFinanceInvoice'" type="primary" secondary @click="openDocumentDrawer('invoice')">
                    <i class="i-fe:file-text mr-4" />
                    新增发票
                  </NButton>
                </NSpace>
              </n-form-item>
            </n-form>
            <EnhancedDataTable
              storage-key="business.finance.invoices"
              :columns="enhancedInvoiceColumns"
              :data="invoices"
              :pagination="invoicePagination"
              :summary="invoiceTableSummary"
              mobile-primary-key="clientName"
              mobile-status-key="paymentStatus"
              :mobile-secondary-keys="['invoiceNo', 'invoiceDate', 'invoiceAmount', 'matchedAmount']"
              :mobile-meta-keys="['deliveryStatus']"
              :row-action="row => openDetail('invoice', row.id)"
              remote
              size="small"
              @update:page="page => handlePageChange(invoicePagination, loadInvoices, page)"
              @update:page-size="pageSize => handlePageSizeChange(invoicePagination, loadInvoices, pageSize)"
              @update:sorter="sorter => handleSorterChange(invoiceSorter, invoicePagination, loadInvoices, sorter)"
            />
          </NSpace>
        </n-tab-pane>

        <n-tab-pane name="payment" tab="收款匹配">
          <NSpace vertical :size="12" class="zenith-data-stack">
            <n-form class="zenith-filter-bar" data-filter-collapsed-rows="all" inline label-placement="left" :show-feedback="false">
              <n-form-item label="关键字">
                <NInput v-model:value="paymentQuery.keyword" clearable placeholder="付款方、单位或备注" @keyup.enter="searchPayments" />
              </n-form-item>
              <n-form-item label="匹配">
                <NSelect v-model:value="paymentQuery.matchStatus" clearable class="w-130px" :options="paymentMatchStatusOptions" />
              </n-form-item>
              <n-form-item class="zenith-filter-actions">
                <NSpace>
                  <NButton type="primary" @click="searchPayments">
                    <i class="i-fe:search mr-4" />
                    查询
                  </NButton>
                  <NButton secondary @click="resetPayments">
                    <i class="i-fe:rotate-ccw mr-4" />
                    重置
                  </NButton>
                  <NButton v-permission="'MaintainFinancePayment'" type="primary" @click="openPaymentDrawer()">
                    <i class="i-fe:plus mr-4" />
                    新增收款
                  </NButton>
                  <NButton v-permission="'ImportFinancePayment'" type="primary" secondary @click="openPaymentImportDrawer">
                    <i class="i-fe:upload mr-4" />
                    导入流水
                  </NButton>
                </NSpace>
              </n-form-item>
            </n-form>
            <EnhancedDataTable
              storage-key="business.finance.payments"
              :columns="enhancedPaymentColumns"
              :data="paymentRows"
              :pagination="paymentPagination"
              :summary="paymentTableSummary"
              mobile-primary-key="payerName"
              mobile-status-key="matchStatus"
              :mobile-secondary-keys="['paymentDate', 'clientName', 'amount', 'matchedAmount']"
              :mobile-meta-keys="['bankRemark']"
              :row-action="row => openDetail('payment', row.id)"
              remote
              size="small"
              @update:page="page => handlePageChange(paymentPagination, loadPayments, page)"
              @update:page-size="pageSize => handlePageSizeChange(paymentPagination, loadPayments, pageSize)"
              @update:sorter="sorter => handleSorterChange(paymentSorter, paymentPagination, loadPayments, sorter)"
            />
          </NSpace>
        </n-tab-pane>

        <n-tab-pane name="reconcile" tab="服务项对账">
          <NSpace vertical :size="12" class="zenith-data-stack">
            <n-form class="zenith-filter-bar" data-filter-collapsed-rows="all" inline label-placement="left" :show-feedback="false">
              <n-form-item label="关键字">
                <NInput v-model:value="serviceItemQuery.keyword" clearable placeholder="订单、单位、人员或服务项" @keyup.enter="searchServiceItems" />
              </n-form-item>
              <n-form-item label="年度">
                <AppDatePicker v-model:formatted-value="serviceItemYearText" type="year" value-format="yyyy" clearable class="w-120px" placeholder="全部年度" />
              </n-form-item>
              <n-form-item label="收款">
                <NSelect v-model:value="serviceItemQuery.collectionStatus" clearable class="w-130px" :options="collectionStatusOptions" />
              </n-form-item>
              <n-form-item class="zenith-filter-actions">
                <NSpace>
                  <NButton type="primary" @click="searchServiceItems">
                    <i class="i-fe:search mr-4" />
                    查询
                  </NButton>
                  <NButton secondary @click="resetServiceItems">
                    <i class="i-fe:rotate-ccw mr-4" />
                    重置
                  </NButton>
                  <NButton v-if="canOpenCommission" secondary @click="openCommission">
                    <i class="i-fe:percent mr-4" />
                    提成结算
                  </NButton>
                </NSpace>
              </n-form-item>
            </n-form>
            <EnhancedDataTable
              storage-key="business.finance.service-items"
              :columns="enhancedServiceItemColumns"
              :data="serviceItems"
              :pagination="serviceItemPagination"
              :summary="serviceItemTableSummary"
              mobile-primary-key="clientName"
              mobile-status-key="collectionStatus"
              :mobile-secondary-keys="['orderNo', 'serviceName', 'billableAmount', 'receivedAmount']"
              :row-action="openServiceItemOrder"
              remote
              size="small"
              @update:page="page => handlePageChange(serviceItemPagination, loadServiceItems, page)"
              @update:page-size="pageSize => handlePageSizeChange(serviceItemPagination, loadServiceItems, pageSize)"
              @update:sorter="sorter => handleSorterChange(serviceItemSorter, serviceItemPagination, loadServiceItems, sorter)"
            />
          </NSpace>
        </n-tab-pane>
      </n-tabs>

      <n-drawer v-model:show="documentDrawerVisible" width="min(880px, 100vw)">
        <n-drawer-content :title="documentDrawerTitle" closable>
          <n-form :model="documentForm" label-placement="left" label-align="left" :label-width="96">
            <n-grid :cols="2" :x-gap="16">
              <n-form-item-gi :label="documentType === 'contract' ? '合同编号' : '发票号码'">
                <NInput v-model:value="documentForm.no" />
              </n-form-item-gi>
              <n-form-item-gi label="客户单位">
                <NSelect v-model:value="documentForm.clientId" filterable clearable :disabled="isInvoiceAccountingLocked" :options="clientOptions" @update:value="handleDocumentClientChange" />
              </n-form-item-gi>
              <n-form-item-gi v-if="documentType === 'contract'" label="合同名称">
                <NInput v-model:value="documentForm.title" />
              </n-form-item-gi>
              <n-form-item-gi v-if="documentType === 'invoice'" label="关联合同">
                <NSelect v-model:value="documentForm.contractId" filterable clearable :disabled="isInvoiceAccountingLocked" :options="contractOptions" @update:value="fillInvoiceFromContract" />
              </n-form-item-gi>
              <n-form-item-gi v-if="documentType === 'invoice'" label="购买方">
                <NInput v-model:value="documentForm.buyerName" />
              </n-form-item-gi>
              <n-form-item-gi :label="documentType === 'contract' ? '合同金额' : '发票金额'">
                <n-input-number v-model:value="documentForm.amount" class="w-full" :min="0" :precision="2" :show-button="false" :disabled="isInvoiceAccountingLocked" />
              </n-form-item-gi>
              <n-form-item-gi :label="documentType === 'contract' ? '签订日期' : '开票日期'">
                <AppDatePicker v-model:formatted-value="documentForm.date" class="w-full" />
              </n-form-item-gi>
              <n-form-item-gi v-if="documentType === 'contract'" label="开始日期">
                <AppDatePicker v-model:formatted-value="documentForm.startsAt" clearable class="w-full" />
              </n-form-item-gi>
              <n-form-item-gi v-if="documentType === 'contract'" label="结束日期">
                <AppDatePicker v-model:formatted-value="documentForm.endsAt" clearable class="w-full" />
              </n-form-item-gi>
              <n-form-item-gi v-if="documentType === 'contract'" label="状态">
                <NSelect v-model:value="documentForm.status" :options="contractStatusOptions" />
              </n-form-item-gi>
              <n-form-item-gi v-if="documentType === 'invoice'" label="送达状态">
                <NSelect v-model:value="documentForm.deliveryStatus" :options="deliveryStatusOptions" />
              </n-form-item-gi>
              <n-form-item-gi v-if="documentType === 'invoice'" label="发票状态">
                <NSelect v-model:value="documentForm.status" :options="invoiceStatusOptions" :disabled="isInvoiceAccountingLocked" />
              </n-form-item-gi>
            </n-grid>
            <n-form-item label="明细">
              <n-dynamic-input v-model:value="documentForm.lines" :on-create="createDocumentLine" :disabled="isInvoiceAccountingLocked">
                <template #default="{ value }">
                  <div class="finance-line-row">
                    <NSelect
                      v-model:value="value.orderServiceItemId"
                      filterable
                      :disabled="isInvoiceAccountingLocked"
                      :options="serviceItemOptions"
                      @update:value="serviceItemId => fillLineAmount(value, serviceItemId)"
                    />
                    <n-input-number v-model:value="value.amount" class="line-amount" :min="0" :precision="2" :show-button="false" :disabled="isInvoiceAccountingLocked" />
                    <NInput v-model:value="value.description" class="line-description" :disabled="isInvoiceAccountingLocked" />
                  </div>
                </template>
              </n-dynamic-input>
            </n-form-item>
            <n-form-item v-if="documentType === 'invoice'" label="附件">
              <NSpace vertical :size="8" class="w-full">
                <n-upload :max="1" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" :default-upload="false" @change="handleInvoiceAttachmentFileChange">
                  <n-upload-dragger>
                    <div class="finance-import-uploader">
                      <i class="i-fe:file-plus" />
                      <span>{{ invoiceAttachmentFile ? invoiceAttachmentFile.name : '选择发票附件' }}</span>
                    </div>
                  </n-upload-dragger>
                </n-upload>
                <NSpace v-if="invoiceAttachmentRecognitionItems.length" size="small">
                  <NTag v-for="item in invoiceAttachmentRecognitionItems" :key="item.key" size="small" type="info">
                    {{ item.label }}：{{ item.value }}
                  </NTag>
                </NSpace>
              </NSpace>
            </n-form-item>
            <n-form-item label="备注">
              <NInput v-model:value="documentForm.remark" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" />
            </n-form-item>
          </n-form>
          <template #footer>
            <NSpace justify="end">
              <NButton @click="documentDrawerVisible = false">
                取消
              </NButton>
              <NButton type="primary" :loading="savingDocument" @click="saveDocument">
                保存
              </NButton>
            </NSpace>
          </template>
        </n-drawer-content>
      </n-drawer>

      <n-drawer v-model:show="paymentDrawerVisible" width="min(620px, 100vw)">
        <n-drawer-content :title="editingPayment?.id ? '编辑收款' : '新增收款'" closable>
          <n-form label-placement="left" label-align="left" :label-width="92">
            <n-form-item label="收款日期">
              <AppDatePicker v-model:formatted-value="paymentForm.paymentDate" class="w-full" />
            </n-form-item>
            <n-form-item label="客户单位">
              <NSelect v-model:value="paymentForm.clientId" filterable clearable :options="clientOptions" />
            </n-form-item>
            <n-form-item label="付款方">
              <NInput v-model:value="paymentForm.payerName" />
            </n-form-item>
            <n-form-item label="收款账户">
              <NInput v-model:value="paymentForm.bankAccount" />
            </n-form-item>
            <n-form-item label="流水号">
              <NInput v-model:value="paymentForm.bankSerialNo" />
            </n-form-item>
            <n-form-item label="收款金额">
              <n-input-number v-model:value="paymentForm.amount" class="w-full" :min="0" :precision="2" :show-button="false" />
            </n-form-item>
            <n-form-item label="银行备注">
              <NInput v-model:value="paymentForm.bankRemark" />
            </n-form-item>
            <n-form-item label="备注">
              <NInput v-model:value="paymentForm.remark" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" />
            </n-form-item>
          </n-form>
          <template #footer>
            <NSpace justify="end">
              <NButton @click="paymentDrawerVisible = false">
                取消
              </NButton>
              <NButton type="primary" :loading="savingPayment" @click="savePayment">
                保存
              </NButton>
            </NSpace>
          </template>
        </n-drawer-content>
      </n-drawer>

      <n-modal v-model:show="matchModalVisible" preset="card" title="匹配收款发票" class="finance-match-modal" style="width: min(720px, calc(100vw - 32px));">
        <n-form label-placement="left" label-align="left" :label-width="88">
          <n-form-item label="收款">
            <NInput :value="selectedPayment ? `${selectedPayment.paymentDate} / ${selectedPayment.payerName} / ￥${formatCurrency(selectedPayment.amount)}` : ''" readonly />
          </n-form-item>
          <n-form-item label="发票匹配">
            <n-dynamic-input v-model:value="matchForm.matches" :on-create="createMatchLine">
              <template #default="{ value }">
                <div class="finance-line-row">
                  <NSelect
                    v-model:value="value.invoiceId"
                    filterable
                    :options="matchInvoiceOptions"
                    @update:value="invoiceId => fillMatchAmount(value, invoiceId)"
                  />
                  <n-input-number v-model:value="value.matchedAmount" class="line-amount" :min="0" :precision="2" :show-button="false" />
                  <NInput v-model:value="value.remark" class="line-description" />
                </div>
              </template>
            </n-dynamic-input>
          </n-form-item>
        </n-form>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="matchModalVisible = false">
              取消
            </NButton>
            <NButton type="primary" :loading="savingMatch" @click="saveMatch">
              保存匹配
            </NButton>
          </NSpace>
        </template>
      </n-modal>

      <n-modal v-model:show="invoiceAttachmentModalVisible" preset="card" title="上传发票附件" style="width: min(560px, calc(100vw - 32px));">
        <n-form label-placement="left" label-align="left" :label-width="88">
          <n-form-item label="发票">
            <NInput :value="selectedInvoiceForAttachment ? `${selectedInvoiceForAttachment.invoiceNo} / ${selectedInvoiceForAttachment.clientName}` : ''" readonly />
          </n-form-item>
          <n-form-item label="文件">
            <n-upload :max="1" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" :default-upload="false" @change="handleInvoiceAttachmentFileChange">
              <n-upload-dragger>
                <div class="finance-import-uploader">
                  <i class="i-fe:file-plus" />
                  <span>{{ invoiceAttachmentFile ? invoiceAttachmentFile.name : '选择发票附件' }}</span>
                </div>
              </n-upload-dragger>
            </n-upload>
          </n-form-item>
          <n-form-item label="附件名">
            <NInput v-model:value="invoiceAttachmentForm.name" />
          </n-form-item>
          <n-form-item label="备注">
            <NInput v-model:value="invoiceAttachmentForm.remark" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" />
          </n-form-item>
        </n-form>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="invoiceAttachmentModalVisible = false">
              取消
            </NButton>
            <NButton type="primary" :loading="uploadingInvoiceAttachment" :disabled="!invoiceAttachmentFile" @click="uploadInvoiceAttachment">
              上传
            </NButton>
          </NSpace>
        </template>
      </n-modal>

      <n-drawer v-model:show="paymentImportDrawerVisible" width="min(1080px, 100vw)">
        <n-drawer-content title="导入银行流水" closable>
          <n-tabs v-model:value="paymentImportActiveTab" type="line" animated>
            <n-tab-pane name="upload" tab="上传解析">
              <NSpace vertical :size="12">
                <n-upload :max="1" accept=".xlsx" :default-upload="false" @change="handlePaymentImportFileChange">
                  <n-upload-dragger>
                    <div class="finance-import-uploader">
                      <i class="i-fe:upload-cloud" />
                      <span>{{ paymentImportFile ? paymentImportFile.name : '选择银行流水 xlsx 文件' }}</span>
                    </div>
                  </n-upload-dragger>
                </n-upload>
                <NSpace>
                  <NButton type="primary" :loading="importingPayments" :disabled="!paymentImportFile" @click="submitPaymentImport">
                    解析预览
                  </NButton>
                  <NButton
                    v-if="selectedPaymentImport && selectedPaymentImport.status !== IMPORT_BATCH_STATUS.CONFIRMED"
                    type="success"
                    secondary
                    :loading="confirmingPaymentImport"
                    :disabled="!paymentImportCanConfirm"
                    @click="confirmPaymentImport(selectedPaymentImport)"
                  >
                    确认当前明细
                  </NButton>
                </NSpace>
              </NSpace>
            </n-tab-pane>
            <n-tab-pane name="records" tab="导入记录">
              <EnhancedDataTable
                storage-key="business.finance.payment-imports"
                :columns="enhancedPaymentImportBatchColumns"
                :data="paymentImportBatches"
                :pagination="paymentImportBatchPagination"
                :row-action="openPaymentImportDetail"
                remote
                size="small"
                @update:page="handlePaymentImportBatchPageChange"
                @update:page-size="handlePaymentImportBatchPageSizeChange"
              />
            </n-tab-pane>
          </n-tabs>
          <EnhancedDataTable
            v-if="selectedPaymentImport"
            class="mt-12"
            storage-key="business.finance.payment-import-rows"
            :columns="enhancedPaymentImportRowColumns"
            :data="paymentImportRows"
            :pagination="paymentImportRowPagination"
            size="small"
            remote
            @update:page="handlePaymentImportRowPageChange"
            @update:page-size="handlePaymentImportRowPageSizeChange"
          />
        </n-drawer-content>
      </n-drawer>

      <n-drawer v-model:show="detailDrawerVisible" width="min(920px, 100vw)">
        <n-drawer-content :title="detailTitle" closable>
          <n-spin :show="detailLoading">
            <n-descriptions v-if="detailRecord" label-placement="left" bordered size="small" :column="2">
              <n-descriptions-item v-for="item in detailDescriptions" :key="item.label" :label="item.label">
                {{ item.value }}
              </n-descriptions-item>
            </n-descriptions>
            <n-empty v-else-if="!detailLoading" description="暂无详情" />
            <EnhancedDataTable
              v-if="detailLines.length"
              class="mt-12"
              storage-key="business.finance.detail.lines"
              :columns="detailLineColumns"
              :data="detailLines"
              :pagination="false"
              size="small"
            />
          </n-spin>
        </n-drawer-content>
      </n-drawer>
    </template>
  </CommonPage>
</template>

<script setup>
import { NButton, NInput, NSelect, NSpace, NTag } from 'naive-ui'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { useRoute, useRouter } from 'vue-router'
import { AppDatePicker, EnhancedDataTable } from '@/components/common'
import { hasPermission, withPermission } from '@/directives'
import { ALL_PAGE_SIZE, createTablePagination, createTableSorter, createTableSummary, DEFAULT_PAGE_SIZE, enhanceTableColumns, formatDate, getTableSorterParams, normalizeTableSorter } from '@/utils'
import { businessApi } from '../shared/api'
import {
  CONTRACT_STATUS,
  CONTRACT_STATUS_OPTIONS,
  IMPORT_BATCH_STATUS,
  INVOICE_DELIVERY_STATUS,
  INVOICE_DELIVERY_STATUS_OPTIONS,
  INVOICE_PAYMENT_STATUS,
  INVOICE_PAYMENT_STATUS_OPTIONS,
  INVOICE_STATUS,
  INVOICE_STATUS_OPTIONS,
  PAYMENT_MATCH_STATUS,
  PAYMENT_MATCH_STATUS_OPTIONS,
  SERVICE_COLLECTION_STATUS,
  SERVICE_COLLECTION_STATUS_OPTIONS,
} from '../shared/constants'
import { formatCurrency } from '../shared/format'

defineOptions({ name: 'FinanceSettlement' })
const PDF_TEXT_RECOGNITION_MAX_BYTES = 10 * 1024 * 1024
const PDF_TEXT_RECOGNITION_MAX_PAGES = 3
let pdfjsLibCache = null

const router = useRouter()
const route = useRoute()
const activeTab = ref('contracts')
const summary = ref({})
const contracts = ref([])
const invoices = ref([])
const paymentRows = ref([])
const serviceItems = ref([])
const clientOptions = ref([])
const serviceItemRows = ref([])
const contractOptions = ref([])
const matchInvoiceRows = ref([])
const detailRecord = ref(null)
const detailLines = ref([])
const detailKind = ref('')
const documentDrawerVisible = ref(false)
const paymentDrawerVisible = ref(false)
const matchModalVisible = ref(false)
const invoiceAttachmentModalVisible = ref(false)
const paymentImportDrawerVisible = ref(false)
const detailDrawerVisible = ref(false)
const detailLoading = ref(false)
const savingDocument = ref(false)
const savingPayment = ref(false)
const savingMatch = ref(false)
const importingPayments = ref(false)
const confirmingPaymentImport = ref(false)
const uploadingInvoiceAttachment = ref(false)
const documentType = ref('contract')
const editingDocument = ref(null)
const editingPayment = ref(null)
const selectedPayment = ref(null)
const selectedPaymentImport = ref(null)
const selectedInvoiceForAttachment = ref(null)
const paymentImportActiveTab = ref('upload')
const paymentImportFile = ref(null)
const invoiceAttachmentFile = ref(null)
const invoiceAttachmentRecognized = ref(null)
const paymentImportBatches = ref([])
const paymentImportRows = ref([])
const paymentImportRowDecisions = reactive({})

const contractQuery = reactive({ keyword: '', status: null })
const invoiceQuery = reactive({ keyword: '', paymentStatus: null, deliveryStatus: null })
const paymentQuery = reactive({ keyword: '', matchStatus: null })
const serviceItemQuery = reactive({ keyword: '', serviceYear: null, collectionStatus: null })
const contractPagination = reactive(createTablePagination({ page: 1, pageSize: DEFAULT_PAGE_SIZE, itemCount: 0 }))
const invoicePagination = reactive(createTablePagination({ page: 1, pageSize: DEFAULT_PAGE_SIZE, itemCount: 0 }))
const paymentPagination = reactive(createTablePagination({ page: 1, pageSize: DEFAULT_PAGE_SIZE, itemCount: 0 }))
const serviceItemPagination = reactive(createTablePagination({ page: 1, pageSize: DEFAULT_PAGE_SIZE, itemCount: 0 }))
const paymentImportBatchPagination = reactive(createTablePagination({ page: 1, pageSize: DEFAULT_PAGE_SIZE, itemCount: 0 }))
const paymentImportRowPagination = reactive(createTablePagination({ page: 1, pageSize: DEFAULT_PAGE_SIZE, itemCount: 0 }))
const contractSorter = ref(createTableSorter())
const invoiceSorter = ref(createTableSorter())
const paymentSorter = ref(createTableSorter())
const serviceItemSorter = ref(createTableSorter())

const documentForm = reactive(defaultDocumentForm())
const paymentForm = reactive(defaultPaymentForm())
const matchForm = reactive({ matches: [] })
const invoiceAttachmentForm = reactive({ name: '', remark: '' })

const contractStatusOptions = CONTRACT_STATUS_OPTIONS
const invoiceStatusOptions = INVOICE_STATUS_OPTIONS
const deliveryStatusOptions = INVOICE_DELIVERY_STATUS_OPTIONS
const invoicePaymentStatusOptions = INVOICE_PAYMENT_STATUS_OPTIONS
const paymentMatchStatusOptions = PAYMENT_MATCH_STATUS_OPTIONS
const collectionStatusOptions = SERVICE_COLLECTION_STATUS_OPTIONS
const paymentImportBatchStatusMap = {
  parsed: { label: '待确认', type: 'warning' },
  confirmed: { label: '已入库', type: 'success' },
  failed: { label: '失败', type: 'error' },
}
const paymentImportRowStatusMap = {
  valid: { label: '可入库', type: 'success' },
  warning: { label: '需确认', type: 'warning' },
  error: { label: '错误', type: 'error' },
  imported: { label: '已入库', type: 'success' },
  skipped: { label: '已跳过', type: 'default' },
}

const summaryCards = computed(() => [
  { key: 'receivableAmount', label: '服务项应收', value: summary.value.receivableAmount || 0, currency: true },
  { key: 'receivedAmount', label: '服务项已收', value: summary.value.receivedAmount || 0, currency: true },
  { key: 'invoiceAmount', label: '开票金额', value: summary.value.invoiceAmount || 0, currency: true },
  { key: 'paymentUnmatchedAmount', label: '待匹配收款', value: summary.value.paymentUnmatchedAmount || 0, currency: true },
  { key: 'unmatchedPaymentCount', label: '待匹配笔数', value: summary.value.unmatchedPaymentCount || 0 },
])
const canOpenCommission = computed(() => hasPermission('CommissionRules'))

const serviceItemOptions = computed(() => serviceItemRows.value.map(row => ({
  label: `${row.orderNo} / ${row.serviceName} / ${row.serviceYear} / ￥${formatCurrency(row.billableAmount)}`,
  value: row.id,
  row,
})))
const isInvoiceAccountingLocked = computed(() => documentType.value === 'invoice' && Number(editingDocument.value?.matchedAmount || 0) > 0)
const invoiceAttachmentRecognitionItems = computed(() => {
  const recognized = invoiceAttachmentRecognized.value
  if (!recognized)
    return []
  return [
    { key: 'invoiceNo', label: '发票号', value: recognized.invoiceNo },
    { key: 'invoiceDate', label: '日期', value: recognized.invoiceDate },
    { key: 'invoiceAmount', label: '金额', value: recognized.invoiceAmount ? `￥${formatCurrency(recognized.invoiceAmount)}` : '' },
    { key: 'buyerName', label: '购买方', value: recognized.buyerName },
  ].filter(item => item.value)
})
const matchInvoiceOptions = computed(() => matchInvoiceRows.value.map(row => ({
  label: `${row.invoiceNo} / ${row.clientName} / 未收￥${formatCurrency(row.unmatchedAmount)}`,
  value: row.id,
  row,
})))

const enhancedContractColumns = computed(() => enhanceTableColumns(contractColumns, { remote: true }))
const enhancedInvoiceColumns = computed(() => enhanceTableColumns(invoiceColumns, { remote: true }))
const enhancedPaymentColumns = computed(() => enhanceTableColumns(paymentColumns, { remote: true }))
const enhancedServiceItemColumns = computed(() => enhanceTableColumns(serviceItemColumns, { remote: true }))
const enhancedPaymentImportBatchColumns = computed(() => enhanceTableColumns(paymentImportBatchColumns, { remote: true }))
const enhancedPaymentImportRowColumns = computed(() => enhanceTableColumns(paymentImportRowColumns, { remote: true }))
const paymentImportCanConfirm = computed(() => paymentImportRows.value.some(row => isPaymentImportRowPending(row)))
const contractTableSummary = computed(() => createTableSummary([{ key: 'totalAmount', formatter: value => `￥${formatCurrency(value)}` }], { columns: enhancedContractColumns.value, labelKey: 'contractNo' }))
const invoiceTableSummary = computed(() => createTableSummary([
  { key: 'invoiceAmount', formatter: value => `￥${formatCurrency(value)}` },
  { key: 'matchedAmount', formatter: value => `￥${formatCurrency(value)}` },
], { columns: enhancedInvoiceColumns.value, labelKey: 'invoiceNo' }))
const paymentTableSummary = computed(() => createTableSummary([
  { key: 'amount', formatter: value => `￥${formatCurrency(value)}` },
  { key: 'matchedAmount', formatter: value => `￥${formatCurrency(value)}` },
], { columns: enhancedPaymentColumns.value, labelKey: 'paymentDate' }))
const serviceItemTableSummary = computed(() => createTableSummary([
  { key: 'billableAmount', formatter: value => `￥${formatCurrency(value)}` },
  { key: 'receivedAmount', formatter: value => `￥${formatCurrency(value)}` },
  { key: 'unreceivedAmount', formatter: value => `￥${formatCurrency(value)}` },
], { columns: enhancedServiceItemColumns.value, labelKey: 'orderNo' }))

const canViewFinance = computed(() => hasPermission('ViewFinance'))
const serviceItemYearText = computed({
  get: () => serviceItemQuery.serviceYear ? String(serviceItemQuery.serviceYear) : null,
  set: value => serviceItemQuery.serviceYear = value ? Number(value) : null,
})
const documentDrawerTitle = computed(() => `${editingDocument.value?.id ? '编辑' : '新增'}${documentType.value === 'contract' ? '合同' : '发票'}`)
const detailTitle = computed(() => detailKind.value === 'payment' ? '收款详情' : detailKind.value === 'invoice' ? '发票详情' : '合同详情')
const detailDescriptions = computed(() => {
  if (!detailRecord.value)
    return []
  if (detailKind.value === 'payment') {
    return [
      { label: '收款日期', value: detailRecord.value.paymentDate },
      { label: '付款方', value: detailRecord.value.payerName },
      { label: '收款金额', value: `￥${formatCurrency(detailRecord.value.amount)}` },
      { label: '已匹配', value: `￥${formatCurrency(detailRecord.value.matchedAmount)}` },
    ]
  }
  if (detailKind.value === 'invoice') {
    return [
      { label: '发票号', value: detailRecord.value.invoiceNo },
      { label: '单位', value: detailRecord.value.clientName },
      { label: '发票金额', value: `￥${formatCurrency(detailRecord.value.invoiceAmount)}` },
      { label: '已收款', value: `￥${formatCurrency(detailRecord.value.matchedAmount)}` },
    ]
  }
  return [
    { label: '合同号', value: detailRecord.value.contractNo },
    { label: '单位', value: detailRecord.value.clientName },
    { label: '合同名称', value: detailRecord.value.title },
    { label: '合同金额', value: `￥${formatCurrency(detailRecord.value.totalAmount)}` },
  ]
})

const contractColumns = [
  { title: '合同编号', key: 'contractNo', width: 150, remoteSortable: true },
  { title: '单位名称', key: 'clientName', minWidth: 240, ellipsis: { tooltip: true }, remoteSortable: true },
  { title: '合同名称', key: 'title', minWidth: 220, ellipsis: { tooltip: true }, remoteSortable: true },
  { title: '金额', key: 'totalAmount', width: 120, remoteSortable: true, render: row => `￥${formatCurrency(row.totalAmount)}` },
  { title: '签订日期', key: 'signedAt', width: 120, remoteSortable: true, render: row => row.signedAt || '-' },
  { title: '明细数', key: 'lineCount', width: 90 },
  { title: '状态', key: 'status', width: 90, remoteSortable: true, render: row => renderStatusTag(row.status, row.status === CONTRACT_STATUS.SIGNED ? 'success' : row.status === CONTRACT_STATUS.DRAFT ? 'warning' : 'default') },
  { title: '备注', key: 'remark', minWidth: 180, ellipsis: { tooltip: true }, defaultHidden: true, render: row => row.remark || '-' },
  {
    title: '操作',
    key: 'actions',
    width: 200,
    align: 'right',
    fixed: 'right',
    render(row) {
      return h(NSpace, { justify: 'end', size: 8 }, {
        default: () => [
          h(NButton, { size: 'small', secondary: true, onClick: () => openDetail('contract', row.id) }, { default: () => '详情' }),
          withPermission(h(NButton, { size: 'small', secondary: true, type: 'primary', onClick: () => openDocumentDrawer('contract', row) }, { default: () => '编辑' }), 'MaintainFinanceContract'),
        ].filter(Boolean),
      })
    },
  },
]

const invoiceColumns = [
  { title: '发票号', key: 'invoiceNo', width: 150, remoteSortable: true },
  { title: '开票日期', key: 'invoiceDate', width: 120, remoteSortable: true },
  { title: '单位名称', key: 'clientName', minWidth: 240, ellipsis: { tooltip: true }, remoteSortable: true },
  { title: '合同号', key: 'contractNo', width: 140, render: row => row.contractNo || '-' },
  { title: '发票金额', key: 'invoiceAmount', width: 120, remoteSortable: true, render: row => `￥${formatCurrency(row.invoiceAmount)}` },
  { title: '已匹配收款', key: 'matchedAmount', width: 130, remoteSortable: true, render: row => `￥${formatCurrency(row.matchedAmount)}` },
  { title: '付款状态', key: 'paymentStatus', width: 110, remoteSortable: true, render: row => renderStatusTag(row.paymentStatus, row.paymentStatus === INVOICE_PAYMENT_STATUS.PAID ? 'success' : row.paymentStatus === INVOICE_PAYMENT_STATUS.PARTIAL ? 'warning' : 'error') },
  { title: '送达状态', key: 'deliveryStatus', width: 110, remoteSortable: true },
  { title: '发票状态', key: 'status', width: 100, remoteSortable: true },
  {
    title: '操作',
    key: 'actions',
    width: 200,
    align: 'right',
    fixed: 'right',
    render(row) {
      return h(NSpace, { justify: 'end', size: 8 }, {
        default: () => [
          h(NButton, { size: 'small', secondary: true, onClick: () => openDetail('invoice', row.id) }, { default: () => '详情' }),
          withPermission(h(NButton, { size: 'small', secondary: true, type: 'primary', onClick: () => openDocumentDrawer('invoice', row) }, { default: () => '编辑' }), 'MaintainFinanceInvoice'),
          withPermission(h(NButton, { size: 'small', secondary: true, type: 'info', onClick: () => openInvoiceAttachmentModal(row) }, { default: () => '附件' }), 'MaintainFinanceInvoice'),
        ].filter(Boolean),
      })
    },
  },
]

const paymentColumns = [
  { title: '收款日期', key: 'paymentDate', width: 120, remoteSortable: true },
  { title: '付款方', key: 'payerName', minWidth: 220, ellipsis: { tooltip: true }, remoteSortable: true },
  { title: '客户单位', key: 'clientName', minWidth: 220, ellipsis: { tooltip: true }, remoteSortable: true, render: row => row.clientName || '-' },
  { title: '金额', key: 'amount', width: 120, remoteSortable: true, render: row => `￥${formatCurrency(row.amount)}` },
  { title: '已匹配', key: 'matchedAmount', width: 120, remoteSortable: true, render: row => `￥${formatCurrency(row.matchedAmount)}` },
  { title: '匹配状态', key: 'matchStatus', width: 110, remoteSortable: true, render: row => renderStatusTag(row.matchStatus, row.matchStatus === PAYMENT_MATCH_STATUS.MATCHED ? 'success' : row.matchStatus === PAYMENT_MATCH_STATUS.PARTIAL ? 'warning' : 'error') },
  { title: '银行备注', key: 'bankRemark', minWidth: 220, ellipsis: { tooltip: true }, render: row => row.bankRemark || '-' },
  {
    title: '操作',
    key: 'actions',
    width: 200,
    align: 'right',
    fixed: 'right',
    render(row) {
      return h(NSpace, { justify: 'end', size: 8 }, {
        default: () => [
          h(NButton, { size: 'small', secondary: true, onClick: () => openDetail('payment', row.id) }, { default: () => '详情' }),
          withPermission(h(NButton, { size: 'small', secondary: true, type: 'primary', onClick: () => openPaymentDrawer(row) }, { default: () => '编辑' }), 'MaintainFinancePayment'),
          withPermission(h(NButton, { size: 'small', secondary: true, type: 'success', onClick: () => openMatchModal(row) }, { default: () => '匹配' }), 'MatchFinancePayment'),
        ].filter(Boolean),
      })
    },
  },
]

const paymentImportBatchColumns = [
  { title: '文件名', key: 'sourceFileName', minWidth: 260, ellipsis: { tooltip: true } },
  { title: '状态', key: 'status', width: 90, render: row => renderMappedTag(paymentImportBatchStatusMap, row.status) },
  { title: '总行数', key: 'totalRows', width: 80 },
  { title: '可入库', key: 'validRows', width: 80 },
  { title: '需确认', key: 'warningRows', width: 80 },
  { title: '错误', key: 'errorRows', width: 80 },
  { title: '已入库', key: 'importedRows', width: 80 },
  { title: '导入人', key: 'importedByName', width: 110, render: row => row.importedByName || '-' },
  { title: '导入时间', key: 'importedAt', width: 130, render: row => row.importedAt ? formatDate(row.importedAt) : '-' },
  {
    title: '操作',
    key: 'actions',
    width: 160,
    align: 'right',
    fixed: 'right',
    render(row) {
      return h(NSpace, { justify: 'end', size: 8 }, {
        default: () => [
          h(NButton, { size: 'small', secondary: true, onClick: () => openPaymentImportDetail(row) }, { default: () => '明细' }),
        ].filter(Boolean),
      })
    },
  },
]

const paymentImportRowColumns = [
  { title: '行号', key: 'rowNo', width: 70 },
  { title: '状态', key: 'validationStatus', width: 90, render: row => renderMappedTag(paymentImportRowStatusMap, row.validationStatus) },
  { title: '处理', key: 'importAction', width: 110, render: renderPaymentImportDecisionAction },
  { title: '收款日期', key: 'paymentDate', width: 110, render: row => row.normalizedJson?.paymentDate || '-' },
  { title: '付款方', key: 'payerName', minWidth: 220, ellipsis: { tooltip: true }, render: row => row.normalizedJson?.payerName || '-' },
  { title: '归属客户', key: 'clientName', minWidth: 240, render: renderPaymentImportClient },
  { title: '金额', key: 'amount', width: 120, render: row => row.normalizedJson?.amount ? `￥${formatCurrency(row.normalizedJson.amount)}` : '-' },
  { title: '流水号', key: 'bankSerialNo', minWidth: 150, ellipsis: { tooltip: true }, render: row => row.normalizedJson?.bankSerialNo || '-' },
  { title: '备注', key: 'bankRemark', minWidth: 180, ellipsis: { tooltip: true }, render: row => row.normalizedJson?.bankRemark || row.validationMessage || '-' },
  { title: '确认备注', key: 'confirmRemark', minWidth: 180, render: renderPaymentImportRemark },
  { title: '校验说明', key: 'validationMessage', minWidth: 200, ellipsis: { tooltip: true }, render: row => row.validationMessage || '-' },
]

const serviceItemColumns = [
  { title: '订单号', key: 'orderNo', minWidth: 130, remoteSortable: true },
  { title: '单位名称', key: 'clientName', minWidth: 240, ellipsis: { tooltip: true }, remoteSortable: true },
  { title: '服务项', key: 'serviceName', minWidth: 150, ellipsis: { tooltip: true }, remoteSortable: true },
  { title: '年度', key: 'serviceYear', width: 90, remoteSortable: true },
  { title: '应收', key: 'billableAmount', width: 110, remoteSortable: true, render: row => `￥${formatCurrency(row.billableAmount)}` },
  { title: '已收', key: 'receivedAmount', width: 110, remoteSortable: true, render: row => `￥${formatCurrency(row.receivedAmount)}` },
  { title: '未收', key: 'unreceivedAmount', width: 110, render: row => `￥${formatCurrency(row.unreceivedAmount)}` },
  { title: '收款状态', key: 'collectionStatus', width: 110, render: row => renderStatusTag(row.collectionStatus, row.collectionStatus === SERVICE_COLLECTION_STATUS.PAID ? 'success' : row.collectionStatus === SERVICE_COLLECTION_STATUS.PARTIAL ? 'warning' : 'error') },
  { title: '续签状态', key: 'renewalStatus', width: 110, render: row => renderRenewalStatus(row.renewalStatus) },
  {
    title: '操作',
    key: 'actions',
    width: 90,
    align: 'right',
    fixed: 'right',
    render(row) {
      if (row.renewalStatus !== '待续签' || row.renewedByServiceItemId)
        return null
      return withPermission(h(NButton, { size: 'small', secondary: true, type: 'primary', onClick: () => renewServiceItem(row) }, { default: () => '续签' }), 'AddOrder')
    },
  },
]

const detailLineColumns = [
  { title: '订单号', key: 'orderNo', minWidth: 130 },
  { title: '单位名称', key: 'clientName', minWidth: 220, ellipsis: { tooltip: true } },
  { title: '服务项', key: 'serviceName', minWidth: 160, ellipsis: { tooltip: true } },
  { title: '年度', key: 'serviceYear', width: 90 },
  { title: '金额', key: 'amount', width: 120, render: row => `￥${formatCurrency(row.amount || row.allocatedAmount || row.matchedAmount)}` },
  { title: '说明', key: 'description', minWidth: 180, ellipsis: { tooltip: true }, render: row => row.description || row.invoiceNo || '-' },
]

onMounted(async () => {
  applyRouteQuery()
  if (!await ensureFinanceReadable())
    return
  await loadFinancePageData()
})

watch(() => route.query, async () => {
  if (!canViewFinance.value)
    return
  applyRouteQuery()
  contractPagination.page = 1
  invoicePagination.page = 1
  paymentPagination.page = 1
  await Promise.all([loadContracts(), loadInvoices(), loadPayments()])
})

async function ensureFinanceReadable() {
  if (canViewFinance.value)
    return true
  if (canOpenCommission.value)
    await router.replace('/commission')
  return false
}

async function loadFinancePageData() {
  await Promise.all([loadClientOptions(), loadSummary(), loadContracts(), loadInvoices(), loadPayments(), loadServiceItems()])
}

async function loadSummary() {
  const { data } = await businessApi.finance.summary()
  summary.value = data || {}
}

async function loadClientOptions() {
  const { data = [] } = await businessApi.clients.options()
  clientOptions.value = data
}

async function loadContracts() {
  const { data } = await businessApi.finance.contracts({
    pageNo: contractPagination.page,
    pageSize: contractPagination.pageSize,
    ...cleanQuery(contractQuery),
    ...getTableSorterParams(contractSorter.value),
  })
  contracts.value = data?.pageData || []
  contractPagination.itemCount = data?.total || 0
}

async function loadInvoices() {
  const { data } = await businessApi.finance.invoices({
    pageNo: invoicePagination.page,
    pageSize: invoicePagination.pageSize,
    ...cleanQuery(invoiceQuery),
    ...getTableSorterParams(invoiceSorter.value),
  })
  invoices.value = data?.pageData || []
  invoicePagination.itemCount = data?.total || 0
}

async function loadPayments() {
  const { data } = await businessApi.finance.payments({
    pageNo: paymentPagination.page,
    pageSize: paymentPagination.pageSize,
    ...cleanQuery(paymentQuery),
    ...getTableSorterParams(paymentSorter.value),
  })
  paymentRows.value = data?.pageData || []
  paymentPagination.itemCount = data?.total || 0
}

async function loadServiceItems() {
  const { data } = await businessApi.serviceItems.page({
    pageNo: serviceItemPagination.page,
    pageSize: serviceItemPagination.pageSize,
    ...cleanQuery(serviceItemQuery),
    ...getTableSorterParams(serviceItemSorter.value),
  })
  serviceItems.value = data?.pageData || []
  serviceItemPagination.itemCount = data?.total || 0
}

async function loadDocumentServiceItems(clientId) {
  serviceItemRows.value = []
  if (!clientId)
    return
  const { data } = await businessApi.serviceItems.page({ clientId, pageNo: 1, pageSize: ALL_PAGE_SIZE })
  serviceItemRows.value = data?.pageData || []
}

async function loadContractOptions(clientId) {
  contractOptions.value = []
  if (!clientId)
    return
  const { data } = await businessApi.finance.contracts({ clientId, pageNo: 1, pageSize: ALL_PAGE_SIZE, status: CONTRACT_STATUS.SIGNED })
  contractOptions.value = (data?.pageData || []).map(row => ({
    label: `${row.contractNo} / ￥${formatCurrency(row.totalAmount)}`,
    value: row.id,
    row,
  }))
}

async function loadMatchInvoices(payment) {
  const params = { pageNo: 1, pageSize: ALL_PAGE_SIZE }
  if (payment.clientId)
    params.clientId = payment.clientId
  const { data } = await businessApi.finance.invoices(params)
  matchInvoiceRows.value = (data?.pageData || []).filter(row => row.status !== INVOICE_STATUS.VOIDED && Number(row.unmatchedAmount || 0) > 0)
}

function searchContracts() {
  contractPagination.page = 1
  void loadContracts()
}

function resetContracts() {
  resetQuery(contractQuery)
  searchContracts()
}

function searchInvoices() {
  invoicePagination.page = 1
  void loadInvoices()
}

function resetInvoices() {
  resetQuery(invoiceQuery)
  searchInvoices()
}

function searchPayments() {
  paymentPagination.page = 1
  void loadPayments()
}

function resetPayments() {
  resetQuery(paymentQuery)
  searchPayments()
}

function searchServiceItems() {
  serviceItemPagination.page = 1
  loadServiceItems()
}

function resetServiceItems() {
  resetQuery(serviceItemQuery)
  searchServiceItems()
}

async function handlePageChange(pagination, loader, page) {
  pagination.page = page
  await loader()
}

async function handlePageSizeChange(pagination, loader, pageSize) {
  pagination.page = 1
  pagination.pageSize = pageSize
  await loader()
}

async function handleSorterChange(sorterRef, pagination, loader, sorter) {
  sorterRef.value = normalizeTableSorter(sorter)
  pagination.page = 1
  await loader()
}

async function openDocumentDrawer(type, row = null) {
  documentType.value = type
  editingDocument.value = row
  Object.assign(documentForm, defaultDocumentForm(type))
  documentForm.status = type === 'contract' ? CONTRACT_STATUS.SIGNED : INVOICE_STATUS.ISSUED
  resetInvoiceAttachmentInput()
  if (row?.id) {
    const detailApi = type === 'contract' ? businessApi.finance.contractDetail : businessApi.finance.invoiceDetail
    const { data } = await detailApi(row.id)
    editingDocument.value = data
    Object.assign(documentForm, mapDetailToDocumentForm(type, data))
    await loadDocumentServiceItems(documentForm.clientId)
    if (type === 'invoice')
      await loadContractOptions(documentForm.clientId)
  }
  documentDrawerVisible.value = true
}

async function handleDocumentClientChange(clientId) {
  documentForm.lines = [createDocumentLine()]
  documentForm.contractId = null
  await loadDocumentServiceItems(clientId)
  await loadContractOptions(clientId)
}

function fillLineAmount(line, serviceItemId) {
  const row = serviceItemRows.value.find(item => item.id === serviceItemId)
  if (!row)
    return
  line.amount = Number(row.billableAmount || 0)
  line.description = row.serviceName
}

function fillInvoiceFromContract(contractId) {
  const row = contractOptions.value.find(item => item.value === contractId)?.row
  if (!row)
    return
  documentForm.amount = Number(row.totalAmount || 0)
}

async function saveDocument() {
  const payload = documentPayload()
  if (!payload)
    return
  savingDocument.value = true
  let savedDocument = null
  const shouldUploadInvoiceAttachment = documentType.value === 'invoice' && Boolean(invoiceAttachmentFile.value)
  try {
    if (documentType.value === 'contract') {
      if (editingDocument.value?.id)
        await businessApi.finance.updateContract(editingDocument.value.id, payload)
      else
        await businessApi.finance.createContract(payload)
      await loadContracts()
    }
    else {
      if (editingDocument.value?.id) {
        const { data } = await businessApi.finance.updateInvoice(editingDocument.value.id, payload)
        savedDocument = data
      }
      else {
        const { data } = await businessApi.finance.createInvoice(payload)
        savedDocument = data
      }
      if (shouldUploadInvoiceAttachment)
        await uploadInvoiceAttachmentForInvoice(savedDocument || editingDocument.value, { silent: true })
      await loadInvoices()
    }
    showSuccess(shouldUploadInvoiceAttachment ? '发票和附件已保存' : '已保存')
    documentDrawerVisible.value = false
    resetInvoiceAttachmentInput()
    await Promise.all([loadSummary(), loadServiceItems()])
  }
  finally {
    savingDocument.value = false
  }
}

function openPaymentDrawer(row = null) {
  editingPayment.value = row
  Object.assign(paymentForm, defaultPaymentForm(row))
  paymentDrawerVisible.value = true
}

async function openPaymentImportDrawer() {
  paymentImportDrawerVisible.value = true
  paymentImportActiveTab.value = 'upload'
  await loadPaymentImportBatches()
}

function handlePaymentImportFileChange({ file }) {
  paymentImportFile.value = file?.file || null
}

async function submitPaymentImport() {
  if (!paymentImportFile.value)
    return showError('请选择银行流水文件')
  const formData = new FormData()
  formData.append('file', paymentImportFile.value)
  importingPayments.value = true
  try {
    const { data } = await businessApi.finance.importBankStatement(formData)
    selectedPaymentImport.value = data
    paymentImportRows.value = data?.rows || []
    resetPaymentImportRowDecisions(paymentImportRows.value)
    paymentImportRowPagination.page = 1
    paymentImportRowPagination.itemCount = data?.rowTotal || paymentImportRows.value.length
    paymentImportFile.value = null
    await loadPaymentImportBatches()
    showSuccess('解析完成')
  }
  finally {
    importingPayments.value = false
  }
}

async function loadPaymentImportBatches() {
  const { data } = await businessApi.finance.paymentImportBatches({
    pageNo: paymentImportBatchPagination.page,
    pageSize: paymentImportBatchPagination.pageSize,
  })
  paymentImportBatches.value = data?.pageData || []
  paymentImportBatchPagination.itemCount = data?.total || 0
}

async function openPaymentImportDetail(row) {
  selectedPaymentImport.value = row
  paymentImportRowPagination.page = 1
  await loadPaymentImportRows()
}

async function loadPaymentImportRows() {
  if (!selectedPaymentImport.value)
    return
  const { data } = await businessApi.finance.paymentImportDetail(selectedPaymentImport.value.id, {
    pageNo: paymentImportRowPagination.page,
    pageSize: paymentImportRowPagination.pageSize,
  })
  selectedPaymentImport.value = data
  paymentImportRows.value = data?.rows || []
  resetPaymentImportRowDecisions(paymentImportRows.value)
  paymentImportRowPagination.itemCount = data?.rowTotal || 0
}

function resetPaymentImportRowDecisions(rows) {
  for (const key of Object.keys(paymentImportRowDecisions))
    delete paymentImportRowDecisions[key]
  for (const row of rows) {
    if (!isPaymentImportRowPending(row))
      continue
    paymentImportRowDecisions[row.id] = {
      action: 'import',
      clientId: row.clientId || row.normalizedJson?.clientId || null,
      remark: '',
    }
  }
}

function isPaymentImportRowPending(row) {
  return ['valid', 'warning'].includes(row.validationStatus)
}

function getPaymentImportDecision(row) {
  if (!paymentImportRowDecisions[row.id]) {
    paymentImportRowDecisions[row.id] = {
      action: 'import',
      clientId: row.clientId || row.normalizedJson?.clientId || null,
      remark: '',
    }
  }
  return paymentImportRowDecisions[row.id]
}

function buildPaymentImportConfirmRows() {
  return paymentImportRows.value
    .filter(row => isPaymentImportRowPending(row))
    .map((row) => {
      const decision = getPaymentImportDecision(row)
      return {
        rowId: row.id,
        action: decision.action,
        clientId: decision.clientId || undefined,
        remark: decision.remark || undefined,
      }
    })
}

async function confirmPaymentImport(row) {
  confirmingPaymentImport.value = true
  try {
    const { data } = await businessApi.finance.confirmPaymentImport(row.id, {
      rows: buildPaymentImportConfirmRows(),
    })
    selectedPaymentImport.value = data
    paymentImportRows.value = data?.rows || []
    resetPaymentImportRowDecisions(paymentImportRows.value)
    paymentImportRowPagination.itemCount = data?.rowTotal || paymentImportRows.value.length
    await Promise.all([loadPaymentImportBatches(), loadSummary(), loadPayments()])
    showSuccess('银行流水已入库')
  }
  finally {
    confirmingPaymentImport.value = false
  }
}

async function handlePaymentImportBatchPageChange(page) {
  paymentImportBatchPagination.page = page
  await loadPaymentImportBatches()
}

async function handlePaymentImportBatchPageSizeChange(pageSize) {
  paymentImportBatchPagination.page = 1
  paymentImportBatchPagination.pageSize = pageSize
  await loadPaymentImportBatches()
}

async function handlePaymentImportRowPageChange(page) {
  paymentImportRowPagination.page = page
  await loadPaymentImportRows()
}

async function handlePaymentImportRowPageSizeChange(pageSize) {
  paymentImportRowPagination.page = 1
  paymentImportRowPagination.pageSize = pageSize
  await loadPaymentImportRows()
}

async function savePayment() {
  const payload = paymentPayload()
  if (!payload)
    return
  savingPayment.value = true
  try {
    if (editingPayment.value?.id)
      await businessApi.finance.updatePayment(editingPayment.value.id, payload)
    else
      await businessApi.finance.createPayment(payload)
    showSuccess('已保存')
    paymentDrawerVisible.value = false
    await Promise.all([loadSummary(), loadPayments()])
  }
  finally {
    savingPayment.value = false
  }
}

async function openMatchModal(row) {
  const { data } = await businessApi.finance.paymentDetail(row.id)
  selectedPayment.value = data
  await loadMatchInvoices(data)
  matchForm.matches = data.matches?.length
    ? data.matches.map(match => ({ invoiceId: match.invoiceId, matchedAmount: Number(match.matchedAmount || 0), remark: match.remark || '' }))
    : [createMatchLine()]
  matchModalVisible.value = true
}

function openInvoiceAttachmentModal(row) {
  selectedInvoiceForAttachment.value = row
  resetInvoiceAttachmentInput()
  invoiceAttachmentForm.name = `${row.invoiceNo}发票附件`
  invoiceAttachmentForm.remark = ''
  invoiceAttachmentModalVisible.value = true
}

async function handleInvoiceAttachmentFileChange({ file }) {
  invoiceAttachmentFile.value = file?.file || null
  invoiceAttachmentRecognized.value = null
  if (invoiceAttachmentFile.value && (!invoiceAttachmentForm.name || invoiceAttachmentForm.name.endsWith('发票附件')))
    invoiceAttachmentForm.name = invoiceAttachmentFile.value.name
  if (documentDrawerVisible.value && documentType.value === 'invoice' && invoiceAttachmentFile.value) {
    invoiceAttachmentRecognized.value = await recognizeInvoiceAttachment(invoiceAttachmentFile.value)
    applyRecognizedInvoiceFields(invoiceAttachmentRecognized.value)
  }
}

async function uploadInvoiceAttachment() {
  if (!selectedInvoiceForAttachment.value || !invoiceAttachmentFile.value)
    return
  await uploadInvoiceAttachmentForInvoice(selectedInvoiceForAttachment.value)
  invoiceAttachmentModalVisible.value = false
}

async function uploadInvoiceAttachmentForInvoice(invoice, options = {}) {
  if (!invoice?.id || !invoiceAttachmentFile.value)
    return
  const formData = new FormData()
  formData.append('file', invoiceAttachmentFile.value)
  formData.append('tag', '发票')
  formData.append('name', invoiceAttachmentForm.name || invoiceAttachmentFile.value.name)
  formData.append('links', JSON.stringify([{ entityType: '发票', entityId: invoice.id, tag: '发票', remark: invoiceAttachmentForm.remark || undefined }]))
  if (invoiceAttachmentForm.remark)
    formData.append('remark', invoiceAttachmentForm.remark)
  uploadingInvoiceAttachment.value = true
  try {
    await businessApi.archive.uploadAttachment(formData)
    if (!options.silent)
      showSuccess('附件已上传')
  }
  finally {
    uploadingInvoiceAttachment.value = false
  }
}

function resetInvoiceAttachmentInput() {
  invoiceAttachmentFile.value = null
  invoiceAttachmentRecognized.value = null
  invoiceAttachmentForm.name = ''
  invoiceAttachmentForm.remark = ''
}

async function recognizeInvoiceAttachment(file) {
  const fileText = await readRecognizableFileText(file)
  const source = `${file.name}\n${fileText}`
  return {
    invoiceNo: extractInvoiceNo(source),
    invoiceDate: extractInvoiceDate(source),
    invoiceAmount: extractInvoiceAmount(source),
    buyerName: extractBuyerName(source),
  }
}

async function readRecognizableFileText(file) {
  if (!file)
    return ''
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf')
    return readPdfFileText(file)
  if (file.size > 2 * 1024 * 1024)
    return ''
  if (!['pdf', 'txt', 'csv', 'xml', 'html'].includes(ext))
    return ''
  try {
    const buffer = await file.arrayBuffer()
    return new TextDecoder('utf-8', { fatal: false }).decode(buffer).replace(/\s+/g, ' ')
  }
  catch {
    return ''
  }
}

async function readPdfFileText(file) {
  if (file.size > PDF_TEXT_RECOGNITION_MAX_BYTES)
    return ''
  let loadingTask = null
  try {
    const pdfjsLib = await loadPdfjsLib()
    const data = new Uint8Array(await file.arrayBuffer())
    loadingTask = pdfjsLib.getDocument({ data })
    const pdf = await loadingTask.promise
    const texts = []
    const pageCount = Math.min(pdf.numPages, PDF_TEXT_RECOGNITION_MAX_PAGES)
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const textContent = await page.getTextContent()
      texts.push(textContent.items.map(item => item.str || '').filter(Boolean).join('\n'))
      if (typeof page.cleanup === 'function')
        page.cleanup()
    }
    return texts.join('\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n')
  }
  catch {
    return ''
  }
  finally {
    if (loadingTask && typeof loadingTask.destroy === 'function') {
      try {
        await loadingTask.destroy()
      }
      catch {}
    }
  }
}

async function loadPdfjsLib() {
  if (!pdfjsLibCache) {
    pdfjsLibCache = await import('pdfjs-dist')
    pdfjsLibCache.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  }
  return pdfjsLibCache
}

function applyRecognizedInvoiceFields(recognized) {
  if (!recognized)
    return
  if (recognized.invoiceNo)
    documentForm.no = recognized.invoiceNo
  if (recognized.invoiceDate)
    documentForm.date = recognized.invoiceDate
  if (recognized.buyerName)
    documentForm.buyerName = recognized.buyerName
  if (recognized.invoiceAmount && !isInvoiceAccountingLocked.value)
    documentForm.amount = recognized.invoiceAmount
  if (recognized.buyerName && !isInvoiceAccountingLocked.value)
    fillClientFromRecognizedBuyer(recognized.buyerName)
}

function fillClientFromRecognizedBuyer(buyerName) {
  const client = clientOptions.value.find(option => option.label === buyerName || option.unitName === buyerName)
  if (!client)
    return
  documentForm.clientId = client.value
  void handleDocumentClientChange(client.value)
}

function extractInvoiceNo(source) {
  const normalized = source.replace(/\s+/g, ' ')
  const labeled = normalized.match(/(?:发票(?:号码|号)|票号)[:：\s]*([A-Z0-9-]{6,40})/i)
  if (labeled)
    return labeled[1]
  const electronicInvoiceFileName = source.match(/(?:^|\n)dzfp[_-](\d{12,30})[_-]/i)
  if (electronicInvoiceFileName)
    return electronicInvoiceFileName[1]
  const named = source.match(/[A-Z0-9]+-FP-\d{4}-\d{4,}/i)
  if (named)
    return named[0]
  const digitalInvoiceNo = normalized.match(/(?:^|\D)(\d{20})(?:\D|$)/)
  return digitalInvoiceNo?.[1] || ''
}

function extractInvoiceDate(source) {
  const compact = source.match(/(?:^|[_\s-])(\d{8})(?:\d{6})?(?=\D|$)/)
  if (compact)
    return formatRecognizedDate(compact[1].slice(0, 4), compact[1].slice(4, 6), compact[1].slice(6, 8))
  const labeled = source.match(/(?:开票日期|日期)[:：\s]*(20\d{2})[-年./_ ]+(\d{1,2})[-月./_ ]+(\d{1,2})日?/)
  if (labeled)
    return formatRecognizedDate(labeled[1], labeled[2], labeled[3])
  const match = source.match(/(?:^|\D)(20\d{2})[-年./_ ](\d{1,2})[-月./_ ](\d{1,2})日?/)
  if (!match)
    return ''
  return formatRecognizedDate(match[1], match[2], match[3])
}

function formatRecognizedDate(yearText, monthText, dayText) {
  const month = Number(monthText)
  const day = Number(dayText)
  if (month < 1 || month > 12 || day < 1 || day > 31)
    return ''
  return `${yearText}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function extractInvoiceAmount(source) {
  const labeled = source.match(/(?:价税合计|合计金额|发票金额|金额)[:：\s¥￥]*(\d[\d,]*(?:\.\d{1,2})?)/)
  const currencyAmounts = [...source.matchAll(/[¥￥]\s*(\d[\d,]*(?:\.\d{1,2})?)/g)]
    .map(match => Number(match[1].replace(/,/g, '')))
    .filter(amount => Number.isFinite(amount) && amount > 0)
  const amountText = labeled?.[1] || source.match(/[_\s-](\d{2,9}(?:\.\d{1,2})?)(?:\.[A-Z0-9]+)?$/i)?.[1]
  if (amountText)
    return Number(amountText.replace(/,/g, ''))
  if (currencyAmounts.length)
    return Math.max(...currencyAmounts)
  return null
}

function extractBuyerName(source) {
  const fileName = source.split('\n')[0].replace(/\.[^.]+$/, '')
  const electronicInvoiceFileName = fileName.match(/^dzfp_[^_]+_(.+?)_\d{8,14}$/i)
  if (electronicInvoiceFileName)
    return electronicInvoiceFileName[1].trim()
  const labeled = source.match(/(?:购买方名称|购买方|买方|客户|单位名称)[:：\s]*([\u4E00-\u9FA5A-Z0-9（）()·\-]{4,80})/i)
  if (labeled)
    return labeled[1].replace(/(?:纳税人识别号|税号|地址|电话|开户行).*$/, '').trim()
  const parts = fileName.split(/[_\s]+/).filter(Boolean)
  const amountIndex = parts.findIndex(part => /^\d+(?:\.\d{1,2})?$/.test(part))
  if (amountIndex > 2)
    return parts.slice(2, amountIndex).filter(part => !/^\d{6,}$/.test(part)).join('')
  return ''
}

function fillMatchAmount(line, invoiceId) {
  const invoice = matchInvoiceRows.value.find(row => row.id === invoiceId)
  if (!invoice || !selectedPayment.value)
    return
  const paymentUnmatched = Number(selectedPayment.value.unmatchedAmount || selectedPayment.value.amount || 0)
  line.matchedAmount = Math.min(Number(invoice.unmatchedAmount || 0), paymentUnmatched)
}

async function saveMatch() {
  if (!selectedPayment.value)
    return
  const matches = matchForm.matches
    .filter(row => row.invoiceId && Number(row.matchedAmount || 0) > 0)
    .map(row => ({ invoiceId: row.invoiceId, matchedAmount: Number(row.matchedAmount || 0), remark: row.remark || undefined }))
  if (!matches.length)
    return showError('至少选择一张发票')
  savingMatch.value = true
  try {
    await businessApi.finance.matchPayment(selectedPayment.value.id, { matches })
    showSuccess('匹配已保存')
    matchModalVisible.value = false
    await Promise.all([loadSummary(), loadPayments(), loadInvoices(), loadServiceItems()])
  }
  finally {
    savingMatch.value = false
  }
}

async function renewServiceItem(row) {
  if (!row?.orderId || !row?.id)
    return
  await businessApi.orders.renewServiceItem(row.orderId, row.id)
  showSuccess('已创建续签订单')
  await Promise.all([loadSummary(), loadServiceItems()])
}

function openServiceItemOrder(row) {
  if (row?.orderNo)
    router.push({ path: '/orders', query: { keyword: row.orderNo } })
}

async function openDetail(kind, id) {
  detailKind.value = kind
  detailRecord.value = null
  detailLines.value = []
  detailDrawerVisible.value = true
  detailLoading.value = true
  const apiMap = {
    contract: businessApi.finance.contractDetail,
    invoice: businessApi.finance.invoiceDetail,
    payment: businessApi.finance.paymentDetail,
  }
  try {
    const { data } = await apiMap[kind](id)
    detailRecord.value = data
    detailLines.value = kind === 'payment'
      ? (data.matches || []).map(match => ({ ...match, amount: match.matchedAmount, description: match.invoiceNo }))
      : data.lines || []
  }
  catch (error) {
    showError(error?.message || '详情加载失败')
  }
  finally {
    detailLoading.value = false
  }
}

function openCommission() {
  router.push('/commission')
}

function defaultDocumentForm(type = 'contract') {
  return {
    no: '',
    clientId: null,
    contractId: null,
    title: '',
    buyerName: '',
    amount: 0,
    date: '',
    startsAt: null,
    endsAt: null,
    status: type === 'contract' ? CONTRACT_STATUS.SIGNED : INVOICE_STATUS.ISSUED,
    deliveryStatus: INVOICE_DELIVERY_STATUS.PENDING,
    remark: '',
    lines: [createDocumentLine()],
  }
}

function createDocumentLine() {
  return { orderServiceItemId: null, amount: 0, description: '' }
}

function defaultPaymentForm(row = null) {
  return {
    paymentDate: row?.paymentDate || '',
    clientId: row?.clientId || null,
    payerName: row?.payerName || '',
    bankAccount: row?.bankAccount || '',
    bankSerialNo: row?.bankSerialNo || '',
    bankRemark: row?.bankRemark || '',
    amount: Number(row?.amount || 0),
    remark: row?.remark || '',
  }
}

function createMatchLine() {
  return { invoiceId: null, matchedAmount: 0, remark: '' }
}

function mapDetailToDocumentForm(type, row) {
  return {
    no: type === 'contract' ? row.contractNo : row.invoiceNo,
    clientId: row.clientId,
    contractId: row.contractId || null,
    title: row.title || '',
    buyerName: row.buyerName || '',
    amount: Number(type === 'contract' ? row.totalAmount : row.invoiceAmount),
    date: type === 'contract' ? row.signedAt : row.invoiceDate,
    startsAt: row.startsAt || null,
    endsAt: row.endsAt || null,
    status: row.status,
    deliveryStatus: row.deliveryStatus || INVOICE_DELIVERY_STATUS.PENDING,
    remark: row.remark || '',
    lines: row.lines?.length
      ? row.lines.map(line => ({
          orderServiceItemId: line.orderServiceItemId,
          amount: Number(line.amount || 0),
          description: line.description || '',
        }))
      : [createDocumentLine()],
  }
}

function documentPayload() {
  const lines = documentForm.lines
    .filter(row => row.orderServiceItemId && Number(row.amount || 0) > 0)
    .map(row => ({
      orderServiceItemId: row.orderServiceItemId,
      amount: Number(row.amount || 0),
      description: row.description || undefined,
    }))
  if (!documentForm.no || !documentForm.clientId || !documentForm.amount || !documentForm.date || !lines.length) {
    showError('编号、客户、金额、日期和明细不能为空')
    return null
  }
  if (documentType.value === 'contract') {
    return {
      contractNo: documentForm.no,
      clientId: documentForm.clientId,
      title: documentForm.title || documentForm.no,
      totalAmount: Number(documentForm.amount || 0),
      signedAt: documentForm.date,
      startsAt: documentForm.startsAt || undefined,
      endsAt: documentForm.endsAt || undefined,
      status: documentForm.status,
      remark: documentForm.remark || undefined,
      lines,
    }
  }
  if (isInvoiceAccountingLocked.value) {
    const payload = {
      invoiceNo: documentForm.no,
      buyerName: documentForm.buyerName || undefined,
      invoiceDate: documentForm.date,
      deliveryStatus: documentForm.deliveryStatus,
      remark: documentForm.remark || undefined,
    }
    if (documentForm.status !== INVOICE_STATUS.VOIDED)
      payload.status = documentForm.status
    return payload
  }
  return {
    invoiceNo: documentForm.no,
    clientId: documentForm.clientId,
    contractId: documentForm.contractId || undefined,
    buyerName: documentForm.buyerName || undefined,
    invoiceDate: documentForm.date,
    invoiceAmount: Number(documentForm.amount || 0),
    deliveryStatus: documentForm.deliveryStatus,
    status: documentForm.status,
    remark: documentForm.remark || undefined,
    lines,
  }
}

function paymentPayload() {
  if (!paymentForm.paymentDate || !paymentForm.payerName || !paymentForm.amount) {
    showError('收款日期、付款方和金额不能为空')
    return null
  }
  return {
    paymentDate: paymentForm.paymentDate,
    clientId: paymentForm.clientId || undefined,
    payerName: paymentForm.payerName,
    bankAccount: paymentForm.bankAccount || undefined,
    bankSerialNo: paymentForm.bankSerialNo || undefined,
    bankRemark: paymentForm.bankRemark || undefined,
    amount: Number(paymentForm.amount || 0),
    remark: paymentForm.remark || undefined,
  }
}

function cleanQuery(source) {
  return Object.fromEntries(Object.entries(source).filter(([, value]) => value !== null && value !== undefined && value !== ''))
}

function applyRouteQuery() {
  resetQuery(contractQuery)
  resetQuery(invoiceQuery)
  resetQuery(paymentQuery)
  resetQuery(serviceItemQuery)

  const tab = String(route.query.tab || '')
  if (['contracts', 'invoice', 'payment', 'reconcile'].includes(tab))
    activeTab.value = tab

  const keyword = String(route.query.keyword || '').trim()
  if (keyword) {
    if (activeTab.value === 'invoice')
      invoiceQuery.keyword = keyword
    else if (activeTab.value === 'payment')
      paymentQuery.keyword = keyword
    else if (activeTab.value === 'reconcile')
      serviceItemQuery.keyword = keyword
    else
      contractQuery.keyword = keyword
  }

  const matchStatus = String(route.query.matchStatus || '').trim()
  if (matchStatus)
    paymentQuery.matchStatus = matchStatus

  const paymentStatus = String(route.query.paymentStatus || '').trim()
  if (paymentStatus)
    invoiceQuery.paymentStatus = paymentStatus

  const deliveryStatus = String(route.query.deliveryStatus || '').trim()
  if (deliveryStatus)
    invoiceQuery.deliveryStatus = deliveryStatus

  const status = String(route.query.status || '').trim()
  if (status)
    contractQuery.status = status

  const collectionStatus = String(route.query.collectionStatus || '').trim()
  if (collectionStatus)
    serviceItemQuery.collectionStatus = collectionStatus
}

function resetQuery(query) {
  for (const key of Object.keys(query))
    query[key] = key === 'keyword' ? '' : null
}

function renderStatusTag(label, type) {
  return h(NTag, { type, size: 'small' }, { default: () => label })
}

function renderRenewalStatus(status) {
  const typeMap = {
    待续签: 'warning',
    已续签: 'success',
    不续签: 'default',
    已终止: 'error',
    未到期: 'info',
    无需续签: 'default',
  }
  return h(NTag, { type: typeMap[status] || 'default', size: 'small' }, { default: () => status || '-' })
}

function renderPaymentImportDecisionAction(row) {
  if (!isPaymentImportRowPending(row))
    return '-'
  const decision = getPaymentImportDecision(row)
  return h(NSelect, {
    value: decision.action,
    size: 'small',
    options: [
      { label: '入库', value: 'import' },
      { label: '跳过', value: 'skip' },
    ],
    onUpdateValue: value => decision.action = value,
  })
}

function renderPaymentImportClient(row) {
  if (!isPaymentImportRowPending(row))
    return row.normalizedJson?.clientName || '-'
  const decision = getPaymentImportDecision(row)
  return h(NSelect, {
    value: decision.clientId,
    size: 'small',
    filterable: true,
    clearable: true,
    options: clientOptions.value,
    placeholder: '人工确认客户',
    onUpdateValue: value => decision.clientId = value,
  })
}

function renderPaymentImportRemark(row) {
  if (!isPaymentImportRowPending(row))
    return '-'
  const decision = getPaymentImportDecision(row)
  return h(NInput, {
    value: decision.remark,
    size: 'small',
    placeholder: decision.action === 'skip' ? '跳过原因' : '确认说明',
    onUpdateValue: value => decision.remark = value,
  })
}

function renderMappedTag(map, value) {
  const item = map[value] || { label: value || '-', type: 'default' }
  return h(NTag, { type: item.type, size: 'small' }, { default: () => item.label })
}

function showSuccess(content) {
  window.$message?.success(content)
}

function showError(content) {
  window.$message?.error(content)
}
</script>

<style scoped>
.finance-summary-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.finance-summary-item {
  min-height: 72px;
  padding: 12px 14px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background: var(--n-card-color);
}

.finance-summary-item span {
  display: block;
  color: var(--n-text-color-3);
  font-size: 13px;
}

.finance-summary-item strong {
  display: block;
  margin-top: 8px;
  color: var(--n-text-color);
  font-size: 19px;
  font-weight: 650;
}

.finance-line-row {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) 130px minmax(160px, 0.7fr);
  gap: 8px;
  width: 100%;
}

.finance-import-uploader {
  display: flex;
  min-height: 120px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--n-text-color-2);
}

.finance-import-uploader i {
  font-size: 30px;
}

.line-amount,
.line-description {
  min-width: 0;
}

@media (max-width: 900px) {
  .finance-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .finance-line-row {
    grid-template-columns: 1fr;
  }
}
</style>
