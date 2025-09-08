<script lang="ts" setup>
import { onKeyStroke } from '@vueuse/core'
import UserMenu from '@web/components/layout/UserMenu.vue'
import PlanningPicker from '@web/components/planning/PlanningPicker.vue'
import { usePlanningData } from '@web/composables/usePlanningData'
import { useSharedTheme } from '@web/composables/useTheme'
import { ChevronDown, List } from 'lucide-vue-next'
import { computed, useTemplateRef } from 'vue'

const { title } = usePlanningData()
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
    planningPicker.value?.open()
  },
  { dedupe: true },
)
</script>

<template>
  <div class="navbar bg-base-100 shadow-sm px-3 gap-2">
    <div class="flex-1 flex items-center gap-3">
      <a class="text-xl flex items-center gap-3" href="/">
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
            <button class="btn btn-secondary h-6 min-h-6 hidden sm:inline-flex" type="button" @click="open">
              Changer de planning
              <kbd
                class="kbd kbd-xs bg-transparent text-[inherit] border-current opacity-100 hidden sm:inline-flex"
              >U</kbd>
            </button>
          </template>
        </PlanningPicker>
        <Transition name="fade">
          <span v-if="title" class="badge truncate max-w-[22rem] h-6 hidden sm:inline-flex">{{ title }}</span>
        </Transition>
      </div>
    </div>

    <div class="flex-none mr-2 hidden sm:block">
      <div class="dropdown dropdown-end">
        <div class="btn btn-ghost" role="button" tabindex="0">
          Thème: {{ currentLabel }}
          <ChevronDown class="opacity-70" :size="14" />
        </div>
        <ul
          class="menu menu-sm dropdown-content bg-base-200 rounded-box z-10 mt-3 w-48 p-2 shadow"
          tabindex="0"
        >
          <li>
            <button :class="{ 'bg-primary text-white': theme === 'auto' }" type="button" @click="setTheme('auto')">
              {{ i18nThemes.auto }}
            </button>
          </li>
          <li>
            <button :class="{ 'bg-primary text-white': theme === 'dark' }" type="button" @click="setTheme('dark')">
              {{ i18nThemes.dark }}
            </button>
          </li>
          <li>
            <button :class="{ 'bg-primary text-white': theme === 'light' }" type="button" @click="setTheme('light')">
              {{ i18nThemes.light }}
            </button>
          </li>
          <li>
            <button :class="{ 'bg-primary text-white': theme === 'dracula' }" type="button" @click="setTheme('dracula')">
              {{ i18nThemes.dracula }}
            </button>
          </li>
        </ul>
      </div>
    </div>

    <UserMenu />

    <div class="fab sm:hidden">
      <button aria-label="Changer de planning" class="btn btn-xl btn-circle btn-primary" type="button" @click="planningPicker?.open()">
        <List />
      </button>
    </div>
  </div>
</template>
