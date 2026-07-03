<template>
  <n-drawer v-model:show="appStore.mobileSidebarVisible" :width="280" placement="left">
    <n-drawer-content class="mobile-sidebar-drawer" closable>
      <template #header>
        <SideLogo />
      </template>
      <SideMenu class="mobile-sidebar-menu cus-scroll-y" />
    </n-drawer-content>
  </n-drawer>
</template>

<script setup>
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/store'
import SideLogo from './SideLogo.vue'
import SideMenu from './SideMenu.vue'

const route = useRoute()
const appStore = useAppStore()

watch(
  () => route.fullPath,
  () => {
    appStore.setMobileSidebarVisible(false)
  },
)
</script>

<style scoped>
:deep(.mobile-sidebar-drawer .n-drawer-body-content-wrapper) {
  height: 100%;
  padding: 0;
}

.mobile-sidebar-menu {
  height: 100%;
}
</style>
