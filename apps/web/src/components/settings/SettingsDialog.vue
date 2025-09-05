<script setup lang="ts">
import TagInput from '@web/components/inputs/TagInput.vue'
import { getDefaultColors, useSettings } from '@web/composables/useSettings'
import { ref, watch } from 'vue'

defineOptions({ name: 'SettingsDialog' })

const props = withDefaults(defineProps<{
  open?: boolean
}>(), {
  open: false,
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const dialogRef = ref<HTMLDialogElement | null>(null)
const settings = useSettings()

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
  <dialog ref="dialogRef" aria-labelledby="settings-title" class="modal" @close="emit('update:open', false)">
    <div class="modal-box max-w-xl">
      <form method="dialog">
        <button
          aria-label="Fermer"
          class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          @click="close"
        >
          ✕
        </button>
      </form>

      <h3 id="settings-title" class="font-bold text-xl mb-4">
        Paramètres
      </h3>

      <div class="space-y-6">
        <!-- 1) Couleurs des événements du calendrier -->
        <section class="space-y-2">
          <div class="flex items-center justify-between">
            <h4 class="font-semibold m-0">
              Couleurs des événements
            </h4>
            <button aria-label="Réinitialiser les couleurs" class="btn btn-ghost btn-xs" title="Réinitialiser les couleurs par défaut" type="button" @click="settings.colors.value = getDefaultColors()">
              Réinitialiser
            </button>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <label class="flex items-center gap-2 sm:gap-3">
              <span class="w-24">Amphi</span>
              <input
                v-model="settings.colors.value.lecture"
                class="input input-bordered w-24 h-10 p-1"
                type="color"
              >
            </label>
            <label class="flex items-center gap-2 sm:gap-3">
              <span class="w-24">TP</span>
              <input
                v-model="settings.colors.value.lab"
                class="input input-bordered w-24 h-10 p-1"
                type="color"
              >
            </label>
            <label class="flex items-center gap-2 sm:gap-3">
              <span class="w-24">TD</span>
              <input
                v-model="settings.colors.value.tutorial"
                class="input input-bordered w-24 h-10 p-1"
                type="color"
              >
            </label>
            <label class="flex items-center gap-2 sm:gap-3">
              <span class="w-24">Autre</span>
              <input
                v-model="settings.colors.value.other"
                class="input input-bordered w-24 h-10 p-1"
                type="color"
              >
            </label>
          </div>
          <p class="text-xs text-base-content/60 mt-1">
            Personnalisez les couleurs d’affichage des événements. Votre choix sera mémorisé sur cet appareil.
          </p>
        </section>

        <!-- 2) Surligner les événements avec enseignant -->
        <section>
          <h4 class="font-semibold mb-2">
            Surligner les événements avec enseignant
          </h4>
          <label class="label cursor-pointer justify-start gap-3">
            <input
              v-model="settings.highlightTeacher"
              aria-describedby="hl-teacher-desc" class="toggle"
              type="checkbox"
            >
            <span id="hl-teacher-desc" class="label-text">
              Les événements sans enseignant seront estompés (grisés).
            </span>
          </label>
        </section>

        <!-- 3) Liste de blocage -->
        <section>
          <h4 class="font-semibold mb-2">
            Liste de blocage
          </h4>
          <TagInput
            v-model="settings.blocklist.value"
            helper="Ajoutez des mots ou expressions à exclure du planning. Appuyez sur Entrée ou la virgule pour les ajouter."
            placeholder="Ajouter un élément puis Entrée ou virgule"
          />
        </section>
      </div>
      <div class="modal-action">
        <form method="dialog">
          <button class="btn" @click="close">
            Fermer
          </button>
        </form>
      </div>
    </div>

    <form class="modal-backdrop" method="dialog">
      <button aria-label="Fermer" @click="close">
        close
      </button>
    </form>
  </dialog>
</template>
