<script lang="ts" setup>
import SocialLogin from '@web/components/auth/SocialLogin.vue'
import PlanningPicker from '@web/components/planning/PlanningPicker.vue'
import SettingsDialog from '@web/components/settings/SettingsDialog.vue'
import { useAuth } from '@web/composables/useAuth'
import { usePlanningData } from '@web/composables/usePlanningData'
import { ref } from 'vue'

const { title } = usePlanningData()
const { session, signOut, isAnonymous } = useAuth()

const isSettingsOpen = ref(false)
</script>

<template>
  <div class="navbar bg-base-100 shadow-sm px-3">
    <div class="flex-1 flex items-center gap-3">
      <a class="text-xl flex items-center gap-1" href="/">
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
      <div class="sm:flex items-center gap-2">
        <span class="badge truncate max-w-[22rem] h-6">{{ title }}</span>
        <PlanningPicker>
          <template #trigger="{ open }">
            <button class="btn btn-secondary h-6 min-h-6" type="button" @click="open">
              Changer de planning
            </button>
          </template>
        </PlanningPicker>
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
          <li v-if="session.data?.user && !isAnonymous">
            <a class="justify-between">
              Profil
            </a>
          </li>
          <!-- Move the SocialLogin trigger outside and just call a function -->
          <li v-else>
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
