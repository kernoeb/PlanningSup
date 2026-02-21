<script lang="ts" setup>
import type { Component } from 'vue'
import GitHubStarButton from '@web/components/GitHubStarButton.vue'
import BuyMeACoffeeIcon from '@web/components/icons/BuyMeACoffeeIcon.vue'
import GithubIcon from '@web/components/icons/GithubIcon.vue'
import KofiIcon from '@web/components/icons/KofiIcon.vue'
import PaypalIcon from '@web/components/icons/PaypalIcon.vue'
import { BRAND_COLORS, DONATION_LINKS } from '@web/utils/donation'
import { Code, Heart, X as IconX } from 'lucide-vue-next'
import { ref, watch } from 'vue'

defineOptions({ name: 'AboutDialog' })

const props = withDefaults(defineProps<{
  open?: boolean
}>(), {
  open: false,
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const dialogRef = ref<HTMLDialogElement | null>(null)

const brandIcons: Record<string, Component> = {
  'PayPal': PaypalIcon,
  'Ko-fi': KofiIcon,
  'Buy Me a Coffee': BuyMeACoffeeIcon,
}

function close() {
  const el = dialogRef.value
  if (el?.open) el.close()
  emit('update:open', false)
}

watch(() => props.open, (next) => {
  const el = dialogRef.value
  if (!el) return
  if (next) {
    if (!el.open) el.showModal()
  } else {
    if (el.open) el.close()
  }
}, { immediate: true })
</script>

<template>
  <dialog ref="dialogRef" aria-labelledby="about-title" class="modal" @close="emit('update:open', false)">
    <div class="modal-box max-w-sm flex flex-col p-0">
      <div class="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-base-300 dark:border-base-200 bg-base-200 dark:bg-base-100">
        <h3 id="about-title" class="font-bold text-xl">
          À propos
        </h3>
        <form method="dialog">
          <button
            aria-label="Fermer"
            class="btn btn-sm btn-circle btn-ghost"
            type="submit"
            @click="close"
          >
            <IconX class="size-5 text-base-content" />
          </button>
        </form>
      </div>

      <div class="flex-1 overflow-y-auto px-6 pt-4 pb-6 space-y-4 bg-base-100 dark:bg-base-200">
        <p class="text-sm text-base-content/80">
          <strong>PlanningSup</strong> est un projet open source qui permet de consulter les emplois du temps universitaires.
        </p>

        <section class="space-y-3">
          <div class="flex items-center gap-2">
            <Code class="size-4 text-base-content" />
            <h4 class="font-semibold text-sm">
              Projet
            </h4>
          </div>
          <div class="flex flex-col gap-3">
            <a
              class="btn btn-sm gap-2 no-underline"
              href="https://github.com/kernoeb/PlanningSup"
              rel="noopener"
              style="background-color: #24292e; color: #fff; border-color: #24292e"
              target="_blank"
            >
              <GithubIcon class="size-4" />
              GitHub
            </a>
            <GitHubStarButton repo="PlanningSup" user="kernoeb" />
          </div>
        </section>

        <section v-if="DONATION_LINKS.length" class="space-y-3">
          <div class="flex items-center gap-2">
            <Heart class="size-4 text-pink-500" />
            <h4 class="font-semibold text-sm">
              Soutenir le projet
            </h4>
          </div>
          <div class="flex flex-col gap-2">
            <a
              v-for="link in DONATION_LINKS"
              :key="link.name"
              class="btn btn-sm gap-2 no-underline"
              :href="link.url"
              rel="noopener"
              :style="{
                backgroundColor: BRAND_COLORS[link.name]?.bg,
                color: BRAND_COLORS[link.name]?.text,
                borderColor: BRAND_COLORS[link.name]?.bg,
              }"
              target="_blank"
            >
              <component :is="brandIcons[link.name]" v-if="brandIcons[link.name]" class="size-4" />
              {{ link.name }}
            </a>
          </div>
        </section>
      </div>
    </div>

    <form class="modal-backdrop" method="dialog">
      <button aria-label="Fermer" @click="close">
        close
      </button>
    </form>
  </dialog>
</template>
