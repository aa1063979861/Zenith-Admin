/**********************************
 * @Author: Ronnie Zhang
 * @LastEditor: Ronnie Zhang
 * @LastEditTime: 2023/12/05 21:25:39
 * @Email: zclzone@outlook.com
 * Copyright © 2023 Ronnie Zhang(大脸怪) | https://isme.top
 **********************************/

import { defineStore } from 'pinia'
import { usePermissionStore, useRouterStore, useTabStore, useUserStore } from '@/store'
import { authRequest } from '@/utils/http/auth-request'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    accessToken: undefined,
  }),
  actions: {
    setToken({ accessToken }) {
      this.accessToken = accessToken
    },
    async refreshToken() {
      const { data: response } = await authRequest.post('/auth/refresh/token')
      this.setToken(response.data)
      return response.data
    },
    resetToken() {
      this.$reset()
    },
    toLogin() {
      const { router } = useRouterStore()
      return router.replace({
        path: '/login',
      })
    },
    async switchCurrentRole(data) {
      await this.replaceLoginSession(data)
    },
    async replaceLoginSession(data) {
      this.resetLoginState()
      await nextTick()
      this.setToken(data)
    },
    resetLoginState() {
      const { resetUser } = useUserStore()
      const { resetRouter } = useRouterStore()
      const { resetPermission, accessRoutes } = usePermissionStore()
      const { resetTabs } = useTabStore()
      // 重置路由
      resetRouter(accessRoutes)
      // 重置用户
      resetUser()
      // 重置权限
      resetPermission()
      // 重置Tabs
      resetTabs()
      // 重置token
      this.resetToken()
    },
    async logout() {
      try {
        await authRequest.post('/auth/logout')
      }
      finally {
        await this.clearLoginState()
      }
    },
    async clearLoginState() {
      this.resetLoginState()
      await nextTick()
      await this.toLogin()
    },
  },
  persist: {
    key: 'zenith-admin_auth',
    storage: sessionStorage,
  },
})
