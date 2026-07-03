/**********************************
 * @Author: Ronnie Zhang
 * @LastEditor: Ronnie Zhang
 * @LastEditTime: 2023/12/05 21:25:31
 * @Email: zclzone@outlook.com
 * Copyright © 2023 Ronnie Zhang(大脸怪) | https://isme.top
 **********************************/

import { generate, getRgbStr } from '@arco-design/color'
import { defineStore } from 'pinia'
import { defaultLayout, defaultPrimaryColor, layoutSettingVisible, naiveThemeOverrides } from '@/settings'

function createDefaultRuntimeConfig() {
  return {
    layoutSettingVisible,
    performerDefaultsToReceiver: true,
    serviceYearPreviousYearDefault: true,
  }
}

export const useAppStore = defineStore('app', {
  state: () => ({
    collapsed: false,
    mobileSidebarVisible: false,
    isDark: false,
    layout: defaultLayout,
    primaryColor: defaultPrimaryColor,
    naiveThemeOverrides,
    runtimeConfig: createDefaultRuntimeConfig(),
  }),
  actions: {
    switchCollapsed() {
      this.collapsed = !this.collapsed
    },
    setCollapsed(b) {
      this.collapsed = b
    },
    setMobileSidebarVisible(visible) {
      this.mobileSidebarVisible = visible
    },
    toggleDark() {
      this.isDark = !this.isDark
    },
    setLayout(v) {
      this.layout = v
    },
    setPrimaryColor(color) {
      this.primaryColor = color
    },
    setRuntimeConfig(config = {}) {
      this.runtimeConfig = {
        ...createDefaultRuntimeConfig(),
        ...config,
      }
    },
    setThemeColor(color = this.primaryColor, isDark = this.isDark) {
      document.documentElement.classList.remove('dark')
      document.documentElement.classList.toggle('eye-care', isDark)
      document.body.classList.toggle('eye-care', isDark)
      const colors = generate(color, {
        list: true,
      })
      document.body.style.setProperty('--primary-color', getRgbStr(colors[5]))
      document.body.style.setProperty('--zenith-primary-color', getRgbStr(colors[5]))
      this.naiveThemeOverrides.common = Object.assign(this.naiveThemeOverrides.common || {}, {
        primaryColor: colors[5],
        primaryColorHover: colors[4],
        primaryColorSuppl: colors[4],
        primaryColorPressed: colors[6],
      })
    },
  },
  persist: {
    pick: ['collapsed', 'isDark', 'layout', 'primaryColor', 'naiveThemeOverrides'],
    storage: sessionStorage,
  },
})
