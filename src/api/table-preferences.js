import { request } from '@/utils'

function encodeTableKey(tableKey) {
  return encodeURIComponent(tableKey)
}

export const tablePreferencesApi = {
  resolve: (tableKey, defaultConfig) => request.post(`/table-preferences/${encodeTableKey(tableKey)}/resolve`, { defaultConfig }, { needTip: false }),
  saveUser: (tableKey, settings) => request.patch(`/table-preferences/${encodeTableKey(tableKey)}/user`, { settings }, { needTip: false }),
  resetUser: tableKey => request.delete(`/table-preferences/${encodeTableKey(tableKey)}/user`, { needTip: false }),
}
