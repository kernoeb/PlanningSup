<script lang="ts" setup>
import SocialLogin from '@web/components/auth/SocialLogin.vue'
import SettingsDialog from '@web/components/settings/SettingsDialog.vue'
import { useAuth } from '@web/composables/useAuth'
import { useSharedTheme } from '@web/composables/useTheme'
import { computed, ref } from 'vue'

defineOptions({ name: 'UserMenu' })

const { session, signOut, isAnonymous } = useAuth()

const isSettingsOpen = ref(false)

const isPending = computed(() => session.value.isPending)
const user = computed(() => session.value.data?.user ?? null)
const hasImage = computed(() => !!user.value?.image)

const avatarInitial = computed(() => {
  if (isPending.value) return 'A' // Disabled avatar while session is loading
  const name = user.value?.name
  return name && name.length ? name.charAt(0).toUpperCase() : 'A'
})

const canOpenMenu = computed(() => !isPending.value && !!user.value)
const ariaLabel = computed(() => (isPending.value ? 'Chargement de la session' : 'Ouvrir le menu utilisateur'))

// Theme (for small screens, theme controls live here)
const { theme, i18nThemes, setTheme } = useSharedTheme()
const currentThemeLabel = computed<string>(() => i18nThemes[theme.value])
</script>

<template>
  <div class="flex-none">
    <div class="dropdown dropdown-end">
      <div
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
          class="w-10 rounded-full"
          :class="{ 'bg-neutral text-neutral-content': !hasImage }"
        >
          <img
            v-if="hasImage"
            key="avatar-img"
            :alt="user?.name || 'User avatar'"
            :src="user?.image ?? undefined"
          >
          <span v-else key="avatar-initial">
            {{ user ? avatarInitial : '' }}
          </span>
        </div>
      </div>

      <ul
        v-if="canOpenMenu"
        class="menu dropdown-content bg-base-200 rounded-box z-10 mt-3 w-52 p-2"
        tabindex="0"
      >
        <!-- Small screens: Theme controls moved here -->
        <li class="menu-title sm:hidden">
          <span>Thème: {{ currentThemeLabel }}</span>
        </li>
        <li class="sm:hidden">
          <button :class="{ 'bg-primary text-white': theme === 'auto' }" type="button" @click="setTheme('auto')">
            {{ i18nThemes.auto }}
          </button>
        </li>
        <li class="sm:hidden">
          <button :class="{ 'bg-primary text-white': theme === 'dark' }" type="button" @click="setTheme('dark')">
            {{ i18nThemes.dark }}
          </button>
        </li>
        <li class="sm:hidden">
          <button :class="{ 'bg-primary text-white': theme === 'light' }" type="button" @click="setTheme('light')">
            {{ i18nThemes.light }}
          </button>
        </li>
        <li class="sm:hidden">
          <button :class="{ 'bg-primary text-white': theme === 'dracula' }" type="button" @click="setTheme('dracula')">
            {{ i18nThemes.dracula }}
          </button>
        </li>
        <div class="sm:hidden divider m-0" />
        <!-- End small-screen theme controls -->
        <li v-if="!user || isAnonymous">
          <button class="justify-between" onclick="socialLogin.showModal()">
            Se connecter
          </button>
        </li>
        <li>
          <button class="justify-between" type="button" @click="isSettingsOpen = true">
            Paramètres
          </button>
        </li>
        <li v-if="user && !isAnonymous">
          <button type="button" @click="signOut()">
            Se déconnecter
          </button>
        </li>
      </ul>
    </div>
  </div>

  <!-- Modals -->
  <SocialLogin id="socialLogin" />
  <SettingsDialog :open="isSettingsOpen" @update:open="val => isSettingsOpen = val" />
</template>
