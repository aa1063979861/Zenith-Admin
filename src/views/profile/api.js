/**********************************
 * @Author: Ronnie Zhang
 * @LastEditor: Ronnie Zhang
 * @LastEditTime: 2023/12/05 21:30:03
 * @Email: zclzone@outlook.com
 * Copyright © 2023 Ronnie Zhang(大脸怪) | https://isme.top
 **********************************/

import { request } from '@/utils'

export default {
  changePassword: data => request.post('/auth/password', data),
  updateProfile: ({ id, ...data }) => request.patch(`/user/profile/${id}`, data),
  uploadAvatar: (id, data) => request.post(`/user/profile/${id}/avatar`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
}
