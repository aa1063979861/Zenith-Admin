<!--------------------------------
 - @Author: Ronnie Zhang
 - @LastEditor: Ronnie Zhang
 - @LastEditTime: 2023/12/16 18:49:53
 - @Email: zclzone@outlook.com
 - Copyright © 2023 Ronnie Zhang(大脸怪) | https://isme.top
 --------------------------------->

<template>
  <div
    class="layout-setting-float"
    :class="{
      'layout-setting-float--collapsed': collapsed,
      'layout-setting-float--dragging': dragging,
      [`layout-setting-float--${collapsedEdge}`]: collapsed,
    }"
    :style="floatStyle"
    @mouseenter="handleFloatEnter"
    @mouseleave="scheduleAutoCollapse"
    @focusin="handleFloatEnter"
    @focusout="scheduleAutoCollapse"
  >
    <button
      v-if="collapsed"
      class="layout-setting-reveal"
      type="button"
      title="展开布局设置"
      aria-label="展开布局设置"
      @click.stop="expandFromEdge"
    >
      <i
        class="layout-setting-reveal-icon"
        :class="revealIcon"
      />
    </button>

    <button
      v-else
      id="layout-setting"
      class="layout-setting-trigger"
      type="button"
      aria-label="布局设置"
      @click="openSetting"
      @pointerdown="handlePointerDown"
    >
      <i class="layout-setting-trigger-icon i-fe:settings" />
    </button>

    <MeModal ref="modalRef" title="布局设置" :show-footer="false" width="600px">
      <n-space justify="space-between">
        <div class="flex-col cursor-pointer justify-center" @click="appStore.setLayout('simple')">
          <div class="flex">
            <n-skeleton :width="20" :height="60" />
            <div class="ml-4">
              <n-skeleton :width="80" :height="60" />
            </div>
          </div>
          <n-button
            class="mt-12"
            size="small"
            :type="appStore.layout === 'simple' ? 'primary' : ''"
            ghost
          >
            简约
          </n-button>
        </div>
        <div class="flex-col cursor-pointer justify-center" @click="appStore.setLayout('normal')">
          <div class="flex">
            <n-skeleton :width="20" :height="60" />
            <div class="ml-4">
              <n-skeleton :width="80" :height="10" />
              <n-skeleton class="mt-4" :width="80" :height="46" />
            </div>
          </div>
          <n-button
            class="mt-12"
            size="small"
            :type="appStore.layout === 'normal' ? 'primary' : ''"
            ghost
          >
            通用
          </n-button>
        </div>

        <div class="flex-col cursor-pointer justify-center" @click="appStore.setLayout('full')">
          <div class="flex">
            <n-skeleton :width="20" :height="60" />
            <div class="ml-4">
              <n-skeleton :width="80" :height="6" />
              <n-skeleton class="mt-4" :width="80" :height="4" />
              <n-skeleton class="mt-4" :width="80" :height="42" />
            </div>
          </div>
          <n-button
            class="mt-12"
            size="small"
            :type="appStore.layout === 'full' ? 'primary' : ''"
            ghost
          >
            全面
          </n-button>
        </div>
        <div class="flex-col cursor-pointer justify-center" @click="appStore.setLayout('empty')">
          <div class="flex">
            <n-skeleton :width="104" :height="60" />
          </div>
          <n-button
            class="mt-12"
            size="small"
            :type="appStore.layout === 'empty' ? 'primary' : ''"
            ghost
          >
            空白
          </n-button>
        </div>
      </n-space>
      <p class="mt-16 opacity-50">
        注: 此设置仅对未设置layout或者设置成跟随系统的页面有效，菜单设置的layout优先级最高
      </p>
    </MeModal>
  </div>
</template>

<script setup>
import { MeModal } from '@/components'
import { useModal } from '@/composables'
import { useAppStore } from '@/store'

const appStore = useAppStore()
const [modalRef] = useModal()

const STORAGE_KEY = 'zenith-layout-setting-float'
const GAP = 12
const FLOAT_WIDTH = 40
const FLOAT_HEIGHT = 40
const REVEAL_SIZE = 28
const AUTO_HIDE_DELAY = 1000
const EDGE_SNAP_DISTANCE = 16
const EDGE_NAMES = ['left', 'right', 'top', 'bottom']

const collapsed = ref(false)
const collapsedEdge = ref('right')
const dragging = ref(false)
const position = ref({ x: 0, y: 0 })
const floatStyle = computed(() => ({
  left: `${position.value.x}px`,
  top: `${position.value.y}px`,
}))
const revealIcon = computed(() => ({
  left: 'i-fe:chevron-right',
  right: 'i-fe:chevron-left',
  top: 'i-fe:chevron-down',
  bottom: 'i-fe:chevron-up',
})[collapsedEdge.value])

let dragStart = null
let suppressClick = false
let autoHideTimer = null

function getDefaultPosition() {
  return {
    x: window.innerWidth - FLOAT_WIDTH - GAP,
    y: Math.round((window.innerHeight - FLOAT_HEIGHT) / 2),
  }
}

function getFloatSize() {
  return collapsed.value
    ? { width: REVEAL_SIZE, height: REVEAL_SIZE }
    : { width: FLOAT_WIDTH, height: FLOAT_HEIGHT }
}

function clampPosition(value) {
  const { width, height } = getFloatSize()
  const maxX = Math.max(0, window.innerWidth - width)
  const maxY = Math.max(0, window.innerHeight - height)
  return {
    x: Math.min(Math.max(0, value.x), maxX),
    y: Math.min(Math.max(0, value.y), maxY),
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    x: position.value.x,
    y: position.value.y,
    collapsed: collapsed.value,
    edge: collapsedEdge.value,
  }))
}

function loadState() {
  position.value = clampPosition(getDefaultPosition())

  const rawState = localStorage.getItem(STORAGE_KEY)
  if (!rawState)
    return

  try {
    const state = JSON.parse(rawState)
    if (Number.isFinite(state.x) && Number.isFinite(state.y))
      position.value = clampPosition({ x: state.x, y: state.y })
    if (EDGE_NAMES.includes(state.edge))
      collapsedEdge.value = state.edge
    collapsed.value = state.collapsed === true
    if (collapsed.value)
      position.value = getEdgePosition(collapsedEdge.value, position.value)
  }
  catch {
    saveState()
  }
}

function clearAutoHide() {
  if (autoHideTimer) {
    window.clearTimeout(autoHideTimer)
    autoHideTimer = null
  }
}

function getNearestEdge(value = position.value) {
  const { width, height } = getFloatSize()
  const centerX = value.x + width / 2
  const centerY = value.y + height / 2
  const distances = [
    { edge: 'left', value: centerX },
    { edge: 'right', value: window.innerWidth - centerX },
    { edge: 'top', value: centerY },
    { edge: 'bottom', value: window.innerHeight - centerY },
  ]
  return distances.reduce((best, item) => item.value < best.value ? item : best).edge
}

function getTouchedEdge(value = position.value) {
  const { width, height } = getFloatSize()
  if (value.x <= EDGE_SNAP_DISTANCE)
    return 'left'
  if (value.x + width >= window.innerWidth - EDGE_SNAP_DISTANCE)
    return 'right'
  if (value.y <= EDGE_SNAP_DISTANCE)
    return 'top'
  if (value.y + height >= window.innerHeight - EDGE_SNAP_DISTANCE)
    return 'bottom'
  return ''
}

function getEdgePosition(edge, value = position.value) {
  const { width, height } = getFloatSize()
  const next = { ...value }
  if (edge === 'left')
    next.x = 0
  if (edge === 'right')
    next.x = window.innerWidth - width
  if (edge === 'top')
    next.y = 0
  if (edge === 'bottom')
    next.y = window.innerHeight - height
  return clampPosition(next)
}

function collapseFloat(edge = getNearestEdge()) {
  collapsedEdge.value = edge
  collapsed.value = true
  nextTick(() => {
    position.value = getEdgePosition(edge)
    saveState()
  })
}

function expandFloat() {
  const edge = collapsedEdge.value
  collapsed.value = false
  nextTick(() => {
    position.value = getExpandedPosition(edge)
    saveState()
  })
}

function expandFromEdge() {
  clearAutoHide()
  expandFloat()
  scheduleAutoCollapse()
}

function getExpandedPosition(edge = collapsedEdge.value) {
  const next = { ...position.value }
  if (edge === 'left')
    next.x = GAP
  if (edge === 'right')
    next.x = window.innerWidth - FLOAT_WIDTH - GAP
  if (edge === 'top')
    next.y = GAP
  if (edge === 'bottom')
    next.y = window.innerHeight - FLOAT_HEIGHT - GAP
  return clampPosition(next)
}

function scheduleAutoCollapse() {
  clearAutoHide()
  autoHideTimer = window.setTimeout(() => {
    if (!dragging.value && !dragStart)
      collapseFloat()
  }, AUTO_HIDE_DELAY)
}

function handleFloatEnter() {
  clearAutoHide()
}

function openSetting() {
  if (suppressClick)
    return
  clearAutoHide()
  modalRef.value?.open()
}

function handlePointerDown(event) {
  if (collapsed.value || event.button !== 0)
    return

  clearAutoHide()
  event.preventDefault()
  dragging.value = false
  dragStart = {
    x: event.clientX,
    y: event.clientY,
    left: position.value.x,
    top: position.value.y,
  }
  event.currentTarget.setPointerCapture?.(event.pointerId)
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', handlePointerUp, { once: true })
  window.addEventListener('pointercancel', handlePointerUp, { once: true })
}

function handlePointerMove(event) {
  if (!dragStart)
    return

  const dx = event.clientX - dragStart.x
  const dy = event.clientY - dragStart.y
  if (!dragging.value && Math.abs(dx) < 4 && Math.abs(dy) < 4)
    return

  dragging.value = true
  suppressClick = true
  position.value = clampPosition({
    x: dragStart.left + dx,
    y: dragStart.top + dy,
  })
  collapsedEdge.value = getNearestEdge()
}

function handlePointerUp() {
  const touchedEdge = dragging.value ? getTouchedEdge() : ''

  if (dragging.value) {
    collapsedEdge.value = touchedEdge || getNearestEdge()
    saveState()
  }

  dragStart = null
  dragging.value = false
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
  window.removeEventListener('pointercancel', handlePointerUp)
  window.setTimeout(() => {
    suppressClick = false
  })
  if (touchedEdge)
    collapseFloat(touchedEdge)
  else
    scheduleAutoCollapse()
}

function handleResize() {
  position.value = clampPosition(position.value)
  if (collapsed.value)
    position.value = getEdgePosition(collapsedEdge.value)
  saveState()
}

onMounted(() => {
  loadState()
  scheduleAutoCollapse()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  clearAutoHide()
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
  window.removeEventListener('pointercancel', handlePointerUp)
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.layout-setting-float {
  position: fixed;
  z-index: 999;
  display: flex;
  align-items: center;
  opacity: 0.88;
  transition:
    opacity 0.16s ease,
    left 0.16s ease,
    top 0.16s ease;
  user-select: none;
}

.layout-setting-float:hover,
.layout-setting-float--dragging {
  opacity: 1;
  transition: none;
}

.layout-setting-float--collapsed {
  opacity: 0.74;
}

.layout-setting-float--collapsed:hover,
.layout-setting-float--collapsed:focus-within {
  opacity: 1;
}

.layout-setting-reveal,
.layout-setting-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  outline: none;
}

.layout-setting-reveal {
  width: 28px;
  height: 28px;
  border: 1px solid #dce5ea;
  background: #fff;
  box-shadow: 0 6px 16px rgb(15 23 42 / 10%);
  color: #52616d;
  cursor: pointer;
}

.layout-setting-float--left .layout-setting-reveal {
  border-radius: 0 999px 999px 0;
  border-left: 0;
}

.layout-setting-float--right .layout-setting-reveal {
  border-right: 0;
  border-radius: 999px 0 0 999px;
}

.layout-setting-float--top .layout-setting-reveal {
  border-top: 0;
  border-radius: 0 0 999px 999px;
}

.layout-setting-float--bottom .layout-setting-reveal {
  border-bottom: 0;
  border-radius: 999px 999px 0 0;
}

.layout-setting-trigger {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: rgb(var(--primary-color));
  box-shadow: 0 8px 22px rgb(15 23 42 / 16%);
  cursor: grab;
}

.layout-setting-float--dragging .layout-setting-trigger {
  cursor: grabbing;
}

.layout-setting-reveal-icon,
.layout-setting-trigger-icon {
  background-color: currentColor;
}

.layout-setting-reveal-icon {
  color: currentColor;
  font-size: 14px;
}

.layout-setting-trigger-icon {
  color: #fff;
  font-size: 20px;
}
</style>
