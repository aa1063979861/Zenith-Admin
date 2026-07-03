import { request } from '@/utils'

export default {
  read: (params = {}) => request.get('/system-parameters', { params }),
  groups: () => request.get('/system-parameters/groups'),
  create: data => request.post('/system-parameters', data),
  update: (data) => {
    const { id, ...payload } = data
    if (payload.valueType === 'password' && !String(payload.paramValue ?? '').trim())
      delete payload.paramValue
    return request.patch(`/system-parameters/${id}`, payload)
  },
  delete: id => request.delete(`/system-parameters/${id}`),
}
