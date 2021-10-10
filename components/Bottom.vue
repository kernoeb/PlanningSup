<template>
  <v-bottom-sheet :value="bottom" @input="$emit('change', $event)">
    <v-sheet
      class="text-center"
      height="200px"
    >
      <div v-if="selectedEvent" class="py-3">
        <div class="mt-4 font-weight-bold ml-1 mr-1">
          {{ selectedEvent.name }}
        </div>
        <div v-if="selectedEvent.location || selectedEvent.description">
          {{ selectedEvent.location }}{{ (selectedEvent.location && selectedEvent.description) ? ' | ' : '' }}{{ selectedEvent.description }}
        </div>
        <div>{{ $moment(selectedEvent.start).format('H:mm') }} - {{ $moment(selectedEvent.end).format('H:mm') }}</div>
      </div>
      <v-btn
        class="mt-6"
        text
        @click="$emit('close')"
      >
        <span style="color: red">{{ $config.i18n.close }}</span>
      </v-btn>
    </v-sheet>
  </v-bottom-sheet>
</template>

<script>
export default {
  name: 'Bottom',
  props: {
    selectedEvent: {
      type: Object,
      default: () => {}
    },
    bottom: {
      type: Boolean,
      default: false
    }
  }
}
</script>

<style scoped>

</style>
