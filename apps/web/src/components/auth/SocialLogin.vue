<script lang="ts" setup>
import { useAuth } from '@web/composables/useAuth'
import { User } from 'lucide-vue-next'
import { reactive, useTemplateRef } from 'vue'
import { DiscordIcon, GitHubIcon } from 'vue3-simple-icons'

const dialog = useTemplateRef('dialog')

const isLoading = reactive({
  discord: false,
  github: false,
})
const { authEnabled, signInDiscord, signInGithub } = useAuth()

async function handleLogin(provider: 'discord' | 'github') {
  isLoading[provider] = true
  try {
    if (provider === 'discord') {
      await signInDiscord()
    } else if (provider === 'github') {
      await signInGithub()
    }
  } catch (error) {
    console.error('Login failed:', error)
  } finally {
    isLoading[provider] = false
  }
}

defineExpose({
  dialog,
})
</script>

<template>
  <dialog v-if="authEnabled" ref="dialog" class="modal">
    <div class="modal-box max-w-md bg-base-100 shadow-2xl">
      <form method="dialog">
        <button class="btn btn-circle btn-ghost absolute right-3 top-3 hover:bg-base-200 transition-colors">
          ✕
        </button>
      </form>

      <!-- Header Section -->
      <div class="text-center mb-8 pt-4">
        <div class="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <User class="text-primary w-8 h-8" />
        </div>
        <h3 class="text-2xl font-bold text-base-content mb-2">
          Bienvenue !
        </h3>
        <p class="text-base-content/70 text-sm">
          Connectez-vous pour synchroniser vos préférences (couleurs, week-ends, blocages, etc.) et les retrouver sur tous vos appareils
        </p>
      </div>

      <!-- Login Section -->
      <div class="space-y-4 pb-6">
        <!-- Discord -->
        <button
          class="btn btn-lg w-full flex items-center justify-center gap-2 text-white border-none shadow-lg hover:shadow-xl transition-all duration-200 bg-[#5865F2] hover:bg-[#4752C4]"
          :disabled="isLoading.discord"
          @click="handleLogin('discord')"
        >
          <DiscordIcon />
          <span>{{ isLoading.discord ? 'Connexion en cours...' : 'Continuer avec Discord' }}</span>
        </button>

        <!-- GitHub -->
        <button
          class="btn btn-lg w-full flex items-center justify-center gap-2 bg-[#24292f] hover:bg-[#1c2128] text-white border-none shadow-lg hover:shadow-xl transition-all duration-200"
          :disabled="isLoading.github"
          @click="handleLogin('github')"
        >
          <GitHubIcon />
          <span>{{ isLoading.github ? 'Connexion en cours...' : 'Continuer avec GitHub' }}</span>
        </button>
      </div>

      <!-- Footer -->
      <div class="text-center pt-4">
        <div class="text-xs text-base-content/60 space-y-2 text-left">
          <p>La connexion sert à associer vos préférences à un compte pour les retrouver sur tous vos appareils.</p>
          <ul class="list-disc list-inside space-y-1">
            <li>Votre email, et si disponibles votre nom et avatar fournis par le fournisseur (Discord/GitHub)</li>
            <li>Vos préférences synchronisées: couleurs du planning, surlignage enseignant, affichage des week-ends, liste de blocage, thème</li>
            <li>Des métadonnées de session (adresse IP, navigateur, expiration) utilisées à des fins de sécurité</li>
          </ul>
          <p>Aucune donnée personnelle n’est vendue ou partagée.</p>
        </div>
      </div>
    </div>

    <form class="modal-backdrop" method="dialog">
      <button type="submit">
        close
      </button>
    </form>
  </dialog>
</template>
