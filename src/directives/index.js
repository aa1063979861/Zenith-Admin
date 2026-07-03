/**********************************
 * @Author: Ronnie Zhang
 * @LastEditor: Ronnie Zhang
 * @LastEditTime: 2023/12/05 21:23:01
 * @Email: zclzone@outlook.com
 * Copyright © 2023 Ronnie Zhang(大脸怪) | https://isme.top
 **********************************/

import { withDirectives } from 'vue'
import { router } from '@/router'
import { usePermissionStore, useUserStore } from '@/store'

const filterBarCollapse = {
  bars: new Map(),
  observer: null,
  resizeObserver: null,
  mediaQuery: null,
  scheduleId: 0,
  clickHandler: null,
}

const FILTER_BAR_SELECTOR = '.zenith-filter-bar'
const FILTER_ACTIONS_SELECTOR = '.zenith-filter-actions'
const FILTER_HIDDEN_CLASS = 'zenith-filter-item-hidden'
const FILTER_EXTRA_CLASS = 'zenith-filter-item-extra'
const FILTER_TOGGLE_CLASS = 'zenith-filter-toggle'
const FILTER_COLLAPSIBLE_CLASS = 'is-filter-collapsible'
const FILTER_EXPANDED_CLASS = 'is-filter-expanded'
const FILTER_CLEANUP_KEY = '__zenithFilterBarCollapseCleanup'

const permission = {
  getCodes() {
    const currentRoute = unref(router.currentRoute)
    const routeCodes = currentRoute.meta?.btns?.map(item => item.code) || []
    const permissionStore = usePermissionStore()
    const assignedButtonCodes = collectButtonCodes(permissionStore.permissions)
    return [...new Set([...routeCodes, ...assignedButtonCodes])]
  },
  mounted(el, binding) {
    if (!hasPermission(binding.value)) {
      el.remove()
    }
  },
}

function isBuiltInUser() {
  return useUserStore().userInfo?.builtIn === true
}

function collectButtonCodes(nodes = []) {
  const codes = []
  const walk = (items) => {
    items.forEach((item) => {
      if (item.type === 'BUTTON')
        codes.push(item.code)
      if (item.children?.length)
        walk(item.children)
    })
  }
  walk(nodes)
  return codes
}

export function hasPermission(code) {
  return isBuiltInUser() || permission.getCodes().includes(code)
}

export function setupDirectives(app) {
  app.directive('permission', permission)
  setupFilterBarCollapse()
}

function setupFilterBarCollapse() {
  if (typeof window === 'undefined')
    return

  window[FILTER_CLEANUP_KEY]?.()
  resetFilterCollapseRuntime()

  filterBarCollapse.resizeObserver = new ResizeObserver(() => scheduleFilterBarScan())
  filterBarCollapse.observer = new MutationObserver(() => scheduleFilterBarScan())
  filterBarCollapse.observer.observe(document.body, { childList: true, subtree: true })
  filterBarCollapse.mediaQuery = window.matchMedia('(max-width: 767px)')
  filterBarCollapse.mediaQuery.addEventListener('change', scheduleFilterBarScan)
  window.addEventListener('resize', scheduleFilterBarScan, { passive: true })
  filterBarCollapse.clickHandler = handleFilterToggleClick
  document.addEventListener('click', filterBarCollapse.clickHandler)
  window[FILTER_CLEANUP_KEY] = cleanupFilterBarCollapse
  scheduleFilterBarScan()
}

function cleanupFilterBarCollapse() {
  filterBarCollapse.observer?.disconnect()
  filterBarCollapse.resizeObserver?.disconnect()
  filterBarCollapse.mediaQuery?.removeEventListener('change', scheduleFilterBarScan)
  window.removeEventListener('resize', scheduleFilterBarScan)
  if (filterBarCollapse.clickHandler)
    document.removeEventListener('click', filterBarCollapse.clickHandler)
  if (filterBarCollapse.scheduleId)
    window.cancelAnimationFrame(filterBarCollapse.scheduleId)
  for (const state of filterBarCollapse.bars.values())
    state.toggle.remove()
  document.querySelectorAll(`.${FILTER_TOGGLE_CLASS}`).forEach(toggle => toggle.remove())
  resetFilterCollapseRuntime()
}

function resetFilterCollapseRuntime() {
  filterBarCollapse.bars.clear()
  filterBarCollapse.observer = null
  filterBarCollapse.resizeObserver = null
  filterBarCollapse.mediaQuery = null
  filterBarCollapse.scheduleId = 0
  filterBarCollapse.clickHandler = null
}

function scheduleFilterBarScan() {
  if (filterBarCollapse.scheduleId)
    return
  filterBarCollapse.scheduleId = window.requestAnimationFrame(() => {
    filterBarCollapse.scheduleId = 0
    scanFilterBars()
  })
}

function scanFilterBars() {
  for (const [bar, state] of filterBarCollapse.bars) {
    if (!document.body.contains(bar)) {
      disposeFilterBar(state)
      filterBarCollapse.bars.delete(bar)
    }
  }

  document.querySelectorAll(FILTER_BAR_SELECTOR).forEach((bar) => {
    if (!filterBarCollapse.bars.has(bar))
      filterBarCollapse.bars.set(bar, createFilterBarState(bar, bar.querySelector(`.${FILTER_TOGGLE_CLASS}`) || undefined))
    updateFilterBar(filterBarCollapse.bars.get(bar))
  })
}

function createFilterBarState(bar, toggle = createFilterToggle()) {
  const state = {
    bar,
    expanded: false,
    toggle,
  }
  filterBarCollapse.resizeObserver.observe(bar)
  return state
}

function handleFilterToggleClick(event) {
  const toggle = event.target.closest?.(`.${FILTER_TOGGLE_CLASS}`)
  if (!toggle)
    return

  const bar = toggle.closest(FILTER_BAR_SELECTOR)
  if (!bar)
    return

  event.preventDefault()
  const state = filterBarCollapse.bars.get(bar) || createFilterBarState(bar, toggle)
  filterBarCollapse.bars.set(bar, state)
  if (state.toggle !== toggle) {
    state.toggle.remove()
    state.toggle = toggle
  }
  state.expanded = !state.expanded
  updateFilterBar(state)
}

function createFilterToggle() {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = FILTER_TOGGLE_CLASS
  return button
}

function disposeFilterBar(state) {
  filterBarCollapse.resizeObserver.unobserve(state.bar)
  state.toggle.remove()
}

function updateFilterBar(state) {
  const { bar, toggle } = state
  const root = getFilterContentRoot(bar)
  const actions = getFilterActions(bar)
  const actionSlot = actions?.querySelector('.n-space') || actions
  const items = getFilterItems(root)

  if (!root || !actions || !actionSlot || !items.length) {
    resetFilterBarState(state)
    return
  }

  if (!actionSlot.contains(toggle))
    actionSlot.appendChild(toggle)

  if (!state.expanded)
    items.forEach(item => item.classList.remove(FILTER_EXTRA_CLASS))
  items.forEach(item => item.classList.remove(FILTER_HIDDEN_CLASS))
  bar.classList.toggle(FILTER_EXPANDED_CLASS, state.expanded)
  toggle.hidden = false

  const collapsedRows = getCollapsedRows(bar)
  const shouldCollapse = isFilterOverflowing(bar, root, actions, collapsedRows)

  if (!shouldCollapse) {
    state.expanded = false
    resetFilterBarState(state)
    return
  }

  bar.classList.add(FILTER_COLLAPSIBLE_CLASS)
  toggle.hidden = false

  if (!state.expanded)
    collapseFilterItems(bar, root, actions, items, collapsedRows)

  renderFilterToggle(toggle, state.expanded)
}

function resetFilterBarState(state) {
  state.expanded = false
  state.bar.classList.remove(FILTER_COLLAPSIBLE_CLASS, FILTER_EXPANDED_CLASS)
  state.bar.querySelectorAll(`.${FILTER_HIDDEN_CLASS}, .${FILTER_EXTRA_CLASS}`).forEach(item => item.classList.remove(FILTER_HIDDEN_CLASS, FILTER_EXTRA_CLASS))
  state.toggle.hidden = true
}

function getFilterContentRoot(bar) {
  if (bar.querySelector('.me-crud-query-fields .n-space'))
    return bar.querySelector('.me-crud-query-fields .n-space')
  if (bar.querySelector('.n-grid'))
    return bar.querySelector('.n-grid')
  if (bar.classList.contains('n-form--inline'))
    return bar
  return null
}

function getFilterActions(bar) {
  return bar.querySelector(FILTER_ACTIONS_SELECTOR)
}

function getFilterItems(root) {
  if (!root)
    return []
  return Array.from(root.children).filter(item => !item.classList.contains(FILTER_ACTIONS_SELECTOR.slice(1)))
}

function getCollapsedRows(bar) {
  if (bar.dataset.filterCollapsedRows === 'all')
    return Number.POSITIVE_INFINITY
  const explicitRows = Number(bar.dataset.filterCollapsedRows)
  if (Number.isInteger(explicitRows) && explicitRows > 0)
    return explicitRows
  return filterBarCollapse.mediaQuery?.matches ? 2 : 1
}

function isFilterOverflowing(bar, root, actions, collapsedRows) {
  const rows = countRows(root, getVisibleFilterChildren(root))
  const actionRow = getActionRow(root, actions)
  return rows > collapsedRows || actionRow > collapsedRows
}

function collapseFilterItems(bar, root, actions, items, collapsedRows) {
  bar.classList.add(FILTER_COLLAPSIBLE_CLASS)
  for (let index = items.length - 1; index >= 1; index -= 1) {
    if (!isFilterOverflowing(bar, root, actions, collapsedRows))
      break
    items[index].classList.add(FILTER_HIDDEN_CLASS, FILTER_EXTRA_CLASS)
  }
}

function getVisibleFilterChildren(root) {
  return Array.from(root.children).filter(item => !item.classList.contains(FILTER_HIDDEN_CLASS))
}

function countRows(root, elements) {
  const rootTop = root.getBoundingClientRect().top
  const rows = []
  elements.forEach((item) => {
    const top = Math.round(item.getBoundingClientRect().top - rootTop)
    if (!rows.some(rowTop => Math.abs(rowTop - top) <= 3))
      rows.push(top)
  })
  return rows.length
}

function getActionRow(root, actions) {
  if (!root.contains(actions))
    return 1
  const rootTop = root.getBoundingClientRect().top
  const actionTop = Math.round(actions.getBoundingClientRect().top - rootTop)
  const rows = []
  getVisibleFilterChildren(root).forEach((item) => {
    const top = Math.round(item.getBoundingClientRect().top - rootTop)
    if (!rows.some(rowTop => Math.abs(rowTop - top) <= 3))
      rows.push(top)
  })
  const rowIndex = rows.findIndex(rowTop => Math.abs(rowTop - actionTop) <= 3)
  return rowIndex >= 0 ? rowIndex + 1 : rows.length + 1
}

function renderFilterToggle(toggle, expanded) {
  toggle.setAttribute('aria-expanded', String(expanded))
  toggle.setAttribute('aria-label', expanded ? '收起筛选条件' : '展开更多筛选条件')
  toggle.innerHTML = expanded
    ? '<i class="i-fe:chevrons-up" aria-hidden="true"></i><span>收起</span>'
    : '<i class="i-fe:chevrons-down" aria-hidden="true"></i><span>更多</span>'
}

if (import.meta.hot)
  import.meta.hot.dispose(cleanupFilterBarCollapse)

/**
 * 用于h函数使用自定义权限指令
 *
 * @param {*} vnode 虚拟节点
 * @param {*} code 权限码
 * @returns 返回一个包含权限指令的vnode
 *
 * 使用示例：withPermission(h('button', {class: 'text-red-500'}, '删除'), 'user:delete')
 *
 */
export function withPermission(vnode, code) {
  if (!hasPermission(code))
    return null
  return withDirectives(vnode, [[permission, code]])
}
