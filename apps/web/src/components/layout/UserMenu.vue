<script lang="ts" setup>
import SocialLogin from '@web/components/auth/SocialLogin.vue'
import SettingsDialog from '@web/components/settings/SettingsDialog.vue'
import { useAuth } from '@web/composables/useAuth'
import { useSharedTheme } from '@web/composables/useTheme'
import { getPwa } from '@web/pwa'
import { RefreshCw, User } from 'lucide-vue-next'
import { computed, ref, useTemplateRef } from 'vue'

defineOptions({ name: 'UserMenu' })

const { authEnabled, session, signOut } = useAuth()

const isSettingsOpen = ref(false)
const socialLogin = useTemplateRef('socialLogin')

const isPending = computed(() => session.value.isPending)
const user = computed(() => session.value.data?.user ?? null)
const hasImage = computed(() => !!user.value?.image)

const canOpenMenu = computed(() => (authEnabled ? !isPending.value : true))
const ariaLabel = computed(() => (authEnabled && isPending.value ? 'Chargement de la session' : 'Ouvrir le menu utilisateur'))

const needRefresh = computed(() => getPwa()?.needRefresh.value ?? false)
function updateServiceWorker() {
  return getPwa()?.updateServiceWorker()
}

const { theme, i18nThemes, setTheme } = useSharedTheme()
const currentThemeLabel = computed<string>(() => i18nThemes[theme.value])
</script>

<template>
  <div id="user-menu" class="flex-none">
    <div id="user-dropdown" class="dropdown dropdown-end">
      <div
        id="user-menu-trigger"
        :aria-label="ariaLabel"
        class="btn btn-ghost btn-circle avatar"
        :class="[
          { 'avatar-placeholder': !hasImage },
          { 'btn-disabled pointer-events-none opacity-60': !canOpenMenu },
        ]"
        role="button"
        :tabindex="canOpenMenu ? 0 : -1"
      >
        <div
          id="user-avatar"
          class="w-12 rounded-full"
          :class="{ 'bg-primary': !hasImage }"
        >
          <img
            v-if="hasImage"
            id="user-avatar-image"
            key="avatar-img"
            :alt="user?.name || 'User avatar'"
            :src="user?.image ?? undefined"
          >
          <User v-else id="user-avatar-icon" class="w-4 h-4 text-primary-content" />
        </div>
      </div>

      <ul
        v-if="canOpenMenu"
        id="user-dropdown-menu"
        class="menu dropdown-content bg-base-200 dark:bg-base-300 rounded-box z-10 mt-3 w-52 p-2"
        tabindex="0"
      >
        <li class="menu-title">
          <span>Thème: {{ currentThemeLabel }}</span>
        </li>
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
        <div class="divider m-0" />
        <li v-if="needRefresh">
          <button id="pwa-reload" class="justify-between text-warning" type="button" @click="updateServiceWorker()">
            <span class="flex items-center gap-2">
              <RefreshCw class="size-4" />
              Nouvelle version
            </span>
          </button>
        </li>
        <li v-if="authEnabled && !user">
          <button id="login-button" class="justify-between" @click="socialLogin?.dialog?.showModal()">
            Se connecter
          </button>
        </li>
        <li>
          <button id="settings-button" class="justify-between" type="button" @click="isSettingsOpen = true">
            Paramètres
          </button>
        </li>
        <li v-if="authEnabled && user">
          <button id="logout-button" type="button" @click="signOut()">
            Se déconnecter
          </button>
        </li>
      </ul>
    </div>
  </div>

  <!-- Modals -->
  <SocialLogin ref="socialLogin" />
  <SettingsDialog :open="isSettingsOpen" @update:open="val => isSettingsOpen = val" />
</template>
