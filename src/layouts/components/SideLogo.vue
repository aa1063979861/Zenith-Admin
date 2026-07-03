<!--------------------------------
 - @Author: Ronnie Zhang
 - @LastEditor: Ronnie Zhang
 - @LastEditTime: 2023/12/16 18:50:28
 - @Email: zclzone@outlook.com
 - Copyright © 2023 Ronnie Zhang(大脸怪) | https://isme.top
 --------------------------------->

<template>
  <router-link class="side-brand" :class="{ 'side-brand--collapsed': appStore.collapsed }" to="/">
    <span class="side-brand__mark">
      <TheLogo />
    </span>
    <span v-show="!appStore.collapsed" class="side-brand__text">
      <span class="side-brand__name">众恒科技</span>
      <span class="side-brand__system">管理系统</span>
    </span>
  </router-link>
</template>

<script setup>
import { useAppStore } from '@/store'

const appStore = useAppStore()
</script>

<style scoped>
.side-brand {
  display: flex;
  align-items: center;
  height: 60px;
  padding: 0 18px;
  color: rgb(var(--primary-color));
  transition:
    background-color 0.2s ease,
    color 0.2s ease;
}

.side-brand:hover {
  background: rgba(var(--primary-color), 0.06);
}

.side-brand--collapsed {
  justify-content: center;
  padding: 0;
}

.side-brand__mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  border-radius: 10px;
  padding: 3px;
  background: linear-gradient(135deg, rgba(var(--primary-color), 0.12), rgba(var(--primary-color), 0.03)), #fff;
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.08),
    inset 0 0 0 1px rgba(var(--primary-color), 0.16);
}

.side-brand__text {
  display: flex;
  min-width: 0;
  margin-left: 10px;
  flex-direction: column;
  line-height: 1.1;
}

.side-brand__name {
  overflow: hidden;
  color: rgb(var(--primary-color));
  font-size: 16px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.side-brand__system {
  margin-top: 4px;
  color: #64748b;
  font-size: 11px;
  font-weight: 500;
}
</style>
