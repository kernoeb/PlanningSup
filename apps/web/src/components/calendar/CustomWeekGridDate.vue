<script lang="ts" setup>
import type { ComputedRef } from 'vue'
import { computed, inject } from 'vue'

const props = defineProps<{ date: string }>()

const laneTitles = inject<ComputedRef<string[]>>('laneTitles')
const eventWidth = inject<ComputedRef<number>>('eventWidth')

const plainDate = computed(() => Temporal.PlainDate.from(props.date))
const dayName = computed(() => plainDate.value.toLocaleString('fr-FR', { weekday: 'short' }))
</script>

<template>
  <div class="sx__week-grid__day-name">
    {{ dayName }}
  </div>
  <div class="sx__week-grid__date-number">
    {{ plainDate.day }}
  </div>
  <div
    v-if="laneTitles?.length"
    class="planning-lane-titles"
    :style="{ width: `calc((100% - 1px) * ${(eventWidth ?? 100) / 100})`, gridTemplateColumns: `repeat(${laneTitles.length}, minmax(0, 1fr))` }"
  >
    <span v-for="(title, i) in laneTitles" :key="i" class="truncate" :title="title">{{ title }}</span>
  </div>
</template>
