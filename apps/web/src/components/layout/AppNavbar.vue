<script lang="ts" setup>
import { onKeyStroke } from '@vueuse/core'
import UserMenu from '@web/components/layout/UserMenu.vue'
import PlanningPicker from '@web/components/planning/PlanningPicker.vue'
import { usePlanningData } from '@web/composables/usePlanningData'
import { usePlanningPickerController } from '@web/composables/usePlanningPickerController'
import { List } from 'lucide-vue-next'
import { nextTick, onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'

const { title, planningFullIds } = usePlanningData()

const planningPicker = useTemplateRef('planningPicker')
const planningPickerController = usePlanningPickerController()

function openPickerIfEmpty() {
  if (planningFullIds.value.length !== 0) return
  void nextTick(() => {
    requestAnimationFrame(() => planningPickerController.open())
  })
}

onMounted(() => {
  planningPickerController.register(planningPicker.value ?? null)
  openPickerIfEmpty()
})

onBeforeUnmount(() => {
  planningPickerController.register(null)
})

watch(
  () => planningFullIds.value.length,
  (len, prevLen) => {
    if (len === 0 && prevLen > 0) openPickerIfEmpty()
  },
)

onKeyStroke(
  'u',
  (e) => {
    // Ignore if the target is a text field
    const target = e.target as HTMLElement
    if (
      target.tagName === 'INPUT'
      || target.tagName === 'TEXTAREA'
      || target.isContentEditable
    ) {
      return
    }
    // Prevent the keystroke from inserting "u" into the newly focused search box
    e.preventDefault()
    e.stopPropagation()
    planningPickerController.open()
  },
  { dedupe: true },
)
</script>

<template>
  <div id="app-navbar" class="navbar bg-base-100 shadow-sm px-3 gap-2">
    <div class="flex-1 flex items-center gap-3">
      <a id="app-logo" class="text-xl flex items-center gap-3" href="/">
        <div class="avatar">
          <div class="w-8 rounded">
            <img alt="PlanningSup" src="/icon.png">
          </div>
        </div>
        <div>
          <div>PlanningSup</div>
          <div class="text-xs font-light flex sm:hidden">
            {{ title || '...' }}
          </div>
        </div>
      </a>
      <div class="flex items-center gap-2">
        <PlanningPicker ref="planningPicker">
          <template #trigger="{ open }">
            <button id="planning-picker-trigger" class="btn btn-secondary h-6 min-h-6 hidden sm:inline-flex" type="button" @click="open">
              Changer de planning
              <kbd
                class="kbd kbd-xs bg-transparent text-inherit border-current opacity-100 hidden sm:inline-flex"
              >U</kbd>
            </button>
          </template>
        </PlanningPicker>
        <Transition name="fade">
          <span v-if="title && planningFullIds.length === 1" id="current-planning-badge" class="badge truncate max-w-88 h-6 hidden sm:inline-flex">
            {{ title }}
          </span>
          <div v-else-if="title && planningFullIds.length > 1" class="tooltip tooltip-bottom" :data-tip="title">
            <span id="current-planning-badge" class="badge truncate max-w-88 h-6 hidden sm:inline-flex">
              {{ planningFullIds.length }} plannings sélectionnés
            </span>
          </div>
        </Transition>
      </div>
    </div>

    <UserMenu />

    <div class="fab sm:hidden">
      <button id="mobile-planning-fab" aria-label="Changer de planning" class="btn btn-xl btn-circle btn-primary" type="button" @click="planningPickerController.open()">
        <List />
      </button>
    </div>
  </div>
</template>
