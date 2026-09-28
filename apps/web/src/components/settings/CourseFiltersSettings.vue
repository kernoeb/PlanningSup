<script setup lang="ts">
import type { TimeSlot } from '@libs/event-filters'
import { isValidSlot } from '@libs/event-filters'
import { Plus as IconPlus, X as IconX } from '@lucide/vue'
import TagInput from '@web/components/inputs/TagInput.vue'
import { useSharedSettings } from '@web/composables/useSettings'
import { resolveTimezone } from '@web/composables/useTimezone'
import { computed, ref } from 'vue'

defineOptions({ name: 'CourseFiltersSettings' })

const { addTimeSlot, blocklist, eventFilters, targetTimezone } = useSharedSettings()

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

const teachers = computed({
  get: () => eventFilters.value.teachers,
  set: v => (eventFilters.value = { ...eventFilters.value, teachers: v }),
})
const rooms = computed({
  get: () => eventFilters.value.rooms,
  set: v => (eventFilters.value = { ...eventFilters.value, rooms: v }),
})

const newSlot = ref<TimeSlot>({ day: 1, start: '08:00', end: '10:00' })
const canAddSlot = computed(() => isValidSlot(newSlot.value))

function addSlot() {
  if (!canAddSlot.value) return
  addTimeSlot({ ...newSlot.value })
}

function removeSlot(index: number) {
  eventFilters.value = { ...eventFilters.value, slots: eventFilters.value.slots.filter((_, i) => i !== index) }
}

function showEvent(key: string) {
  eventFilters.value = { ...eventFilters.value, hidden: eventFilters.value.hidden.filter(h => h.key !== key) }
}

const hiddenEvents = computed(() => [...eventFilters.value.hidden]
  .sort((a, b) => a.start.localeCompare(b.start))
  .map(h => ({
    ...h,
    date: new Date(h.start).toLocaleString('fr-FR', { timeZone: resolveTimezone(targetTimezone.value), weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
  })))
</script>

<template>
  <section class="space-y-5">
    <div>
      <h4 class="font-semibold m-0">
        Masquer des cours
      </h4>
      <p class="text-xs text-base-content/60 mt-1">
        Les cours masqués disparaissent aussi du lien d’abonnement (ICS).
      </p>
    </div>

    <div>
      <h5 class="font-medium text-sm mb-2">
        Par nom
      </h5>
      <TagInput
        v-model="blocklist"
        helper="Masque les cours dont le nom contient ce texte. Appuyez sur Entrée ou la virgule pour ajouter."
        placeholder="Ajouter un nom puis Entrée ou virgule"
      />
    </div>

    <div>
      <h5 class="font-medium text-sm mb-2">
        Par enseignant
      </h5>
      <TagInput
        v-model="teachers"
        helper="Masque les cours dont la description contient ce texte, par exemple « pas de prof » ou un nom de famille. L’enseignant n’est pas indiqué dans tous les plannings."
        placeholder="Ajouter un enseignant puis Entrée ou virgule"
      />
    </div>

    <div>
      <h5 class="font-medium text-sm mb-2">
        Par salle
      </h5>
      <TagInput
        v-model="rooms"
        helper="Masque les cours dont la salle contient ce texte, par exemple « joker »."
        placeholder="Ajouter une salle puis Entrée ou virgule"
      />
    </div>

    <div>
      <h5 class="font-medium text-sm mb-2">
        Par créneau
      </h5>
      <div v-if="eventFilters.slots.length" class="flex flex-wrap gap-2 mb-2" role="list">
        <span
          v-for="(slot, idx) in eventFilters.slots"
          :key="`${slot.day}-${slot.start}-${slot.end}`"
          class="badge badge-soft items-center gap-1 pl-2 pr-1"
          role="listitem"
        >
          <span>{{ DAYS[slot.day - 1] }} {{ slot.start }} – {{ slot.end }}</span>
          <button
            :aria-label="`Retirer le créneau ${DAYS[slot.day - 1]} ${slot.start} – ${slot.end}`"
            class="btn btn-ghost btn-xs btn-circle min-h-0 h-4 w-4"
            type="button"
            @click="removeSlot(idx)"
          >
            <IconX class="size-3" />
          </button>
        </span>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <select v-model.number="newSlot.day" aria-label="Jour" class="select select-bordered select-sm w-32">
          <option v-for="(label, idx) in DAYS" :key="label" :value="idx + 1">
            {{ label }}
          </option>
        </select>
        <input v-model="newSlot.start" aria-label="Début" class="input input-bordered input-sm w-28" type="time">
        <span aria-hidden="true">–</span>
        <input v-model="newSlot.end" aria-label="Fin" class="input input-bordered input-sm w-28" type="time">
        <button class="btn btn-sm btn-outline gap-1" :disabled="!canAddSlot" type="button" @click="addSlot">
          <IconPlus class="size-4" />
          Ajouter
        </button>
      </div>
      <p class="text-xs text-base-content/60 mt-1">
        Masque chaque semaine les cours qui ont lieu, même en partie, sur ce créneau.
      </p>
    </div>

    <div v-if="hiddenEvents.length">
      <h5 class="font-medium text-sm mb-2">
        Cours masqués un par un
      </h5>
      <ul class="space-y-1">
        <li
          v-for="h in hiddenEvents"
          :key="h.key"
          class="flex items-center justify-between gap-2 px-3 py-2 bg-base-200 dark:bg-base-100 rounded-lg"
        >
          <div class="min-w-0">
            <div class="text-sm font-medium truncate">
              {{ h.title || 'Cours' }}
            </div>
            <div class="text-xs text-base-content/60 first-letter:uppercase">
              {{ h.date }}
            </div>
          </div>
          <button class="btn btn-ghost btn-xs flex-shrink-0" type="button" @click="showEvent(h.key)">
            Réafficher
          </button>
        </li>
      </ul>
    </div>
  </section>
</template>
