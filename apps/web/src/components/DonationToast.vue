<script lang="ts" setup>
import type { Component } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import BuyMeACoffeeIcon from '@web/components/icons/BuyMeACoffeeIcon.vue'
import KofiIcon from '@web/components/icons/KofiIcon.vue'
import PaypalIcon from '@web/components/icons/PaypalIcon.vue'
import { BRAND_COLORS, DONATION_LINKS } from '@web/utils/donation'
import { Heart, X } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'

defineOptions({ name: 'DonationToast' })

const icons: Record<string, Component> = { 'PayPal': PaypalIcon, 'Ko-fi': KofiIcon, 'Buy Me a Coffee': BuyMeACoffeeIcon }

const MIN_VISITS = 3

const visitCount = useLocalStorage('donation.visitCount', 0)
const dismissed = useLocalStorage('donation.dismissed', false)

const isVisible = ref(false)

const isOffHours = computed(() => {
  const hour = new Date().getHours()
  return hour < 8 || (hour >= 12 && hour < 14) || hour >= 19
})

onMounted(() => {
  visitCount.value++

  if (DONATION_LINKS.length && !dismissed.value && visitCount.value >= MIN_VISITS && isOffHours.value) {
    // Small delay so the app loads first
    setTimeout(() => {
      isVisible.value = true
    }, 2000)
  }
})

function dismiss() {
  isVisible.value = false
  dismissed.value = true
}

function donate(url: string) {
  window.open(url, '_blank', 'noopener')
  dismiss()
}
</script>

<template>
  <Transition name="donation-toast">
    <div v-if="isVisible" class="toast toast-bottom toast-center z-50 px-4 md:px-8 pointer-events-none md:bottom-4">
      <div
        aria-atomic="true"
        aria-live="polite"
        class="donation-toast-alert alert alert-soft pointer-events-auto flex items-start gap-3 rounded-2xl border shadow-lg ring-1 ring-base-content/10 text-base-content md:w-lg"
        role="status"
      >
        <Heart class="size-5 shrink-0 mt-0.5 text-pink-500" />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium">
            PlanningSup vous est utile ?
          </p>
          <p class="text-xs opacity-70 mt-0.5">
            Un petit don aide à maintenir le projet.
          </p>
          <div class="flex flex-wrap gap-2 mt-2">
            <button
              v-for="link in DONATION_LINKS"
              :key="link.name"
              :aria-label="link.name"
              class="btn btn-sm gap-2"
              :style="{
                backgroundColor: BRAND_COLORS[link.name]?.bg,
                color: BRAND_COLORS[link.name]?.text,
                borderColor: BRAND_COLORS[link.name]?.bg,
              }"
              :title="link.name"
              type="button"
              @click="donate(link.url)"
            >
              <component :is="icons[link.name]" v-if="icons[link.name]" class="size-4" />
              <span class="hidden md:inline">{{ link.name }}</span>
            </button>
          </div>
        </div>
        <button
          aria-label="Fermer"
          class="btn btn-ghost btn-xs btn-circle shrink-0 md:tooltip md:tooltip-top"
          data-tip="RIP"
          type="button"
          @click="dismiss"
        >
          <X class="size-4" />
        </button>
      </div>
    </div>
  </Transition>
</template>

<style>
.donation-toast-enter-active,
.donation-toast-leave-active {
  transition:
    opacity 180ms ease,
    transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    filter 220ms ease;
}

.donation-toast-enter-from,
.donation-toast-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
  filter: blur(4px);
}

@media (prefers-reduced-motion: reduce) {
  .donation-toast-enter-active,
  .donation-toast-leave-active {
    transition: opacity 180ms ease;
  }

  .donation-toast-enter-from,
  .donation-toast-leave-to {
    transform: none;
    filter: none;
  }
}

.donation-toast-alert {
  --alert-color: var(--color-pink-500);
  border-color: color-mix(in oklab, var(--alert-color) 22%, #0000);
  background-color: color-mix(in oklab, var(--color-base-100) 80%, #0000);
  backdrop-filter: blur(12px);
}

@supports not (backdrop-filter: blur(1px)) {
  .donation-toast-alert {
    background-color: color-mix(in oklab, var(--color-base-100) 95%, #0000);
  }
}
</style>
