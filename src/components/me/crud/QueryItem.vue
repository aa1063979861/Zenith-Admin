<!--------------------------------
 - @Author: Ronnie Zhang
 - @LastEditor: Ronnie Zhang
 - @LastEditTime: 2023/12/04 22:51:48
 - @Email: zclzone@outlook.com
 - Copyright © 2023 Ronnie Zhang(大脸怪) | https://isme.top
 --------------------------------->

<template>
  <div class="me-query-item" :style="queryItemStyle">
    <label v-if="label || label === 0" class="me-query-item-label">
      {{ label }}
    </label>
    <div class="me-query-item-content">
      <slot />
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  label: {
    type: String,
    default: '',
  },
  labelWidth: {
    type: Number,
    default: 80,
  },
  contentWidth: {
    type: Number,
    default: 200,
  },
})

const queryItemStyle = computed(() => ({
  '--me-query-label-width': `${props.labelWidth}px`,
  '--me-query-content-width': `${props.contentWidth}px`,
}))
</script>

<style scoped>
.me-query-item {
  display: flex;
  min-width: 0;
  align-items: center;
}

.me-query-item-label {
  width: var(--me-query-label-width);
  flex: 0 0 var(--me-query-label-width);
  color: #475569;
  font-size: 13px;
  font-weight: 500;
}

.me-query-item-content {
  width: var(--me-query-content-width);
  flex: 0 0 var(--me-query-content-width);
  min-width: 0;
}

@media (max-width: 767px) {
  .me-query-item {
    width: 100%;
  }

  .me-query-item-content {
    width: auto;
    flex: 1 1 auto;
  }
}
</style>
