/**********************************
 * @FilePath: helpers.js
 * @Author: Ronnie Zhang
 * @LastEditor: Ronnie Zhang
 * @LastEditTime: 2023/12/04 22:46:22
 * @Email: zclzone@outlook.com
 * Copyright © 2023 Ronnie Zhang(大脸怪) | https://isme.top
 **********************************/

import { useAuthStore } from '@/store'

let isConfirming = false

function handleAuthExpired(content, needTip) {
  if (isConfirming || !needTip)
    return
  isConfirming = true
  $dialog.confirm({
    title: '提示',
    type: 'info',
    content,
    async confirm() {
      await useAuthStore().logout()
      window.$message?.success('已退出登录')
      isConfirming = false
    },
    cancel() {
      isConfirming = false
    },
  })
  return false
}

export function resolveResError(code, message, needTip = true, options = {}) {
  const { authExpired = true } = options
  switch (code) {
    case 401:
      if (authExpired)
        return handleAuthExpired('登录已过期，是否重新登录？', needTip)
      message = message ?? '认证失败'
      break
    case 11007:
    case 11008:
      return handleAuthExpired(`${message}，是否重新登录？`, needTip)
    case 403:
      message = message || '请求被拒绝'
      break
    case 404:
      message = '请求资源或接口不存在'
      break
    case 500:
      message = '服务器发生异常'
      break
    default:
      message = message ?? `【${code}】: 未知异常!`
      break
  }
  needTip && window.$message?.error(message)
  return message
}
