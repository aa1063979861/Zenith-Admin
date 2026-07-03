/**********************************
 * @Author: Ronnie Zhang
 * @LastEditor: Ronnie Zhang
 * @LastEditTime: 2023/12/05 21:29:51
 * @Email: zclzone@outlook.com
 * Copyright © 2023 Ronnie Zhang(大脸怪) | https://isme.top
 **********************************/

import { request } from '@/utils'

let enabledRolesCache = null
let enabledRolesPromise = null

export default {
  create: data => request.post('/user', data),
  read: (params = {}) => request.get('/user', { params: { ...params, userKind: 'EMPLOYEE' } }),
  update: data => request.patch(`/user/${data.id}`, data),
  delete: id => request.delete(`/user/${id}`),
  resetPwd: id => request.patch(`/user/password/reset/${id}`),

  getAllRoles: () => {
    if (enabledRolesCache)
      return Promise.resolve({ data: enabledRolesCache })
    if (enabledRolesPromise)
      return enabledRolesPromise

    enabledRolesPromise = request.get('/role?enable=1')
      .then((res) => {
        enabledRolesCache = res.data || []
        return res
      })
      .finally(() => {
        enabledRolesPromise = null
      })
    return enabledRolesPromise
  },
}
