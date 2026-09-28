<script setup lang="ts">
import { CalendarPlus as IconCalendarPlus, Check as IconCheck, Copy as IconCopy, X as IconX } from '@lucide/vue'
import { usePlanningData } from '@web/composables/usePlanningData'
import { useSharedSettings } from '@web/composables/useSettings'
import { computed, ref, useTemplateRef, watch } from 'vue'

defineOptions({ name: 'ShareModal' })

const { open = false } = defineProps<{ open?: boolean }>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const dialogRef = useTemplateRef('dialogRef')
const copied = ref<'share' | 'ics' | null>(null)

// Keep in sync with MAX_ICS_PLANNINGS in apps/api/src/routes/ics.ts
const MAX_ICS_PLANNINGS = 50

const { planningFullIds } = usePlanningData()
const { filterParams } = useSharedSettings()

const shareUrl = computed(() => {
  if (planningFullIds.value.length === 0) return ''
  const encoded = planningFullIds.value.join(',')
  const base = window.location.origin
  return `${base}/?p=${encodeURIComponent(encoded)}`
})

const icsUrl = computed(() => {
  if (planningFullIds.value.length === 0 || planningFullIds.value.length > MAX_ICS_PLANNINGS) return ''
  const params = new URLSearchParams({ p: planningFullIds.value.join(','), ...filterParams.value })
  const base = import.meta.env.VITE_BACKEND_URL || window.location.origin
  return `${base}/api/ics?${params}`
})

// webcal:// opens the default calendar app (Apple Calendar, Outlook) with a subscribe prompt.
const webcalUrl = computed(() => icsUrl.value.replace(/^https?:/, 'webcal:'))

function close() {
  const el = dialogRef.value
  if (el?.open) el.close()
  emit('update:open', false)
}

async function copyToClipboard(kind: 'share' | 'ics') {
  const value = kind === 'share' ? shareUrl.value : icsUrl.value
  if (!value) return
  await navigator.clipboard.writeText(value)
  copied.value = kind
  setTimeout(() => {
    if (copied.value === kind) copied.value = null
  }, 2000)
}

watch(() => open, (next) => {
  const el = dialogRef.value
  if (!el) return
  if (next) {
    copied.value = null
    if (!el.open) el.showModal()
  } else {
    if (el.open) el.close()
  }
}, { immediate: true })
</script>

<template>
  <dialog ref="dialogRef" aria-labelledby="share-title" class="modal" @close="emit('update:open', false)">
    <div class="modal-box max-w-lg flex flex-col p-0">
      <div class="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-base-300 dark:border-base-200 bg-base-200 dark:bg-base-100">
        <h3 id="share-title" class="font-bold text-xl">
          Partager la sélection
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
        <p class="text-sm text-base-content/70">
          Partagez ce lien pour permettre à d'autres personnes de voir les mêmes plannings que vous avez sélectionnés.
        </p>

        <div class="space-y-2">
          <label class="text-sm font-medium" for="share-url">Lien de partage</label>
          <div class="flex gap-2">
            <input
              id="share-url"
              class="input input-bordered flex-1 text-sm font-mono"
              readonly
              type="text"
              :value="shareUrl"
              @focus="($event.target as HTMLInputElement).select()"
            >
            <button
              class="btn min-w-24" :class="[
                copied === 'share' ? 'btn-success' : 'btn-primary',
              ]"
              :disabled="!shareUrl"
              type="button"
              @click="copyToClipboard('share')"
            >
              <Transition mode="out-in" name="fade-fast">
                <span v-if="copied === 'share'" key="copied" class="flex items-center gap-1">
                  <IconCheck class="size-4" />
                  Copié
                </span>
                <span v-else key="copy" class="flex items-center gap-1">
                  <IconCopy class="size-4" />
                  Copier
                </span>
              </Transition>
            </button>
          </div>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium" for="ics-url">Lien ICS pour votre agenda</label>
          <p class="text-sm text-base-content/70">
            Ajoutez ce lien comme abonnement dans Google Agenda, Apple Calendrier ou Outlook. Les cours que vous avez cachés n’y apparaissent pas non plus.
          </p>
          <div class="flex gap-2">
            <input
              id="ics-url"
              class="input input-bordered flex-1 text-sm font-mono"
              readonly
              type="text"
              :value="icsUrl"
              @focus="($event.target as HTMLInputElement).select()"
            >
            <button
              class="btn min-w-24" :class="[
                copied === 'ics' ? 'btn-success' : 'btn-primary',
              ]"
              :disabled="!icsUrl"
              type="button"
              @click="copyToClipboard('ics')"
            >
              <Transition mode="out-in" name="fade-fast">
                <span v-if="copied === 'ics'" key="copied" class="flex items-center gap-1">
                  <IconCheck class="size-4" />
                  Copié
                </span>
                <span v-else key="copy" class="flex items-center gap-1">
                  <IconCopy class="size-4" />
                  Copier
                </span>
              </Transition>
            </button>
          </div>
          <a
            v-if="icsUrl"
            class="btn btn-sm btn-ghost gap-1"
            :href="webcalUrl"
          >
            <IconCalendarPlus class="size-4" />
            Ouvrir dans l'agenda
          </a>
        </div>

        <p v-if="planningFullIds.length === 0" class="text-sm text-warning">
          Aucun planning sélectionné. Sélectionnez au moins un planning pour générer un lien de partage.
        </p>
        <p v-else-if="planningFullIds.length > MAX_ICS_PLANNINGS" class="text-sm text-warning">
          Le lien ICS accepte {{ MAX_ICS_PLANNINGS }} plannings au maximum.
        </p>
      </div>
    </div>

    <form class="modal-backdrop" method="dialog">
      <button aria-label="Fermer" @click="close">
        close
      </button>
    </form>
  </dialog>
</template>

<style scoped>
.fade-fast-enter-active,
.fade-fast-leave-active {
  transition: opacity 0.15s ease;
}

.fade-fast-enter-from,
.fade-fast-leave-to {
  opacity: 0;
}
</style>
