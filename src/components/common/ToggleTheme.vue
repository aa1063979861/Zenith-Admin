<template>
  <n-tooltip trigger="hover" placement="bottom">
    <template #trigger>
      <i
        id="toggleTheme"
        class="mr-16 cursor-pointer"
        :class="isDark ? 'i-fe:moon' : 'i-fe:sun'"
        role="button"
        tabindex="0"
        :title="tooltipText"
        :aria-label="tooltipText"
        :aria-pressed="isDark"
        @click="toggleDark"
        @keydown.enter.prevent="toggleDark"
        @keydown.space.prevent="toggleDark"
      />
    </template>
    {{ tooltipText }}
  </n-tooltip>
</template>

<script setup>
import { useAppStore } from '@/store'

const appStore = useAppStore()
const isDark = computed(() => appStore.isDark)
const tooltipText = computed(() => isDark.value ? '关闭护眼模式' : '开启护眼模式')

function toggleDark() {
  appStore.toggleDark()
}
</script>
