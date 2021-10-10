<template>
  <v-alert
    dense
    outlined
    type="error"
  >
    <div v-if="status === 'semi'">
      <span>{{ $config.i18n.error_db_one }}</span>
    </div>
    <div v-else-if="status === 'off'">
      <span>{{ $config.i18n.error_db_all }}</span>
    </div>
    <div v-else>
      <span v-if="timestamp">{{ $config.i18n.error_db }}{{ $moment(timestamp).format('dddd DD MMM à HH:mm') }}.</span>
      <span v-else>{{ $config.i18n.error_db2 }}</span>
    </div>
  </v-alert>
</template>

<script>
export default {
  name: 'ErrorAlert',
  props: {
    status: {
      type: String,
      default: 'on'
    },
    timestamp: {
      type: Number,
      default: null
    }
  }
}
</script>

<style scoped>

</style>
