<script lang="ts" setup>
import { useAuth } from '@web/composables/useAuth'
import { Fingerprint as IconFingerprint, Loader2 as IconLoader, User as IconUser, X as IconX } from 'lucide-vue-next'
import { computed, reactive, ref, useTemplateRef, watch } from 'vue'
import { DiscordIcon, GitHubIcon } from 'vue3-simple-icons'

const dialog = useTemplateRef('dialog')

const isLoading = reactive({
  discord: false,
  github: false,
  passkey: false,
})
const passkeyError = ref<string | null>(null)
const { authEnabled, isPasskeyAvailable, passkeySupported, signInDiscord, signInGithub, signInPasskey } = useAuth()

const showPasskeyButton = computed(() => passkeySupported && isPasskeyAvailable())

async function handleLogin(provider: 'discord' | 'github') {
  isLoading[provider] = true
  passkeyError.value = null
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

async function handlePasskeyLogin() {
  isLoading.passkey = true
  passkeyError.value = null
  try {
    const result = await signInPasskey(false)
    if (result.error) {
      // Don't show error for user cancellation (covers browser string variations + WebAuthn standard error)
      const msg = result.error.message ?? ''
      const isUserCancel = msg.includes('cancelled') || msg.includes('canceled') || (result.error as any).name === 'NotAllowedError'
      if (!isUserCancel) {
        passkeyError.value = result.error.message || 'Erreur lors de la connexion avec le passkey'
      }
    } else if (result.data) {
      // Success - close dialog; reactive session propagates auth state automatically
      dialog.value?.close()
    }
  } catch (error) {
    console.error('Passkey login failed:', error)
    passkeyError.value = 'Erreur lors de la connexion avec le passkey'
  } finally {
    isLoading.passkey = false
  }
}

// Reset error when dialog opens
watch(() => dialog.value?.open, (isOpen) => {
  if (isOpen) {
    passkeyError.value = null
  }
})

defineExpose({
  dialog,
})
</script>

<template>
  <dialog v-if="authEnabled" ref="dialog" class="modal">
    <div class="modal-box max-w-md bg-base-100 shadow-2xl">
      <form method="dialog">
        <button class="btn btn-sm btn-circle btn-ghost absolute right-3 top-3 hover:bg-base-200 transition-colors" type="submit">
          <IconX class="size-5 text-base-content" />
        </button>
      </form>

      <!-- Header Section -->
      <div class="text-center mb-8 pt-4">
        <div class="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <IconUser class="text-primary w-8 h-8" />
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
        <!-- Passkey (shown first if available) -->
        <template v-if="showPasskeyButton">
          <button
            aria-label="Se connecter avec un Passkey"
            class="btn btn-lg w-full flex items-center justify-center gap-2 btn-primary shadow-lg hover:shadow-xl transition-all duration-200"
            :disabled="isLoading.passkey"
            @click="handlePasskeyLogin"
          >
            <IconLoader v-if="isLoading.passkey" class="size-5 animate-spin" />
            <IconFingerprint v-else class="size-5" />
            <span>{{ isLoading.passkey ? 'Connexion en cours...' : 'Continuer avec un Passkey' }}</span>
          </button>

          <!-- Passkey error message -->
          <div v-if="passkeyError" class="text-error text-sm text-center">
            {{ passkeyError }}
          </div>

          <p class="text-xs text-base-content/50 text-center">
            Pour ajouter un passkey, connectez-vous d'abord via Discord ou GitHub, puis rendez-vous dans les paramètres.
          </p>

          <!-- Divider -->
          <div class="divider text-base-content/50 text-sm">
            ou
          </div>
        </template>

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
          <p>Aucune donnée personnelle n'est vendue ou partagée.</p>
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
