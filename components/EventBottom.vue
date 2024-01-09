<template>
  <v-bottom-sheet
    :value="bottom"
    @input="$emit('change', $event)"
  >
    <v-sheet
      class="text-center"
    >
      <div class="ml-3 mr-3 pa-2">
        <div
          v-if="selectedEvent && selectedEvent.event"
          class="mb-2"
        >
          <div class="mt-4 font-weight-bold title">
            {{ selectedEvent.event.name }}
          </div>
          <div
            v-if="selectedEvent.event.location"
            style="font-size: 14px; font-weight: normal"
            class="mb-3"
            :style="$vuetify.theme.dark ? 'color: gainsboro;' : null"
          >
            {{ selectedEvent.event.location }}
          </div>
          <div
            v-if="selectedEvent.event.description"
            style="font-size: 12px; font-weight: normal"
            class="mb-2"
          >
            {{ selectedEvent.event.description }}
          </div>
          <div class="font-weight-bold">
            {{ $moment(selectedEvent.event.start).format('H:mm') }} - {{ $moment(selectedEvent.event.end).format('H:mm') }}
          </div>
        </div>
        <div
          v-if="selectedEvent && selectedEvent.content"
          style="font-size: 14px;"
        >
          <code>{{ selectedEvent.content }}</code>
        </div>
      </div>
      <div class="pa-5" />
      <v-btn
        style="position:absolute; margin-left:-50px; left:50%; width:100px; bottom:0;"
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
  name: 'EventBottom',
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
