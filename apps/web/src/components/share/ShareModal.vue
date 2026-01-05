<script setup lang="ts">
import { usePlanningData } from '@web/composables/usePlanningData'
import { Check as IconCheck, Copy as IconCopy, X as IconX } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

defineOptions({ name: 'ShareModal' })

const props = withDefaults(defineProps<{
  open?: boolean
}>(), {
  open: false,
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const dialogRef = ref<HTMLDialogElement | null>(null)
const copied = ref(false)

const { planningFullIds } = usePlanningData()

const shareUrl = computed(() => {
  if (planningFullIds.value.length === 0) return ''
  const encoded = planningFullIds.value.join(',')
  const base = window.location.origin
  return `${base}/?p=${encodeURIComponent(encoded)}`
})

function close() {
  const el = dialogRef.value
  if (el?.open) el.close()
  emit('update:open', false)
}

async function copyToClipboard() {
  if (!shareUrl.value) return
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = shareUrl.value
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }
}

watch(() => props.open, (next) => {
  const el = dialogRef.value
  if (!el) return
  if (next) {
    copied.value = false
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
                copied ? 'btn-success' : 'btn-primary',
              ]"
              :disabled="!shareUrl"
              type="button"
              @click="copyToClipboard"
            >
              <Transition mode="out-in" name="fade-fast">
                <span v-if="copied" key="copied" class="flex items-center gap-1">
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

        <p v-if="planningFullIds.length === 0" class="text-sm text-warning">
          Aucun planning sélectionné. Sélectionnez au moins un planning pour générer un lien de partage.
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
