<template>
  <v-alert
    dense
    outlined
    type="error"
    :icon="mdiAlert"
  >
    <div v-if="status === 'partial'">
      <span v-if="plannings && plannings.length === 1 && plannings[0] && plannings[0].timestamp">{{ $config.i18n.error_db_only }} <small>({{ $config.i18n.error_saved }}&nbsp;{{ $moment(plannings[0].timestamp).format('dddd DD MMM à HH:mm') }})</small></span>
      <span v-else>{{ $config.i18n.error_db_one }}&nbsp;({{ $config.i18n.error_saved2 }})</span>
    </div>
    <div v-else-if="status === 'off'">
      <span>{{ $config.i18n.error_db_all }}</span>
    </div>
    <div v-else>
      {{ $config.i18n.error_db2 }}
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
    plannings: {
      type: Array,
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
