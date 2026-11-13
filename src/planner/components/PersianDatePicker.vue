<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  SHAMSI_MONTHS,
  SHAMSI_WEEKDAYS_SHORT,
  toPersianDigits,
  getShamsiMonthDays,
  getShamsiDayOfWeek,
  parseDateToJalali,
  jalaliToIso,
  formatJalaliDisplay,
  gregorianToJalali,
  jalaliToGregorian,
} from '../utils/shamsi'

const props = withDefaults(
  defineProps<{
    modelValue?: string | null
    placeholder?: string
    format?: 'iso' | 'shamsi'
    disabled?: boolean
    open?: boolean
    hideInput?: boolean
  }>(),
  {
    modelValue: '',
    placeholder: 'انتخاب تاریخ شمسی...',
    format: 'iso',
    disabled: false,
    open: undefined,
    hideInput: false,
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'update:open', value: boolean): void
  (e: 'change', value: string): void
}>()

const internalOpen = ref(false)
const isOpen = computed({
  get: () => props.open !== undefined ? props.open : internalOpen.value,
  set: (val: boolean) => {
    internalOpen.value = val
    emit('update:open', val)
  }
})

// Today's Jalali date
const now = new Date()
const todayJalali = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate())

// Calendar view state (which year/month is currently being browsed)
const viewYear = ref(todayJalali.jy)
const viewMonth = ref(todayJalali.jm)

// Selected Jalali date
const selectedYear = ref<number | null>(null)
const selectedMonth = ref<number | null>(null)
const selectedDay = ref<number | null>(null)

// Synchronize with modelValue
watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      const parsed = parseDateToJalali(val)
      selectedYear.value = parsed.jy
      selectedMonth.value = parsed.jm
      selectedDay.value = parsed.jd
      viewYear.value = parsed.jy
      viewMonth.value = parsed.jm
    } else {
      selectedYear.value = null
      selectedMonth.value = null
      selectedDay.value = null
      viewYear.value = todayJalali.jy
      viewMonth.value = todayJalali.jm
    }
  },
  { immediate: true }
)

const displayLabel = computed(() => {
  if (!selectedYear.value || !selectedMonth.value || !selectedDay.value) {
    return ''
  }
  const monthName = SHAMSI_MONTHS[selectedMonth.value - 1]
  const dFa = toPersianDigits(selectedDay.value)
  const yFa = toPersianDigits(selectedYear.value)
  const mFa = toPersianDigits(String(selectedMonth.value).padStart(2, '0'))
  const dayFa = toPersianDigits(String(selectedDay.value).padStart(2, '0'))
  return `${dFa} ${monthName} ${yFa} (${yFa}/${mFa}/${dayFa})`
})

const daysInMonth = computed(() => getShamsiMonthDays(viewYear.value, viewMonth.value))
const firstDayOfWeek = computed(() => getShamsiDayOfWeek(viewYear.value, viewMonth.value, 1))

// Available years range (1400 to 1415)
const availableYears = Array.from({ length: 16 }, (_, i) => 1400 + i)

function openPicker() {
  if (props.disabled) return
  if (selectedYear.value && selectedMonth.value) {
    viewYear.value = selectedYear.value
    viewMonth.value = selectedMonth.value
  } else {
    viewYear.value = todayJalali.jy
    viewMonth.value = todayJalali.jm
  }
  isOpen.value = true
}

function closePicker() {
  isOpen.value = false
}

function prevMonth() {
  if (viewMonth.value === 1) {
    viewMonth.value = 12
    viewYear.value -= 1
  } else {
    viewMonth.value -= 1
  }
}

function nextMonth() {
  if (viewMonth.value === 12) {
    viewMonth.value = 1
    viewYear.value += 1
  } else {
    viewMonth.value += 1
  }
}

function selectDay(day: number) {
  selectedYear.value = viewYear.value
  selectedMonth.value = viewMonth.value
  selectedDay.value = day

  emitValue()
  closePicker()
}

function selectToday() {
  selectedYear.value = todayJalali.jy
  selectedMonth.value = todayJalali.jm
  selectedDay.value = todayJalali.jd
  viewYear.value = todayJalali.jy
  viewMonth.value = todayJalali.jm

  emitValue()
  closePicker()
}

function selectTomorrow() {
  const g = jalaliToGregorian(todayJalali.jy, todayJalali.jm, todayJalali.jd)
  const d = new Date(g.gy, g.gm - 1, g.gd + 1)
  const tomorrow = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate())
  selectedYear.value = tomorrow.jy
  selectedMonth.value = tomorrow.jm
  selectedDay.value = tomorrow.jd
  viewYear.value = tomorrow.jy
  viewMonth.value = tomorrow.jm

  emitValue()
  closePicker()
}

function clearDate(e: Event) {
  e.stopPropagation()
  selectedYear.value = null
  selectedMonth.value = null
  selectedDay.value = null
  emit('update:modelValue', '')
  emit('change', '')
}

function emitValue() {
  if (!selectedYear.value || !selectedMonth.value || !selectedDay.value) {
    emit('update:modelValue', '')
    emit('change', '')
    return
  }

  if (props.format === 'shamsi') {
    const y = selectedYear.value
    const m = SHAMSI_MONTHS[selectedMonth.value - 1]
    const d = selectedDay.value
    const val = `${toPersianDigits(d)} ${m} ${toPersianDigits(y)}`
    emit('update:modelValue', val)
    emit('change', val)
  } else {
    // Default ISO YYYY-MM-DD
    const iso = jalaliToIso(selectedYear.value, selectedMonth.value, selectedDay.value)
    emit('update:modelValue', iso)
    emit('change', iso)
  }
}

function isDayToday(day: number): boolean {
  return (
    todayJalali.jy === viewYear.value &&
    todayJalali.jm === viewMonth.value &&
    todayJalali.jd === day
  )
}

function isDaySelected(day: number): boolean {
  return (
    selectedYear.value === viewYear.value &&
    selectedMonth.value === viewMonth.value &&
    selectedDay.value === day
  )
}

function isFriday(day: number): boolean {
  return getShamsiDayOfWeek(viewYear.value, viewMonth.value, day) === 6
}
defineExpose({
  openPicker,
  closePicker,
})
</script>

<template>
  <div class="shamsi-picker-wrapper" :class="{ 'is-hidden-trigger': hideInput }">
    <!-- Trigger input button -->
    <div
      v-if="!hideInput"
      class="shamsi-input-trigger"
      :class="{ 'is-active': isOpen, 'has-value': !!displayLabel, 'is-disabled': disabled }"
      role="button"
      tabindex="0"
      :aria-label="displayLabel || placeholder"
      @click="openPicker"
      @keydown.enter.prevent="openPicker"
      @keydown.space.prevent="openPicker"
    >
      <i class="mdi mdi-calendar-month-outline trigger-icon" aria-hidden="true" />
      <span v-if="displayLabel" class="trigger-text">{{ displayLabel }}</span>
      <span v-else class="trigger-placeholder">{{ placeholder }}</span>

      <button
        v-if="displayLabel && !disabled"
        type="button"
        class="clear-date-btn"
        title="پاک کردن تاریخ"
        @click="clearDate"
      >
        <i class="mdi mdi-close-circle" />
      </button>
      <i v-else class="mdi mdi-chevron-down arrow-icon" aria-hidden="true" />
    </div>

    <!-- Calendar Modal Backdrop -->
    <Teleport to="body">
      <div
        v-if="isOpen"
        class="shamsi-modal-backdrop"
        @click.self="closePicker"
        @keydown.esc="closePicker"
      >
        <div class="shamsi-calendar-card" role="dialog" aria-modal="true" aria-label="تقویم شمسی">
          <!-- Card Header -->
          <div class="shamsi-card-header">
            <div class="header-titles">
              <span class="calendar-kicker">
                <i class="mdi mdi-calendar-star" /> تقویم خورشیدی ایران
              </span>
              <h3 class="calendar-selection">
                {{ selectedDay ? formatJalaliDisplay(jalaliToIso(selectedYear!, selectedMonth!, selectedDay!), 'full') : 'یک روز را انتخاب کن' }}
              </h3>
            </div>
            <button
              type="button"
              class="close-picker-btn"
              aria-label="بستن تقویم"
              @click="closePicker"
            >
              <i class="mdi mdi-close" />
            </button>
          </div>

          <!-- Month & Year Controls -->
          <div class="shamsi-nav-bar">
            <!-- In RTL, chevron-right is Previous Month -->
            <button
              type="button"
              class="month-nav-btn"
              title="ماه قبل"
              @click="prevMonth"
            >
              <i class="mdi mdi-chevron-right" />
            </button>

            <div class="month-year-selectors">
              <!-- Month select -->
              <select v-model.number="viewMonth" class="month-select" aria-label="ماه">
                <option v-for="(m, idx) in SHAMSI_MONTHS" :key="m" :value="idx + 1">
                  {{ m }}
                </option>
              </select>

              <!-- Year select -->
              <select v-model.number="viewYear" class="year-select" aria-label="سال">
                <option v-for="y in availableYears" :key="y" :value="y">
                  {{ toPersianDigits(y) }}
                </option>
              </select>
            </div>

            <!-- In RTL, chevron-left is Next Month -->
            <button
              type="button"
              class="month-nav-btn"
              title="ماه بعد"
              @click="nextMonth"
            >
              <i class="mdi mdi-chevron-left" />
            </button>
          </div>

          <!-- Quick Shortcuts -->
          <div class="quick-date-chips">
            <button type="button" class="quick-chip" @click="selectToday">
              <i class="mdi mdi-calendar-today" /> امروز
            </button>
            <button type="button" class="quick-chip" @click="selectTomorrow">
              <i class="mdi mdi-calendar-arrow-right" /> فردا
            </button>
          </div>

          <!-- Weekday Headers -->
          <div class="shamsi-weekdays-row">
            <span
              v-for="(w, idx) in SHAMSI_WEEKDAYS_SHORT"
              :key="w"
              class="weekday-label"
              :class="{ 'is-friday': idx === 6 }"
            >
              {{ w }}
            </span>
          </div>

          <!-- Days Grid -->
          <div class="shamsi-days-grid">
            <!-- Empty offset placeholders -->
            <span
              v-for="blank in firstDayOfWeek"
              :key="`b-${blank}`"
              class="empty-day-cell"
            />

            <!-- Day buttons -->
            <button
              v-for="day in daysInMonth"
              :key="day"
              type="button"
              class="day-cell-btn"
              :class="{
                'is-today': isDayToday(day),
                'is-selected': isDaySelected(day),
                'is-friday': isFriday(day) && !isDaySelected(day),
              }"
              @click="selectDay(day)"
            >
              <span class="day-num">{{ toPersianDigits(day) }}</span>
              <span v-if="isDayToday(day)" class="today-dot" title="امروز" />
            </button>
          </div>

          <!-- Card Footer -->
          <div class="shamsi-card-footer">
            <button type="button" class="cancel-btn" @click="closePicker">
              انصراف
            </button>
            <button
              v-if="selectedDay"
              type="button"
              class="confirm-btn"
              @click="closePicker"
            >
              <i class="mdi mdi-check" /> تأیید ({{ toPersianDigits(selectedDay) }} {{ SHAMSI_MONTHS[selectedMonth! - 1] }})
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.shamsi-picker-wrapper {
  position: relative;
  width: 100%;
}

.shamsi-input-trigger {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  min-height: 44px;
  padding: 0.55rem 0.85rem;
  border-radius: 12px;
  border: 1px solid var(--border, #cce3db);
  background: var(--card-bg, #ffffff);
  color: var(--text-primary, #1e293b);
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
  font-family: inherit;
  font-size: 0.92rem;
  box-sizing: border-box;
}

.shamsi-input-trigger:hover {
  border-color: var(--primary, #2c8068);
  box-shadow: 0 2px 8px rgba(44, 128, 104, 0.1);
}

.shamsi-input-trigger.is-active {
  border-color: var(--primary, #2c8068);
  box-shadow: 0 0 0 3px rgba(44, 128, 104, 0.15);
}

.shamsi-input-trigger.is-disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: rgba(0, 0, 0, 0.04);
}

.trigger-icon {
  font-size: 1.25rem;
  color: var(--primary, #2c8068);
  flex-shrink: 0;
}

.trigger-text {
  flex: 1;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.trigger-placeholder {
  flex: 1;
  color: var(--text-muted, #8da099);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.arrow-icon {
  font-size: 1.15rem;
  color: var(--text-muted, #8da099);
  transition: transform 0.2s ease;
}

.shamsi-input-trigger.is-active .arrow-icon {
  transform: rotate(180deg);
}

.clear-date-btn {
  background: none;
  border: none;
  padding: 2px;
  color: var(--text-muted, #8da099);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: color 0.15s ease;
}

.clear-date-btn:hover {
  color: #ef4444;
}

/* Modal Backdrop */
.shamsi-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  animation: fadeIn 0.18s ease-out;
  direction: rtl;
}

.shamsi-calendar-card {
  width: 100%;
  max-width: 350px;
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border, #cce3db);
  border-radius: 20px;
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.22);
  padding: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  animation: popIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
}

.shamsi-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-light, #e4f0ec);
  padding-bottom: 0.65rem;
}

.header-titles {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.calendar-kicker {
  font-size: 0.76rem;
  color: var(--primary, #2c8068);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.calendar-selection {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary, #1e293b);
}

.close-picker-btn {
  background: none;
  border: none;
  color: var(--text-muted, #8da099);
  cursor: pointer;
  padding: 4px;
  border-radius: 8px;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.close-picker-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-primary, #1e293b);
}

/* Nav Bar */
.shamsi-nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  background: var(--bg-soft, #f0f8f5);
  padding: 0.35rem 0.5rem;
  border-radius: 12px;
}

.month-nav-btn {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border, #cce3db);
  color: var(--text-primary, #1e293b);
  border-radius: 8px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.15rem;
  transition: all 0.15s ease;
}

.month-nav-btn:hover {
  background: var(--primary, #2c8068);
  color: #ffffff;
  border-color: var(--primary, #2c8068);
}

.month-year-selectors {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.month-select,
.year-select {
  border: 1px solid transparent;
  background: transparent;
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary, #1e293b);
  padding: 0.25rem 0.45rem;
  border-radius: 6px;
  cursor: pointer;
  outline: none;
}

.month-select:hover,
.year-select:hover,
.month-select:focus,
.year-select:focus {
  background: var(--card-bg, #ffffff);
  border-color: var(--border, #cce3db);
}

/* Quick Chips */
.quick-date-chips {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.quick-chip {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  padding: 0.35rem 0.5rem;
  border-radius: 8px;
  border: 1px solid var(--border, #cce3db);
  background: var(--card-bg, #ffffff);
  color: var(--text-primary, #1e293b);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.quick-chip:hover {
  background: var(--primary, #2c8068);
  color: #ffffff;
  border-color: var(--primary, #2c8068);
}

/* Weekdays */
.shamsi-weekdays-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  padding: 0.2rem 0;
  border-bottom: 1px solid var(--border-light, #e4f0ec);
}

.weekday-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-muted, #7c928b);
}

.weekday-label.is-friday {
  color: #ef4444;
}

/* Days Grid */
.shamsi-days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  padding: 0.2rem 0;
}

.empty-day-cell {
  height: 38px;
}

.day-cell-btn {
  position: relative;
  height: 38px;
  border: none;
  background: none;
  border-radius: 10px;
  color: var(--text-primary, #1e293b);
  font-family: inherit;
  font-size: 0.92rem;
  font-weight: 600;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
  padding: 0;
}

.day-cell-btn:hover {
  background: rgba(44, 128, 104, 0.12);
  color: var(--primary, #2c8068);
}

.day-cell-btn.is-friday {
  color: #e11d48;
}

.day-cell-btn.is-today {
  border: 1.5px dashed var(--primary, #2c8068);
  color: var(--primary, #2c8068);
}

.day-cell-btn.is-selected {
  background: var(--primary, #2c8068) !important;
  color: #ffffff !important;
  font-weight: 800;
  box-shadow: 0 4px 12px rgba(44, 128, 104, 0.35);
}

.today-dot {
  position: absolute;
  bottom: 3px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
}

/* Footer Actions */
.shamsi-card-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  border-top: 1px solid var(--border-light, #e4f0ec);
  padding-top: 0.65rem;
}

.cancel-btn {
  background: none;
  border: 1px solid var(--border, #cce3db);
  padding: 0.45rem 0.9rem;
  border-radius: 10px;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-muted, #7c928b);
  cursor: pointer;
  transition: all 0.15s ease;
}

.cancel-btn:hover {
  background: rgba(0, 0, 0, 0.04);
  color: var(--text-primary, #1e293b);
}

.confirm-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: var(--primary, #2c8068);
  color: #ffffff;
  border: none;
  padding: 0.45rem 1rem;
  border-radius: 10px;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(44, 128, 104, 0.25);
  transition: all 0.15s ease;
}

.confirm-btn:hover {
  filter: brightness(1.08);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes popIn {
  from { opacity: 0; transform: scale(0.92); }
  to { opacity: 1; transform: scale(1); }
}
</style>
