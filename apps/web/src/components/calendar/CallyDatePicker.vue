<script lang="ts" setup>
import { ChevronLeft as IconChevronLeft, ChevronRight as IconChevronRight } from 'lucide-vue-next'
import { computed } from 'vue'
import 'cally'

defineOptions({ name: 'CallyDatePicker' })

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const model = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value),
})
</script>

<template>
  <!-- eslint-disable vue/no-deprecated-slot-attribute -- Web component requires native slot attribute -->
  <calendar-date
    v-model.lazy="model"
    class="cally bg-base-100 border border-base-200 shadow-lg rounded-box"
  >
    <IconChevronLeft slot="previous" aria-label="Précédent" :size="16" />
    <IconChevronRight slot="next" aria-label="Suivant" :size="16" />
    <calendar-month />
  </calendar-date>
  <!-- eslint-enable vue/no-deprecated-slot-attribute -->
</template>
