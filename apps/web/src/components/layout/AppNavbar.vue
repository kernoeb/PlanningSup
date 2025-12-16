<script lang="ts" setup>
import { onKeyStroke } from '@vueuse/core'
import UserMenu from '@web/components/layout/UserMenu.vue'
import PlanningPicker from '@web/components/planning/PlanningPicker.vue'
import { usePlanningData } from '@web/composables/usePlanningData'
import { usePlanningPickerController } from '@web/composables/usePlanningPickerController'
import { List as IconList, X as IconX } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'

const { titles, planningFullIds } = usePlanningData()

const selectedCount = computed(() => planningFullIds.value.length)
const singleSelectedTitle = computed(() => {
  if (planningFullIds.value.length !== 1) return ''
  const id = planningFullIds.value[0]
  if (!id) return ''
  return titles.value[id] ?? ''
})
const selectedSummaryLabel = computed(() => {
  if (selectedCount.value === 0) return '...'
  if (selectedCount.value === 1) return singleSelectedTitle.value || '...'
  return `${selectedCount.value} plannings sélectionnés`
})
const selectedPlanningItems = computed(() =>
  planningFullIds.value
    .filter(Boolean)
    .map(fullId => ({ fullId, label: titles.value[fullId] ?? '...' })),
)
const selectedTitlesTooltip = computed(() =>
  selectedPlanningItems.value.map(i => i.label).join(' + '),
)

const planningPicker = useTemplateRef('planningPicker')
const planningPickerController = usePlanningPickerController()
const selectedInfoDialog = useTemplateRef('selectedInfoDialog')

function openSelectedInfo() {
  selectedInfoDialog.value?.showModal()
}

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
        <div class="flex flex-col">
          <div>PlanningSup</div>
          <div class="text-xs font-light flex items-center gap-1 sm:hidden">
            <span>{{ selectedSummaryLabel }}</span>
            <button
              v-if="selectedCount > 1"
              id="mobile-selected-plannings-info"
              class="badge badge-soft badge-xs border-base-300 cursor-pointer select-none"
              type="button"
              @click.prevent.stop="openSelectedInfo"
            >
              i
            </button>
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
        <Transition mode="out-in" name="fade">
          <span v-if="selectedCount === 1" id="current-planning-badge" class="badge truncate max-w-88 h-6 hidden sm:inline-flex">
            {{ singleSelectedTitle || '...' }}
          </span>
          <div
            v-else-if="selectedCount > 1"
            class="tooltip tooltip-bottom hidden sm:inline-flex relative z-50"
            :data-tip="selectedTitlesTooltip"
          >
            <span id="current-planning-badge" class="badge truncate max-w-88 h-6">
              {{ selectedCount }} plannings sélectionnés
            </span>
          </div>
        </Transition>
      </div>
    </div>

    <UserMenu />

    <div class="fab sm:hidden">
      <button id="mobile-planning-fab" aria-label="Changer de planning" class="btn btn-xl btn-circle btn-primary" type="button" @click="planningPickerController.open()">
        <IconList />
      </button>
    </div>

    <dialog ref="selectedInfoDialog" class="modal sm:hidden">
      <div class="modal-box max-w-sm flex flex-col p-0">
        <div class="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-base-300 dark:border-base-200 bg-base-200 dark:bg-base-100">
          <div class="flex flex-col">
            <h3 class="font-bold text-xl">
              Plannings sélectionnés
            </h3>
            <span class="text-xs opacity-70">
              {{ selectedCount }} sélectionné(s)
            </span>
          </div>
          <form method="dialog">
            <button aria-label="Fermer" class="btn btn-sm btn-circle btn-ghost" type="submit">
              <IconX class="size-5 text-base-content" />
            </button>
          </form>
        </div>

        <div class="px-6 py-4">
          <ul class="space-y-1 max-h-80 overflow-auto">
            <li v-for="item in selectedPlanningItems" :key="item.fullId" class="truncate text-sm">
              {{ item.label }}
            </li>
          </ul>
        </div>
      </div>
      <form class="modal-backdrop" method="dialog">
        <button aria-label="Fermer">
          close
        </button>
      </form>
    </dialog>
  </div>
</template>
