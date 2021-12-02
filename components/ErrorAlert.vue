<template>
  <v-alert
    dense
    outlined
    type="error"
    :icon="mdiAlert"
  >
    <div v-if="status === 'semi'">
      <span v-if="timestamp">{{ $config.i18n.error_db_only }} <small>({{ $config.i18n.error_saved }}&nbsp;{{ $moment(timestamp).format('dddd DD MMM à HH:mm') }})</small></span>
      <span v-else>{{ $config.i18n.error_db_one }}&nbsp;({{ $config.i18n.error_saved2 }})</span>
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
import { mdiAlert } from '@mdi/js'

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
  },
  data () {
    return {
      mdiAlert
    }
  }
}
</script>

<style scoped>

</style>
