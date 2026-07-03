import { defineStore } from 'pinia'
import { DEFAULT_PAGE_SIZE } from '@/utils'
import { businessApi } from './api'

function option(label, value, extra = {}) {
  return { label, value, ...extra }
}

export const useBusinessStore = defineStore('business', {
  state: () => ({
    dictionaryDefinitions: [],
    dictionaryRows: [],
    regions: [],
    serviceCatalog: [],
    positions: [],
    departments: [],
    departmentTree: [],
    clients: [],
    clientTotal: 0,
    clientSummary: {},
    orders: [],
    orderTotal: 0,
    serviceItems: [],
    serviceItemTotal: 0,
    employees: [],
    loading: false,
  }),
  getters: {
    regionOptions(state) {
      return state.regions
        .filter(region => region.enabled)
        .sort((a, b) => a.sort - b.sort)
        .map(region => option(region.name, region.code, { row: region }))
    },
    serviceOptions(state) {
      return state.serviceCatalog
        .filter(service => service.enabled)
        .map(service => option(service.name, service.code, { row: service }))
    },
    positionOptions(state) {
      return state.positions
        .filter(position => position.enabled)
        .sort((a, b) => a.sort - b.sort)
        .map(position => option(position.name, position.code, { row: position }))
    },
    departmentOptions(state) {
      return state.departments
        .filter(department => department.enabled)
        .sort((a, b) => a.sort - b.sort)
        .map(department => option(department.name, department.code, { row: department }))
    },
    employeeOptions(state) {
      return state.employees
        .filter(employee => employee.active)
        .map(employee => option(employee.name, employee.id, { row: employee }))
    },
  },
  actions: {
    async loadDictionaryDefinitions() {
      const { data = [] } = await businessApi.dictionaries.definitions()
      this.dictionaryDefinitions = data
      return data
    },
    async loadDictionaries(options = {}) {
      const { data = [] } = await businessApi.dictionaries.list(undefined, options)
      this.dictionaryRows = data
      this.regions = data.filter(item => item.dictionaryType === 'region')
      this.positions = data.filter(item => item.dictionaryType === 'position')
      return data
    },
    async loadServiceCatalog(params = { enabled: 1 }) {
      const { data = [] } = await businessApi.serviceCatalog.list(params)
      this.serviceCatalog = data
      return data
    },
    async loadDepartments() {
      const [{ data: tree = [] }, { data: options = [] }] = await Promise.all([
        businessApi.organization.departments(),
        businessApi.organization.departmentOptions(),
      ])
      this.departmentTree = tree
      this.departments = options
      return tree
    },
    async loadClients(params = {}) {
      const { data } = await businessApi.clients.page({ pageNo: 1, pageSize: DEFAULT_PAGE_SIZE, ...params })
      this.clients = data?.pageData || []
      this.clientTotal = data?.total || 0
      this.clientSummary = data?.summary || {}
      return data
    },
    async loadOrderRows(params = {}) {
      const { data } = await businessApi.orders.page({ pageNo: 1, pageSize: DEFAULT_PAGE_SIZE, ...params })
      this.orders = data?.pageData || []
      this.orderTotal = data?.total || 0
      return data
    },
    async loadServiceItemRows(params = {}) {
      const { data } = await businessApi.serviceItems.page({ pageNo: 1, pageSize: DEFAULT_PAGE_SIZE, ...params })
      this.serviceItems = data?.pageData || []
      this.serviceItemTotal = data?.total || 0
      return data
    },
    async loadOrders(params = {}) {
      const [ordersData, serviceItemsData] = await Promise.all([
        this.loadOrderRows(params),
        this.loadServiceItemRows(params),
      ])
      this.orders = ordersData?.pageData || []
      this.orderTotal = ordersData?.total || 0
      this.serviceItems = serviceItemsData?.pageData || []
      this.serviceItemTotal = serviceItemsData?.total || 0
      return { orders: this.orders, serviceItems: this.serviceItems }
    },
    async loadEmployees() {
      const { data = [] } = await businessApi.employees.list()
      this.employees = data
      return data
    },
    async clientOptions(regionCode) {
      const { data = [] } = await businessApi.clients.options({ regionCode })
      return data
    },
    async addDictionaryItem(payload) {
      const { data } = await businessApi.dictionaries.create(payload)
      await this.loadDictionaries()
      return data
    },
    async updateDictionaryItem(payload) {
      const { data } = await businessApi.dictionaries.update(payload)
      await this.loadDictionaries()
      return data
    },
    async deleteDictionaryItem(id) {
      const { data } = await businessApi.dictionaries.delete(id)
      await this.loadDictionaries()
      return data
    },
    async addServiceCatalog(payload) {
      const { data } = await businessApi.serviceCatalog.create(payload)
      await this.loadServiceCatalog()
      return data
    },
    async updateServiceCatalog(id, payload) {
      const { data } = await businessApi.serviceCatalog.update(id, payload)
      await this.loadServiceCatalog()
      return data
    },
    async deleteServiceCatalog(id) {
      const { data } = await businessApi.serviceCatalog.delete(id)
      await this.loadServiceCatalog()
      return data
    },
    async addClient(payload, refreshParams = {}) {
      const { data } = await businessApi.clients.create(payload)
      await this.loadClients(refreshParams)
      return data
    },
    async updateClient(clientId, payload, refreshParams = {}, options = {}) {
      const { data } = await businessApi.clients.update(clientId, payload)
      const refreshTasks = [this.loadClients(refreshParams)]
      if (options.refreshOrders !== false)
        refreshTasks.push(this.loadOrders())
      await Promise.all(refreshTasks)
      return data
    },
    async deleteClient(clientId, refreshParams = {}, options = {}) {
      const { data } = await businessApi.clients.delete(clientId)
      if (options.refresh !== false)
        await this.loadClients(refreshParams)
      return data
    },
    async addOrder(payload, options = {}) {
      const { data } = await businessApi.orders.create(payload)
      if (options.refresh !== false)
        await Promise.all([this.loadOrders(), this.loadClients()])
      return data
    },
    async clientImportBatches(params = {}) {
      const { data } = await businessApi.clients.importBatches({ pageNo: 1, pageSize: DEFAULT_PAGE_SIZE, ...params })
      return data
    },
    async clientImportBatchDetail(batchId, params = {}) {
      const { data } = await businessApi.clients.importBatchDetail(batchId, params)
      return data
    },
    async clientImportableRowIds(batchId) {
      const { data = [] } = await businessApi.clients.importableRowIds(batchId)
      return data
    },
    async importClientUnitDirectory(file, sourceType = 'client_unit_directory') {
      const formData = new FormData()
      formData.append('file', file)
      const importApiMap = {
        client_unit_directory: businessApi.clients.importUnitDirectory,
        asset_report_control: businessApi.clients.importAssetReportControl,
        integration_value_added: businessApi.clients.importIntegrationValueAdded,
      }
      const importApi = importApiMap[sourceType]
      if (!importApi)
        throw new Error(`不支持的导入类型：${sourceType}`)
      const { data } = await importApi(formData)
      return data
    },
    async revalidateClientImport(batchId) {
      const { data } = await businessApi.clients.revalidateImportBatch(batchId)
      return data
    },
    async confirmClientImport(batchId, rowIds) {
      const { data } = await businessApi.clients.confirmImportBatch(batchId, { rowIds })
      await this.loadClients()
      return data
    },
    async deleteClientImportBatch(batchId) {
      const { data } = await businessApi.clients.deleteImportBatch(batchId)
      return data
    },
  },
})
