<script lang="ts" setup>
import SocialLogin from '@web/components/auth/SocialLogin.vue'
import GithubIcon from '@web/components/icons/GithubIcon.vue'
import { useAppScroll } from '@web/composables/useAppScroll'
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
import { computed, onUnmounted, useTemplateRef } from 'vue'

const { authEnabled, session } = useAuth()
const { handleScroll, setIsScrolled } = useAppScroll()
const planningPickerController = usePlanningPickerController()
const socialLogin = useTemplateRef('socialLogin')

const isLoggedIn = computed(() => !!session.value.data?.user)

function openPlanningPicker() {
  planningPickerController.open()
}

function openSocialLogin() {
  socialLogin.value?.dialog?.showModal()
}

onUnmounted(() => {
  setIsScrolled(false)
})
</script>

<template>
  <div class="h-full overflow-y-auto px-4 py-4 sm:py-8" @scroll="handleScroll">
    <div class="flex min-h-full items-center justify-center">
      <div class="max-w-lg sm:max-w-xl lg:max-w-2xl w-full space-y-8 sm:space-y-12">
        <!-- Header -->
        <div class="text-center space-y-4">
          <div class="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary/10 mb-2">
            <IconCalendar class="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
          </div>
          <div class="space-y-2">
            <h1 class="text-3xl sm:text-4xl font-bold tracking-tight">
              Bienvenue sur PlanningSup
            </h1>
            <p class="text-base-content/70 text-sm sm:text-base max-w-md mx-auto">
              Ton emploi du temps universitaire, simplifié et toujours accessible.
            </p>
          </div>

          <!-- Action principale (CTA) -->
          <div class="pt-4 space-y-3">
            <button class="btn btn-primary btn-lg px-8 shadow-md shadow-primary/20 plausible-event-name=select-planning" type="button" @click="openPlanningPicker">
              <IconCalendar class="w-5 h-5" />
              Choisir mon planning
            </button>
            <div class="text-xs text-base-content/40 hidden sm:block">
              Raccourci clavier : <kbd class="kbd kbd-xs">U</kbd>
            </div>
          </div>
        </div>

        <!-- Features grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="flex items-start gap-3 p-4 rounded-xl bg-base-200/50 border border-base-300">
            <div class="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <IconRefreshCw class="w-5 h-5 text-primary" />
            </div>
            <div class="min-w-0">
              <div class="font-medium text-sm">
                Sync auto
              </div>
              <div class="text-xs sm:text-sm text-base-content/60">
                Mise à jour automatique du planning
              </div>
            </div>
          </div>

          <div class="flex items-start gap-3 p-4 rounded-xl bg-base-200/50 border border-base-300">
            <div class="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <IconCloudOff class="w-5 h-5 text-primary" />
            </div>
            <div class="min-w-0">
              <div class="font-medium text-sm">
                Hors-ligne
              </div>
              <div class="text-xs sm:text-sm text-base-content/60">
                Consulte ton planning sans connexion
              </div>
            </div>
          </div>

          <div class="flex items-start gap-3 p-4 rounded-xl bg-base-200/50 border border-base-300">
            <div class="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <IconLayers class="w-5 h-5 text-primary" />
            </div>
            <div class="min-w-0">
              <div class="font-medium text-sm">
                Multi-plannings
              </div>
              <div class="text-xs sm:text-sm text-base-content/60">
                Combine plusieurs groupes en un seul
              </div>
            </div>
          </div>

          <button
            v-if="authEnabled && !isLoggedIn"
            class="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20 hover:bg-primary/10 hover:border-primary/30 transition-colors text-left group cursor-pointer"
            type="button"
            @click="openSocialLogin"
          >
            <div class="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <IconMonitorSmartphone class="w-5 h-5 text-primary" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="font-medium text-sm">
                Multi-appareils
              </div>
              <div class="text-xs sm:text-sm text-base-content/60">
                Synchronise tes préférences
              </div>
            </div>
            <IconChevronRight class="w-4 h-4 text-primary/60 group-hover:text-primary transition-colors shrink-0" />
          </button>

          <div
            v-else-if="authEnabled && isLoggedIn"
            class="flex items-start gap-3 p-4 rounded-xl bg-base-200/50 border border-base-300"
          >
            <div class="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <IconMonitorSmartphone class="w-5 h-5 text-primary" />
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

        <!-- Footer / Open Source -->
        <div class="text-center">
          <a
            class="inline-flex items-center gap-2 px-4 py-2 rounded bg-base-200 hover:bg-base-300 transition-colors text-xs font-medium text-base-content/70"
            href="https://github.com/kernoeb/PlanningSup"
            rel="noopener noreferrer"
            target="_blank"
          >
            <GithubIcon class="w-4 h-4" />
            Projet Open Source
          </a>
        </div>
      </div>
    </div>
  </div>

  <SocialLogin ref="socialLogin" />
</template>
