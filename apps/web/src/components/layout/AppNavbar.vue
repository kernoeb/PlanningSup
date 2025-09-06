<script lang="ts" setup>
import { onKeyStroke } from '@vueuse/core'
import UserMenu from '@web/components/layout/UserMenu.vue'
import PlanningPicker from '@web/components/planning/PlanningPicker.vue'
import { usePlanningData } from '@web/composables/usePlanningData'
import { useTheme } from '@web/composables/useTheme'
import { computed, useTemplateRef } from 'vue'

const { title } = usePlanningData()
const { theme, i18nThemes, setTheme, setAuto, mode } = useTheme()

const currentLabel = computed<string>(() => {
  return mode.store.value === 'auto'
    ? i18nThemes.system
    : i18nThemes[theme.value]
})

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
    planningPicker.value?.open()
  },
  { dedupe: true },
)
</script>

<template>
  <div class="navbar bg-base-100 shadow-sm px-3">
    <div class="flex-1 flex items-center gap-3">
      <a class="text-xl flex items-center gap-3" href="/">
        <div class="avatar">
          <div class="w-8 rounded">
            <img alt="PlanningSup" src="/icon.png">
          </div>
        </div>
        PlanningSup
      </a>
      <Transition mode="out-in" name="fade">
        <div v-if="title" class="sm:flex items-center gap-2">
          <span class="badge truncate max-w-[22rem] h-6">{{ title }}</span>
          <PlanningPicker ref="planningPicker">
            <template #trigger="{ open }">
              <button class="btn btn-secondary h-6 min-h-6" type="button" @click="open">
                Changer de planning
                <kbd
                  class="kbd kbd-xs bg-transparent text-[inherit] border-current opacity-100"
                >u</kbd>
              </button>
            </template>
          </PlanningPicker>
        </div>
      </Transition>
    </div>

    <div class="flex-none mr-2">
      <div class="dropdown dropdown-end">
        <div class="btn btn-ghost" role="button" tabindex="0">
          Thème: {{ currentLabel }}
          <svg
            class="h-4 w-4 ml-1 opacity-70"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              clip-rule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
              fill-rule="evenodd"
            />
          </svg>
        </div>
        <ul
          class="menu menu-sm dropdown-content bg-base-200 rounded-box z-10 mt-3 w-48 p-2 shadow"
          tabindex="0"
        >
          <li>
            <button type="button" @click="setAuto()">
              {{ i18nThemes.system }} (auto)
            </button>
          </li>
          <li>
            <button type="button" @click="setTheme('black')">
              {{ i18nThemes.black }}
            </button>
          </li>
          <li>
            <button type="button" @click="setTheme('light')">
              {{ i18nThemes.light }}
            </button>
          </li>
          <li>
            <button type="button" @click="setTheme('dracula')">
              {{ i18nThemes.dracula }}
            </button>
          </li>
        </ul>
      </div>
    </div>

    <UserMenu />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
