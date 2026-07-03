<template>
  <n-tooltip trigger="hover" placement="bottom">
    <template #trigger>
      <i
        id="fullscreen"
        class="mr-16 cursor-pointer"
        :class="isFullscreen ? 'i-fe:minimize' : 'i-fe:maximize'"
        role="button"
        tabindex="0"
        :title="tooltipText"
        :aria-label="tooltipText"
        :aria-pressed="isFullscreen"
        @click="toggle"
        @keydown.enter.prevent="toggle"
        @keydown.space.prevent="toggle"
      />
    </template>
    {{ tooltipText }}
  </n-tooltip>
</template>

<script setup>
import { useFullscreen } from '@vueuse/core'

const { isFullscreen, toggle } = useFullscreen()
const tooltipText = computed(() => isFullscreen.value ? '退出全屏' : '进入全屏')
</script>
