<script lang="ts" setup>
import { useAuth } from '@web/composables/useAuth'
import { reactive, useTemplateRef } from 'vue'

const dialog = useTemplateRef('dialog')

const isLoading = reactive({
  discord: false,
  github: false,
})
const { signInDiscord, signInGithub } = useAuth()

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
  <dialog ref="dialog" class="modal">
    <div class="modal-box max-w-md bg-base-100 shadow-2xl">
      <form method="dialog">
        <button class="btn btn-circle btn-ghost absolute right-3 top-3 hover:bg-base-200 transition-colors">
          ✕
        </button>
      </form>

      <!-- Header Section -->
      <div class="text-center mb-8 pt-4">
        <div class="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
          </svg>
        </div>
        <h3 class="text-2xl font-bold text-base-content mb-2">
          Bienvenue !
        </h3>
        <p class="text-base-content/70 text-sm">
          Connectez-vous pour accéder à votre compte
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
          <svg class="w-5 h-5" fill="#fff" viewBox="0 0 126.644 96" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M81.15,0c-1.2376,2.1973-2.3489,4.4704-3.3591,6.794-9.5975-1.4396-19.3718-1.4396-28.9945,0-.985-2.3236-2.1216-4.5967-3.3591-6.794-9.0166,1.5407-17.8059,4.2431-26.1405,8.0568C2.779,32.5304-1.6914,56.3725.5312,79.8863c9.6732,7.1476,20.5083,12.603,32.0505,16.0884,2.6014-3.4854,4.8998-7.1981,6.8698-11.0623-3.738-1.3891-7.3497-3.1318-10.8098-5.1523.9092-.6567,1.7932-1.3386,2.6519-1.9953,20.281,9.547,43.7696,9.547,64.0758,0,.8587.7072,1.7427,1.3891,2.6519,1.9953-3.4601,2.0457-7.0718,3.7632-10.835,5.1776,1.97,3.8642,4.2683,7.5769,6.8698,11.0623,11.5419-3.4854,22.3769-8.9156,32.0509-16.0631,2.626-27.2771-4.496-50.9172-18.817-71.8548C98.9811,4.2684,90.1918,1.5659,81.1752.0505l-.0252-.0505ZM42.2802,65.4144c-6.2383,0-11.4159-5.6575-11.4159-12.6535s4.9755-12.6788,11.3907-12.6788,11.5169,5.708,11.4159,12.6788c-.101,6.9708-5.026,12.6535-11.3907,12.6535ZM84.3576,65.4144c-6.2637,0-11.3907-5.6575-11.3907-12.6535s4.9755-12.6788,11.3907-12.6788,11.4917,5.708,11.3906,12.6788c-.101,6.9708-5.026,12.6535-11.3906,12.6535Z"
            />
          </svg>
          <span>{{ isLoading.discord ? 'Connexion en cours...' : 'Continuer avec Discord' }}</span>
        </button>

        <!-- Google -->
        <!-- <button
          class="btn btn-lg w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <svg class="w-5 h-5" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
            <g>
              <path d="m0 0H512V512H0" fill="#fff" />
              <path d="M153 292c30 82 118 95 171 60h62v48A192 192 0 0190 341" fill="#34a853" />
              <path d="m386 400a140 175 0 0053-179H260v74h102q-7 37-38 57" fill="#4285f4" />
              <path d="m90 341a208 200 0 010-171l63 49q-12 37 0 73" fill="#fbbc02" />
              <path d="m153 219c22-69 116-109 179-50l55-54c-78-75-230-72-297 55" fill="#ea4335" />
            </g>
          </svg>
          <span>Continuer avec Google</span>
        </button> -->

        <!-- GitHub -->
        <button
          class="btn btn-lg w-full flex items-center justify-center gap-2 bg-[#24292f] hover:bg-[#1c2128] text-white border-none shadow-lg hover:shadow-xl transition-all duration-200"
          :disabled="isLoading.github"
          @click="handleLogin('github')"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12,2A10,10 0 0,0 2,12C2,16.42 4.87,20.17 8.84,21.5C9.34,21.58 9.5,21.27 9.5,21C9.5,20.77 9.5,20.14 9.5,19.31C6.73,19.91 6.14,17.97 6.14,17.97C5.68,16.81 5.03,16.5 5.03,16.5C4.12,15.88 5.1,15.9 5.1,15.9C6.1,15.97 6.63,16.93 6.63,16.93C7.5,18.45 8.97,18 9.54,17.76C9.63,17.11 9.89,16.67 10.17,16.42C7.95,16.17 5.62,15.31 5.62,11.5C5.62,10.39 6,9.5 6.65,8.79C6.55,8.54 6.2,7.5 6.75,6.15C6.75,6.15 7.59,5.88 9.5,7.17C10.29,6.95 11.15,6.84 12,6.84C12.85,6.84 13.71,6.95 14.5,7.17C16.41,5.88 17.25,6.15 17.25,6.15C17.8,7.5 17.45,8.54 17.35,8.79C18,9.5 18.38,10.39 18.38,11.5C18.38,15.32 16.04,16.16 13.81,16.41C14.17,16.72 14.5,17.33 14.5,18.26C14.5,19.6 14.5,20.68 14.5,21C14.5,21.27 14.66,21.59 15.17,21.5C19.14,20.16 22,16.42 22,12A10,10 0 0,0 12,2Z"
              fill="white"
            />
          </svg>
          <span>{{ isLoading.github ? 'Connexion en cours...' : 'Continuer avec GitHub' }}</span>
        </button>
      </div>

      <!-- Footer -->
      <div class="text-center pt-4">
        <p class="text-xs text-base-content/60">
          Aucune donnée personnelle n’est vendue ou partagée. Seuls vos e-mails et identifiants de connexion sont conservés.
        </p>
      </div>
    </div>

    <form class="modal-backdrop" method="dialog">
      <button type="submit">
        close
      </button>
    </form>
  </dialog>
</template>
