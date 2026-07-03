<!--------------------------------
 - @Author: Ronnie Zhang
 - @LastEditor: Ronnie Zhang
 - @LastEditTime: 2023/12/04 22:51:12
 - @Email: zclzone@outlook.com
 - Copyright © 2023 Ronnie Zhang(大脸怪) | https://isme.top
 --------------------------------->

<template>
  <main class="app-page h-full flex-col flex-1 overflow-hidden bg-#f5f6fb dark:bg-#121212">
    <main :class="{ 'flex-1': full, 'cus-scroll flex-1': !full }" class="app-page-body m-12">
      <slot />
    </main>
    <slot name="footer">
      <TheFooter v-if="showFooter && !full" class="app-page-footer flex-shrink-0 py-10" />
    </slot>
    <n-back-top :bottom="20" />
  </main>
</template>

<script setup>
defineProps({
  full: {
    type: Boolean,
    default: false,
  },
  showFooter: {
    type: Boolean,
    default: true,
  },
})
</script>

<style scoped>
.app-page-footer {
  border-top: 1px solid rgba(15, 23, 42, 0.06);
  background: #f5f6fb;
}

.dark .app-page-footer {
  border-top-color: rgba(255, 255, 255, 0.08);
  background: #121212;
}
</style>
