<script lang="ts" setup>
import { onKeyStroke, useOnline } from '@vueuse/core'
import CurrentPlanningBadge from '@web/components/layout/CurrentPlanningBadge.vue'
import UserMenu from '@web/components/layout/UserMenu.vue'
import PlanningPicker from '@web/components/planning/PlanningPicker.vue'
import { useAppScroll } from '@web/composables/useAppScroll'
import { usePlanningData } from '@web/composables/usePlanningData'
import { usePlanningPickerController } from '@web/composables/usePlanningPickerController'
import { List as IconList, RefreshCw as IconRefresh, TriangleAlert as IconWarning, WifiOff as IconWifiOff, X as IconX } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, useTemplateRef } from 'vue'

const imageTooltipText = `${__APP_DISPLAY_NAME__ || ''} ${__APP_VERSION__ || ''}`.trim()

const { titles, planningFullIds, networkFailures, syncing, hasEvents } = usePlanningData()
const isOnline = useOnline()
const { isAppScrolled } = useAppScroll()

const isInitialLoading = computed(() => planningFullIds.value.length > 0 && syncing.value && !hasEvents.value)
const showBackgroundSync = computed(() => syncing.value && hasEvents.value)

// Network failure indicator
const hasNetworkFailures = computed(() => networkFailures.value.length > 0)

const selectedCount = computed(() => planningFullIds.value.length)
const singleSelectedTitle = computed(() => {
  if (planningFullIds.value.length !== 1) return ''
  const id = planningFullIds.value[0]
  if (!id) return ''
  return titles.value[id] ?? ''
})
const showDesktopBadge = computed(() => !isInitialLoading.value && selectedCount.value > 0)
const desktopBadgeLabel = computed(() => {
  if (selectedCount.value === 1) return singleSelectedTitle.value || '...'
  return `${selectedCount.value} plannings sélectionnés`
})
const desktopBadgeStatus = computed<'offline' | 'warning' | 'sync' | null>(() => {
  if (!isOnline.value) return 'offline'
  if (hasNetworkFailures.value) return 'warning'
  if (showBackgroundSync.value) return 'sync'
  return null
})
const desktopBadgeStatusTooltip = computed(() => {
  if (desktopBadgeStatus.value === 'offline') return 'Hors ligne'
  if (desktopBadgeStatus.value === 'warning') return selectedCount.value > 1 ? 'Certains plannings sont hors ligne' : 'Données hors ligne'
  if (desktopBadgeStatus.value === 'sync') return 'Mise à jour en arrière-plan'
  return undefined
})
const showMobileSummary = computed(() => !isInitialLoading.value && selectedCount.value > 0)
const selectedSummaryLabel = computed(() => {
  if (isInitialLoading.value) return 'Chargement…'
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
const desktopBadgeTooltip = computed(() => (selectedCount.value > 1 ? selectedTitlesTooltip.value : undefined))

const planningPicker = useTemplateRef('planningPicker')
const planningPickerController = usePlanningPickerController()
const selectedInfoDialog = useTemplateRef('selectedInfoDialog')

function openSelectedInfo() {
  selectedInfoDialog.value?.showModal()
}

onMounted(() => {
  planningPickerController.register(planningPicker.value ?? null)
})

onBeforeUnmount(() => {
  planningPickerController.register(null)
})

onKeyStroke(
  'u',
  (e) => {
    // Ignore if the target is a text field
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

    // Ignore if any dialog is open
    if (document.querySelector('dialog[open]')) return

    // Prevent the keystroke from inserting "u" into the newly focused search box
    e.preventDefault()
    e.stopPropagation()
    planningPickerController.open()
  },
  { dedupe: true },
)
</script>

<template>
  <div
    id="app-navbar"
    class="navbar bg-base-100 px-3 gap-2 transition-[box-shadow,border-color] duration-200 border-b border-transparent"
    :class="{ 'shadow-sm !border-base-200': isAppScrolled }"
  >
    <div class="flex-1 flex items-center gap-3">
      <div id="app-logo" class="text-xl flex items-center gap-3">
        <div class="tooltip tooltip-right" :data-tip="imageTooltipText">
          <a href="/">
            <div class="avatar">
              <div class="w-8 rounded">
                <img alt="PlanningSup" src="/favicon.png">
              </div>
            </div>
          </a>
        </div>
        <div class="flex flex-col">
          <div>PlanningSup</div>
          <div v-if="isInitialLoading || showMobileSummary" class="text-xs font-light flex items-center gap-1 sm:hidden">
            <Transition mode="out-in" name="fade-fast">
              <div :key="isInitialLoading ? 'loading' : 'loaded'" class="flex items-center gap-1">
                <div
                  class="truncate max-w-70"
                  :class="{ 'skeleton skeleton-text': isInitialLoading }"
                >
                  {{ selectedSummaryLabel }}
                </div>

                <template v-if="!isInitialLoading">
                  <button
                    v-if="selectedCount > 1"
                    id="mobile-selected-plannings-info"
                    class="badge badge-soft badge-xs border-base-300 cursor-pointer select-none"
                    type="button"
                    @click.prevent.stop="openSelectedInfo"
                  >
                    i
                  </button>

                  <Transition mode="out-in" name="fade">
                    <IconWifiOff v-if="!isOnline" key="offline" class="size-3 text-warning" />
                    <IconWarning v-else-if="hasNetworkFailures" key="warning" class="size-3 text-warning" />
                    <span
                      v-else-if="showBackgroundSync"
                      key="refresh"
                      class="tooltip tooltip-bottom before:z-50 after:z-50"
                      data-tip="Mise à jour en arrière-plan"
                    >
                      <IconRefresh class="size-3 animate-spin opacity-50" />
                    </span>
                    <span v-else key="empty" aria-hidden="true" class="inline-block w-3" />
                  </Transition>
                </template>

                <span v-else aria-hidden="true" class="inline-block w-3" />
              </div>
            </Transition>
          </div>
        </div>
      </div>
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
          <div v-if="showDesktopBadge" key="badge" class="hidden sm:inline-flex">
            <CurrentPlanningBadge
              :label="desktopBadgeLabel"
              :status="desktopBadgeStatus"
              :status-tooltip="desktopBadgeStatusTooltip"
              :tooltip="desktopBadgeTooltip"
            />
          </div>
          <span v-else key="empty" aria-hidden="true" class="hidden sm:inline-flex h-6" />
        </Transition>
      </div>
    </div>

    <UserMenu />

    <div class="fab sm:hidden">
      <button id="mobile-planning-fab" aria-label="Changer de planning" class="btn btn-xl btn-circle btn-primary size-16 shadow-2xl ring-2 ring-base-content/10 hover:shadow-2xl" type="button" @click="planningPickerController.open()">
        <IconList class="size-7" />
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

<style scoped>
.fade-fast-enter-active,
.fade-fast-leave-active {
  transition: opacity 0.15s ease;
}

.fade-fast-enter-from,
.fade-fast-leave-to {
  opacity: 0;
}

.fade-fast-enter-to,
.fade-fast-leave-from {
  opacity: 1;
}
</style>
