<script lang="ts" setup>
import { onKeyStroke } from '@vueuse/core'
import SocialLogin from '@web/components/auth/SocialLogin.vue'
import PlanningPicker from '@web/components/planning/PlanningPicker.vue'
import SettingsDialog from '@web/components/settings/SettingsDialog.vue'
import { useAuth } from '@web/composables/useAuth'
import { usePlanningData } from '@web/composables/usePlanningData'
import { useTheme } from '@web/composables/useTheme'
import { ref, useTemplateRef } from 'vue'

const { title } = usePlanningData()
const { session, signOut, isAnonymous } = useAuth()
const { theme, i18nThemes, setTheme } = useTheme()

const isSettingsOpen = ref(false)

const planningPicker = useTemplateRef('planningPicker')

onKeyStroke('u', (e) => {
  // Ignore if the target is a text field
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
  planningPicker.value?.open()
}, { dedupe: true })
</script>

<template>
  <div class="navbar bg-base-100 shadow-sm px-3">
    <div class="flex-1 flex items-center gap-3">
      <a class="text-xl flex items-center gap-3" href="/">
        <div class="avatar">
          <div class="w-8 rounded">
            <img
              alt="PlanningSup"
              src="/icon.png"
            >
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
                Changer de planning <kbd class="kbd kbd-xs bg-transparent text-[inherit] border-current opacity-100">u</kbd>
              </button>
            </template>
          </PlanningPicker>
        </div>
      </Transition>
    </div>
    <div class="flex-none mr-2">
      <div class="dropdown dropdown-end">
        <div class="btn btn-ghost" role="button" tabindex="0">
          Thème: {{ i18nThemes[theme] }}
          <svg class="h-4 w-4 ml-1 opacity-70" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path clip-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" fill-rule="evenodd" />
          </svg>
        </div>
        <ul class="menu menu-sm dropdown-content bg-base-200 rounded-box z-10 mt-3 w-40 p-2 shadow" tabindex="0">
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
    <div v-if="session.data?.user" class="flex-none">
      <div class="dropdown dropdown-end">
        <div
          aria-haspopup="menu"
          aria-label="Ouvrir le menu utilisateur"
          class="btn btn-ghost btn-circle avatar" :class="{ 'avatar-placeholder': !session.data.user.image }" role="button" tabindex="0"
        >
          <div class="w-10 rounded-full" :class="{ 'bg-neutral text-neutral-content': !session.data.user.image }">
            <img
              v-if="session.data.user.image"
              :alt="session.data.user.name || 'User avatar'"
              :src="session.data.user.image"
            >
            <span v-else>
              {{ session.data.user.name?.charAt(0).toUpperCase() }}
            </span>
          </div>
        </div>
        <ul class="menu menu-sm dropdown-content bg-base-200 rounded-box z-10 mt-3 w-52 p-2 shadow" tabindex="0">
          <!-- Move the SocialLogin trigger outside and just call a function -->
          <li v-if="!(session.data?.user && !isAnonymous)">
            <button class="justify-between" onclick="socialLogin.showModal()">
              Se connecter
            </button>
          </li>
          <li>
            <button class="justify-between" type="button" @click="isSettingsOpen = true">
              Paramètres
            </button>
          </li>
          <li v-if="session.data?.user && !isAnonymous">
            <button @click="signOut()">
              Se déconnecter
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>

  <!-- Place SocialLogin outside the dropdown structure -->
  <SocialLogin id="socialLogin" />
  <SettingsDialog :open="isSettingsOpen" @update:open="val => isSettingsOpen = val" />
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
