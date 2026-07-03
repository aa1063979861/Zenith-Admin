<template>
  <div
    ref="rootRef"
    class="app-date-picker"
    :class="{ 'app-date-picker--disabled': disabled, 'app-date-picker--open': panelVisible }"
  >
    <div class="app-date-picker__control" @click="openPanel">
      <input
        :value="inputValue"
        class="app-date-picker__input"
        :placeholder="placeholder"
        :disabled="disabled"
        readonly
        role="combobox"
        :aria-expanded="panelVisible"
        @keydown.enter.stop.prevent="openPanel"
        @keydown.space.stop.prevent="openPanel"
        @keydown.esc.stop.prevent="closePanel"
      >
      <button
        v-if="clearable && inputValue && !disabled"
        type="button"
        class="app-date-picker__clear"
        aria-label="清空日期"
        @mousedown.prevent
        @click.stop="clearValue"
      >
        <i class="i-fe:x" aria-hidden="true" />
      </button>
      <i v-else class="app-date-picker__icon i-fe:calendar" aria-hidden="true" />
    </div>

    <div
      v-if="panelVisible"
      class="app-date-picker__panel"
      tabindex="-1"
      @keydown.esc.stop.prevent="closePanel"
    >
      <template v-if="panelMode === 'date'">
        <div class="app-date-picker__header app-date-picker__header--date">
          <button type="button" class="app-date-picker__nav" aria-label="上一年" @click="changeYear(-1)">
            «
          </button>
          <button type="button" class="app-date-picker__nav" aria-label="上一月" @click="changeMonth(-1)">
            ‹
          </button>
          <div class="app-date-picker__date-title">
            <button type="button" class="app-date-picker__title-part" aria-label="选择年份" @click="showYearPanel">
              {{ visibleYear }} 年
            </button>
            <button type="button" class="app-date-picker__title-part" aria-label="选择月份" @click="showMonthPanel">
              {{ visibleMonth + 1 }} 月
            </button>
          </div>
          <button type="button" class="app-date-picker__nav" aria-label="下一月" @click="changeMonth(1)">
            ›
          </button>
          <button type="button" class="app-date-picker__nav" aria-label="下一年" @click="changeYear(1)">
            »
          </button>
        </div>

        <div class="app-date-picker__weekdays">
          <span v-for="weekday in weekdayLabels" :key="weekday">{{ weekday }}</span>
        </div>

        <div class="app-date-picker__dates">
          <button
            v-for="cell in dateCells"
            :key="cell.key"
            type="button"
            class="app-date-picker__date-cell"
            :class="cellClass(cell)"
            @click="selectDate(cell)"
          >
            {{ cell.day }}
          </button>
        </div>
      </template>

      <template v-else-if="panelMode === 'year'">
        <div class="app-date-picker__header app-date-picker__header--simple">
          <button type="button" class="app-date-picker__nav" aria-label="上十年" @click="changeDecade(-1)">
            «
          </button>
          <span class="app-date-picker__range-title">{{ decadeStart }} 年 - {{ decadeStart + 9 }} 年</span>
          <button type="button" class="app-date-picker__nav" aria-label="下十年" @click="changeDecade(1)">
            »
          </button>
        </div>

        <div class="app-date-picker__year-grid">
          <button
            v-for="year in decadeYears"
            :key="year"
            type="button"
            class="app-date-picker__grid-item"
            :class="{ 'app-date-picker__grid-item--selected': year === highlightedYear }"
            @click="selectYear(year)"
          >
            {{ year }}
          </button>
        </div>
      </template>

      <template v-else>
        <div class="app-date-picker__header app-date-picker__header--simple">
          <button type="button" class="app-date-picker__nav" aria-label="上一年" @click="changeYear(-1)">
            «
          </button>
          <button type="button" class="app-date-picker__title" @click="showYearPanel">
            {{ visibleYear }} 年
          </button>
          <button type="button" class="app-date-picker__nav" aria-label="下一年" @click="changeYear(1)">
            »
          </button>
        </div>

        <div class="app-date-picker__month-grid">
          <button
            v-for="(month, index) in monthLabels"
            :key="month"
            type="button"
            class="app-date-picker__grid-item"
            :class="{ 'app-date-picker__grid-item--selected': index === highlightedMonth }"
            @click="selectMonth(index)"
          >
            {{ month }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount } from 'vue'

defineOptions({ name: 'AppDatePicker' })

const props = defineProps({
  formattedValue: {
    type: String,
    default: null,
  },
  type: {
    type: String,
    default: 'date',
    validator: value => ['date', 'year'].includes(value),
  },
  valueFormat: {
    type: String,
    default: 'yyyy-MM-dd',
    validator: value => ['yyyy-MM-dd', 'yyyy'].includes(value),
  },
  clearable: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  placeholder: {
    type: String,
    default: '请选择日期',
  },
})

const emit = defineEmits(['update:formattedValue'])

const rootRef = ref(null)
const panelVisible = ref(false)
const panelMode = ref('date')
const visibleYear = ref(new Date().getFullYear())
const visibleMonth = ref(new Date().getMonth())

const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六']
const monthLabels = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

const inputValue = computed(() => props.formattedValue || '')
const selectedDate = computed(() => parseFormattedDate(props.formattedValue))
const todayDate = new Date()
const todayValue = formatDateValue(todayDate)

const decadeStart = computed(() => Math.floor(visibleYear.value / 10) * 10)
const decadeYears = computed(() => Array.from({ length: 10 }, (_, index) => decadeStart.value + index))
const highlightedYear = computed(() => selectedDate.value?.getFullYear() || todayDate.getFullYear())
const highlightedMonth = computed(() => {
  const date = selectedDate.value
  if (date && date.getFullYear() === visibleYear.value)
    return date.getMonth()
  if (!date && todayDate.getFullYear() === visibleYear.value)
    return todayDate.getMonth()
  return -1
})

const dateCells = computed(() => {
  const firstDay = new Date(visibleYear.value, visibleMonth.value, 1)
  const startDate = new Date(visibleYear.value, visibleMonth.value, 1 - firstDay.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + index)
    const value = formatDateValue(date)
    return {
      key: value,
      value,
      day: date.getDate(),
      inCurrentMonth: date.getMonth() === visibleMonth.value,
      selected: value === props.formattedValue,
      today: value === todayValue,
    }
  })
})

watch(
  () => props.formattedValue,
  () => {
    if (!panelVisible.value)
      syncVisibleDate()
  },
)

onMounted(() => {
  document.addEventListener('mousedown', handleDocumentMouseDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleDocumentMouseDown)
})

function openPanel() {
  if (props.disabled)
    return
  syncVisibleDate()
  panelMode.value = props.type === 'year' ? 'year' : 'date'
  panelVisible.value = true
}

function closePanel() {
  panelVisible.value = false
}

function clearValue() {
  emit('update:formattedValue', null)
  closePanel()
}

function showYearPanel() {
  panelMode.value = 'year'
}

function showMonthPanel() {
  panelMode.value = 'month'
}

function selectYear(year) {
  visibleYear.value = year
  if (props.type === 'year') {
    emit('update:formattedValue', String(year))
    closePanel()
    return
  }
  panelMode.value = 'month'
}

function selectMonth(month) {
  visibleMonth.value = month
  panelMode.value = 'date'
}

function selectDate(cell) {
  emit('update:formattedValue', cell.value)
  closePanel()
}

function changeDecade(offset) {
  visibleYear.value += offset * 10
}

function changeYear(offset) {
  visibleYear.value += offset
}

function changeMonth(offset) {
  const nextDate = new Date(visibleYear.value, visibleMonth.value + offset, 1)
  visibleYear.value = nextDate.getFullYear()
  visibleMonth.value = nextDate.getMonth()
}

function syncVisibleDate() {
  const date = selectedDate.value || todayDate
  visibleYear.value = date.getFullYear()
  visibleMonth.value = date.getMonth()
}

function cellClass(cell) {
  return {
    'app-date-picker__date-cell--outside': !cell.inCurrentMonth,
    'app-date-picker__date-cell--selected': cell.selected,
    'app-date-picker__date-cell--today': cell.today && !cell.selected,
  }
}

function handleDocumentMouseDown(event) {
  if (!panelVisible.value)
    return
  if (rootRef.value?.contains(event.target))
    return
  closePanel()
}

function parseFormattedDate(value) {
  if (!value)
    return null
  if (props.valueFormat === 'yyyy') {
    const year = Number(value)
    return Number.isInteger(year) ? new Date(year, 0, 1) : null
  }
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!matched)
    return null

  const year = Number(matched[1])
  const month = Number(matched[2]) - 1
  const day = Number(matched[3])
  const date = new Date(year, month, day)

  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day)
    return null

  return date
}

function formatDateValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
</script>

<style scoped>
.app-date-picker {
  position: relative;
  display: inline-block;
  width: 100%;
  color: #243449;
  font-size: 14px;
  letter-spacing: 0;
}

.app-date-picker__control {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  width: 100%;
  height: 34px;
  border: 1px solid #e0e4ec;
  border-radius: 3px;
  background: #fff;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.app-date-picker--open .app-date-picker__control {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.16);
}

.app-date-picker--disabled .app-date-picker__control {
  background: #f5f7fa;
  color: #bcc6d4;
  cursor: not-allowed;
}

.app-date-picker__input {
  min-width: 0;
  flex: 1;
  height: 100%;
  padding: 0 8px 0 12px;
  border: 0;
  outline: 0;
  background: transparent;
  color: inherit;
  cursor: inherit;
  font: inherit;
}

.app-date-picker__input::placeholder {
  color: #a8b3c2;
}

.app-date-picker__icon,
.app-date-picker__clear {
  flex: 0 0 auto;
  margin-right: 10px;
  color: #8b98aa;
  font-size: 14px;
}

.app-date-picker__clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
}

.app-date-picker__clear:hover {
  color: #409eff;
  background: #eef6ff;
}

.app-date-picker__panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 3000;
  box-sizing: border-box;
  width: 322px;
  overflow: hidden;
  border: 1px solid #e8edf4;
  border-radius: 3px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.16);
  user-select: none;
}

.app-date-picker__header {
  box-sizing: border-box;
  display: grid;
  align-items: center;
  height: 52px;
  padding: 0 12px;
}

.app-date-picker__header--date {
  grid-template-columns: 34px 34px 1fr 34px 34px;
}

.app-date-picker__header--simple {
  grid-template-columns: 34px 1fr 34px;
  border-bottom: 1px solid #e8edf4;
}

.app-date-picker__nav,
.app-date-picker__title,
.app-date-picker__title-part {
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: #243449;
  cursor: pointer;
  font: inherit;
}

.app-date-picker__nav {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 1;
}

.app-date-picker__date-title {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 0;
}

.app-date-picker__title {
  font-size: 16px;
  line-height: 28px;
  text-align: center;
}

.app-date-picker__title-part {
  min-width: 54px;
  padding: 0 8px;
  font-size: 16px;
  line-height: 28px;
}

.app-date-picker__range-title {
  color: #409eff;
  font-size: 16px;
  line-height: 28px;
  text-align: center;
}

.app-date-picker__nav:hover,
.app-date-picker__title:hover,
.app-date-picker__title-part:hover {
  background: #f5f8fc;
}

.app-date-picker__weekdays {
  display: grid;
  grid-template-columns: repeat(7, 41px);
  align-items: center;
  justify-content: center;
  height: 40px;
  border-bottom: 1px solid #e8edf4;
  color: #243449;
  font-size: 13px;
  text-align: center;
}

.app-date-picker__dates {
  display: grid;
  grid-template-columns: repeat(7, 41px);
  grid-auto-rows: 36px;
  justify-content: center;
  padding: 3px 12px 8px;
}

.app-date-picker__date-cell,
.app-date-picker__grid-item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: #243449;
  cursor: pointer;
  font-variant-numeric: tabular-nums;
}

.app-date-picker__date-cell {
  width: 24px;
  height: 24px;
  place-self: center;
  border-radius: 999px;
  font-size: 12px;
  line-height: 24px;
}

.app-date-picker__date-cell:hover {
  background: #f2f7ff;
}

.app-date-picker__date-cell--outside {
  color: #bcc6d4;
}

.app-date-picker__date-cell--today {
  color: #409eff;
}

.app-date-picker__date-cell--selected,
.app-date-picker__date-cell--selected:hover {
  background: #409eff;
  color: #fff;
}

.app-date-picker__year-grid,
.app-date-picker__month-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  padding: 16px 24px 20px;
}

.app-date-picker__year-grid {
  grid-auto-rows: 70px;
}

.app-date-picker__month-grid {
  grid-auto-rows: 64px;
}

.app-date-picker__grid-item {
  min-width: 0;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1;
}

.app-date-picker__grid-item--selected {
  color: #409eff;
  font-weight: 600;
}
</style>
