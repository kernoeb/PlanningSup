<script lang="ts" setup>
import { ScheduleXCalendar } from '@schedule-x/vue'
import { onClickOutside, useSwipe } from '@vueuse/core'
import { usePlanningCalendar } from '@web/composables/usePlanningCalendar'
import { usePlanningPickerController } from '@web/composables/usePlanningPickerController'
import { useSharedSettings } from '@web/composables/useSettings'
import { useSharedTheme } from '@web/composables/useTheme'
import { getSupportedTimezones, resolveTimezone } from '@web/composables/useTimezone'
import { Calendar as IconCalendar, CalendarCheck2 as IconCalendarCheck2, ChevronDown as IconChevronDown, ChevronLeft as IconChevronLeft, ChevronRight as IconChevronRight } from 'lucide-vue-next'
import { computed, ref, useTemplateRef } from 'vue'
import 'cally'

const settings = useSharedSettings()
const allowedTimezones = getSupportedTimezones()
const timezone = computed(() => resolveTimezone(settings.targetTimezone.value, allowedTimezones))

// Disable ScheduleX animations on first load, enable on first user interaction.
const animationsEnabled = ref(false)
function enableAnimationsOnce(_reason: string) {
  if (animationsEnabled.value) return
  animationsEnabled.value = true
}

const {
  calendarApp,
  calendarControls,
  reload,
  nextPeriod,
  prevPeriod,
  goToToday,
  setView,
  currentDate,
  currentView,
  nbHours,
  loading,
} = usePlanningCalendar({
  timezone,
  onUserInteraction: (reason) => {
    enableAnimationsOnce(reason)
  },
})
const planningPickerController = usePlanningPickerController()
const { isDark: uiIsDark } = useSharedTheme()

function openPlanningPicker() {
  planningPickerController.open()
}

const el = useTemplateRef('calendarSwipeEl')
useSwipe(el, {
  onSwipeEnd(_, direction) {
    enableAnimationsOnce('swipe')
    if (direction === 'left') nextPeriod()
    else if (direction === 'right') prevPeriod()
  },
})

// View options for the select dropdown
const viewOptions = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month-grid', label: 'Mois' },
  { value: 'month-agenda', label: 'Agenda' },
] as const

// Format the current date for display (month + year only)
const formattedDate = computed(() => {
  const date = currentDate.value
  if (!date) return ''
  return date.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })
})

// Week number (ISO week)
const weekNumber = computed(() => {
  const date = currentDate.value
  if (!date) return null
  return date.weekOfYear
})

// Writable computed for cally v-model (YYYY-MM-DD format)
const callyDateModel = computed({
  get: () => {
    const date = currentDate.value
    if (!date) return ''
    return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
  },
  set: (value: string) => {
    if (!value) return
    const [year, month, day] = value.split('-').map(Number)
    if (!year || !month || !day) return
    const newDate = Temporal.PlainDate.from({ year, month, day })
    enableAnimationsOnce('datePicker')
    currentDate.value = newDate
    calendarControls.setDate(newDate)
    closeDatePicker()
  },
})

// Formatted date for the dropdown button
const formattedDateShort = computed(() => {
  const date = currentDate.value
  if (!date) return ''
  return date.toLocaleString('fr-FR', { day: 'numeric', month: 'numeric', year: 'numeric' })
})

const datePickerDropdown = useTemplateRef<HTMLDetailsElement>('datePickerDropdown')
const viewDropdown = useTemplateRef<HTMLDetailsElement>('viewDropdown')

function closeDatePicker() {
  if (datePickerDropdown.value) {
    datePickerDropdown.value.open = false
  }
}

function closeViewDropdown() {
  if (viewDropdown.value) {
    viewDropdown.value.open = false
  }
}

function selectView(view: 'day' | 'week' | 'month-grid' | 'month-agenda') {
  enableAnimationsOnce('viewDropdown')
  setView(view)
  closeViewDropdown()
}

// Current view label for display
const currentViewLabel = computed(() => {
  const opt = viewOptions.find(o => o.value === currentView.value)
  return opt?.label ?? 'Vue'
})

// Check if we're already on today
const isToday = computed(() => {
  const date = currentDate.value
  if (!date) return false
  const today = Temporal.Now.plainDateISO()
  return date.equals(today)
})

// Close dropdowns when clicking outside
onClickOutside(datePickerDropdown, closeDatePicker)
onClickOutside(viewDropdown, closeViewDropdown)

defineExpose({ reload })
</script>

<template>
  <div id="planning-calendar-container" ref="calendarSwipeEl" :class="{ 'is-dark': uiIsDark, 'sx-animations-enabled': animationsEnabled }">
    <ScheduleXCalendar
      v-if="calendarApp"
      :calendar-app="calendarApp"
      class="h-full"
      data-calendar-id="schedule-x-calendar"
    >
      <template #headerContent>
        <div class="flex items-center justify-between w-full gap-2">
          <div class="flex items-center gap-2 min-w-0 overflow-hidden">
            <div class="max-md:tooltip max-md:tooltip-bottom z-50" data-tip="Aujourd'hui">
              <button
                id="calendar-today-btn"
                aria-label="Aller à aujourd'hui"
                class="btn btn-outline border-base-200"
                @click="goToToday"
              >
                <IconCalendarCheck2 v-if="isToday" aria-hidden="true" :size="16" />
                <IconCalendar v-else aria-hidden="true" :size="16" />
                <span class="hidden md:inline">Aujourd'hui</span>
              </button>
            </div>

            <div class="join hidden md:flex">
              <button
                id="calendar-prev-period-header"
                class="btn btn-sm btn-ghost join-item"
                @click="prevPeriod"
              >
                <IconChevronLeft :size="18" />
              </button>
              <button
                id="calendar-next-period-header"
                class="btn btn-sm btn-ghost join-item"
                @click="nextPeriod"
              >
                <IconChevronRight :size="18" />
              </button>
            </div>

            <div id="calendar-date-display" class="inline-flex mr-2">
              {{ formattedDate }}
            </div>

            <span v-if="weekNumber" id="calendar-week-number" class="badge badge-soft border-none text-xs font-medium">
              S{{ weekNumber }}
            </span>

            <span v-if="loading" id="calendar-loading-spinner" class="loading loading-spinner loading-sm" />
            <span v-else-if="nbHours != null" id="calendar-hours-display" class="text-xs text-gray-500">
              {{ nbHours }}
            </span>
          </div>

          <!-- Right section: View selector + Date picker -->
          <div class="flex items-center gap-2 shrink-0">
            <details ref="viewDropdown" class="dropdown dropdown-end self-end">
              <summary id="calendar-view-select" class="btn btn-outline font-normal border-base-200">
                {{ currentViewLabel }} <IconChevronDown :size="16" />
              </summary>
              <div class="dropdown-content bg-base-100 border border-base-200 shadow-lg rounded-box z-50 mt-1 p-2">
                <ul class="menu w-32">
                  <li v-for="opt in viewOptions" :key="opt.value">
                    <button
                      :class="{ 'menu-active': currentView === opt.value }"
                      @click="selectView(opt.value)"
                    >
                      {{ opt.label }}
                    </button>
                  </li>
                </ul>
              </div>
            </details>

            <details ref="datePickerDropdown" class="dropdown dropdown-end hidden md:block">
              <summary class="btn btn-outline font-normal border-base-200">
                {{ formattedDateShort }} <IconChevronDown :size="16" />
              </summary>
              <div class="dropdown-content z-50 mt-1">
                <!-- eslint-disable vue/no-deprecated-slot-attribute -- Web component requires native slot attribute -->
                <calendar-date
                  v-model.lazy="callyDateModel"
                  class="cally bg-base-100 border border-base-200 shadow-lg rounded-box"
                >
                  <IconChevronLeft slot="previous" aria-label="Précédent" :size="16" />
                  <IconChevronRight slot="next" aria-label="Suivant" :size="16" />
                  <calendar-month />
                </calendar-date>
                <!-- eslint-enable vue/no-deprecated-slot-attribute -->
              </div>
            </details>
          </div>
        </div>
      </template>
    </ScheduleXCalendar>

    <div v-else class="h-full flex items-center justify-center px-6">
      <div class="max-w-md text-center space-y-3">
        <div class="text-xl font-semibold">
          Aucun planning sélectionné
        </div>
        <div class="opacity-70">
          Choisis un planning pour afficher ton agenda.
        </div>
        <button class="btn btn-primary" type="button" @click="openPlanningPicker">
          Sélectionner un planning
        </button>
        <div class="text-xs opacity-50 hidden sm:block">
          Raccourci clavier : U
        </div>
      </div>
    </div>
  </div>
</template>
