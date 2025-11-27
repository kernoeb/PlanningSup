<script lang="ts" setup>
import { onKeyStroke } from '@vueuse/core'
import UserMenu from '@web/components/layout/UserMenu.vue'
import PlanningPicker from '@web/components/planning/PlanningPicker.vue'
import { usePlanningData } from '@web/composables/usePlanningData'
import { useSharedTheme } from '@web/composables/useTheme'
import { ChevronDown, List } from 'lucide-vue-next'
import { computed, useTemplateRef } from 'vue'

const { title, planningFullIds } = usePlanningData()
const { theme, i18nThemes, setTheme } = useSharedTheme()
const currentLabel = computed(() => i18nThemes[theme.value])

const planningPicker = useTemplateRef('planningPicker')

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
    planningPicker.value?.open()
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

    <div class="flex-none mr-2 hidden md:block">
      <div id="theme-dropdown" class="dropdown dropdown-end">
        <div id="theme-dropdown-trigger" class="btn btn-ghost" role="button" tabindex="0">
          Thème: {{ currentLabel }}
          <ChevronDown class="opacity-70" :size="14" />
        </div>
        <ul
          id="theme-dropdown-menu"
          class="menu menu-sm dropdown-content bg-base-200 rounded-box z-10 mt-3 w-48 p-2 shadow"
          tabindex="0"
        >
          <li>
            <button id="theme-auto" :class="{ 'bg-primary text-white': theme === 'auto' }" type="button" @click="setTheme('auto')">
              {{ i18nThemes.auto }}
            </button>
          </li>
          <li>
            <button id="theme-dark" :class="{ 'bg-primary text-white': theme === 'dark' }" type="button" @click="setTheme('dark')">
              {{ i18nThemes.dark }}
            </button>
          </li>
          <li>
            <button id="theme-light" :class="{ 'bg-primary text-white': theme === 'light' }" type="button" @click="setTheme('light')">
              {{ i18nThemes.light }}
            </button>
          </li>
          <li>
            <button id="theme-dracula" :class="{ 'bg-primary text-white': theme === 'dracula' }" type="button" @click="setTheme('dracula')">
              {{ i18nThemes.dracula }}
            </button>
          </li>
        </ul>
      </div>
    </div>

    <UserMenu />

    <div class="fab sm:hidden">
      <button id="mobile-planning-fab" aria-label="Changer de planning" class="btn btn-xl btn-circle btn-primary" type="button" @click="planningPicker?.open()">
        <List />
      </button>
    </div>
  </div>
</template>
