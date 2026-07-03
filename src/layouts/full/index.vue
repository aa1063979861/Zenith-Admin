<!--------------------------------
 - @Author: Ronnie Zhang
 - @LastEditor: Ronnie Zhang
 - @LastEditTime: 2023/12/16 18:51:02
 - @Email: zclzone@outlook.com
 - Copyright © 2023 Ronnie Zhang(大脸怪) | https://isme.top
 --------------------------------->

<template>
  <div class="wh-full flex">
    <aside
      v-if="!isTabletOrBelow"
      class="flex-col flex-shrink-0 transition-width-300"
      :class="appStore.collapsed ? 'w-64' : 'w-220'"
      border-r="1px solid light_border dark:dark_border"
    >
      <SideBar />
    </aside>

    <article class="w-0 flex-col flex-1">
      <AppHeader class="h-60 flex-shrink-0" />
      <div class="p-12" border-b="1px solid light_border dark:dark_border">
        <AppTab class="flex-shrink-0" />
      </div>
      <slot />
    </article>
    <ResponsiveSidebarDrawer v-if="isTabletOrBelow" />
  </div>
</template>

<script setup>
import { useResponsiveLayout } from '@/composables'
import { AppTab, ResponsiveSidebarDrawer } from '@/layouts/components'
import { useAppStore } from '@/store'
import AppHeader from './header/index.vue'
import SideBar from './sidebar/index.vue'

const appStore = useAppStore()
const { isTabletOrBelow } = useResponsiveLayout()
</script>

<style>
.collapsed {
  width: 64px;
}
</style>
