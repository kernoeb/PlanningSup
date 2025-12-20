<script lang="ts" setup>
import SocialLogin from '@web/components/auth/SocialLogin.vue'
import { useAuth } from '@web/composables/useAuth'
import { usePlanningPickerController } from '@web/composables/usePlanningPickerController'
import {
  Calendar as IconCalendar,
  ChevronRight as IconChevronRight,
  CloudOff as IconCloudOff,
  Layers as IconLayers,
  MonitorSmartphone as IconMonitorSmartphone,
  RefreshCw as IconRefreshCw,
} from 'lucide-vue-next'
import { computed, useTemplateRef } from 'vue'

const { authEnabled, session } = useAuth()
const planningPickerController = usePlanningPickerController()
const socialLogin = useTemplateRef('socialLogin')

const isLoggedIn = computed(() => !!session.value.data?.user)

function openPlanningPicker() {
  planningPickerController.open()
}

function openSocialLogin() {
  socialLogin.value?.dialog?.showModal()
}
</script>

<template>
  <div class="h-full flex items-center justify-center px-4 py-4 sm:py-8">
    <div class="max-w-lg sm:max-w-xl lg:max-w-2xl w-full space-y-6 sm:space-y-8">
      <!-- Header -->
      <div class="text-center space-y-2 sm:space-y-3">
        <div class="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary/10 mb-1 sm:mb-2">
          <IconCalendar class="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
        </div>
        <h1 class="text-2xl sm:text-3xl font-bold">
          Bienvenue sur PlanningSup
        </h1>
        <p class="text-base-content/70 text-sm sm:text-base max-w-md mx-auto">
          Ton emploi du temps universitaire, simplifié et toujours accessible.
          <a
            class="link link-primary"
            href="https://github.com/kernoeb/PlanningSup"
            rel="noopener noreferrer"
            target="_blank"
          >Open source</a>.
        </p>
      </div>

      <!-- Features grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        <div class="flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-base-200/50 border border-base-300">
          <div class="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <IconRefreshCw class="w-4.5 h-4.5 sm:w-5 sm:h-5 text-primary" />
          </div>
          <div class="min-w-0">
            <div class="font-medium text-sm">
              Sync auto
            </div>
            <div class="text-xs sm:text-sm text-base-content/60">
              Ton planning se met à jour automatiquement
            </div>
          </div>
        </div>

        <div class="flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-base-200/50 border border-base-300">
          <div class="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <IconCloudOff class="w-4.5 h-4.5 sm:w-5 sm:h-5 text-primary" />
          </div>
          <div class="min-w-0">
            <div class="font-medium text-sm">
              Hors-ligne
            </div>
            <div class="text-xs sm:text-sm text-base-content/60">
              Consulte ton planning sans connexion internet (PWA)
            </div>
          </div>
        </div>

        <div class="flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-base-200/50 border border-base-300">
          <div class="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <IconLayers class="w-4.5 h-4.5 sm:w-5 sm:h-5 text-primary" />
          </div>
          <div class="min-w-0">
            <div class="font-medium text-sm">
              Multi-plannings
            </div>
            <div class="text-xs sm:text-sm text-base-content/60">
              Combine plusieurs groupes en un seul agenda
            </div>
          </div>
        </div>

        <button
          v-if="authEnabled && !isLoggedIn"
          class="flex items-center gap-3 p-3 sm:p-4 rounded-xl bg-primary/5 border border-primary/20 hover:bg-primary/10 hover:border-primary/30 transition-colors text-left group cursor-pointer"
          type="button"
          @click="openSocialLogin"
        >
          <div class="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <IconMonitorSmartphone class="w-4.5 h-4.5 sm:w-5 sm:h-5 text-primary" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="font-medium text-sm">
              Multi-appareils
            </div>
            <div class="text-xs sm:text-sm text-base-content/60">
              Connecte-toi pour retrouver tes préférences
            </div>
          </div>
          <IconChevronRight class="w-4 h-4 text-primary/60 group-hover:text-primary transition-colors shrink-0" />
        </button>

        <div
          v-else-if="authEnabled && isLoggedIn"
          class="flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-base-200/50 border border-base-300"
        >
          <div class="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <IconMonitorSmartphone class="w-4.5 h-4.5 sm:w-5 sm:h-5 text-primary" />
          </div>
          <div class="min-w-0">
            <div class="font-medium text-sm">
              Multi-appareils
            </div>
            <div class="text-xs sm:text-sm text-base-content/60">
              Tes préférences sont synchronisées
            </div>
          </div>
        </div>
      </div>

      <!-- CTA -->
      <div class="text-center space-y-2 sm:space-y-3">
        <button class="btn btn-primary btn-lg" type="button" @click="openPlanningPicker">
          <IconCalendar class="w-5 h-5" />
          Choisir mon planning
        </button>
        <div class="text-xs text-base-content/40 hidden sm:block">
          Raccourci clavier : <kbd class="kbd kbd-xs">U</kbd>
        </div>
      </div>
    </div>
  </div>

  <SocialLogin ref="socialLogin" />
</template>
