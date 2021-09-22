<template>
  <v-expansion-panels class="select_planning">
    <v-expansion-panel v-for="(u, i) in urls" :key="`urls_${i}`">
      <v-expansion-panel-header :expand-icon="mdiChevronDown">
        {{ u.title }}
      </v-expansion-panel-header>
      <v-expansion-panel-content>
        <select-planning v-if="u.edts && u.edts.some(v => v.edts)" :urls="u.edts" :old="old ? (old + '.' + u.id) : u.id" />
        <v-list-item
          v-for="(v, j) in u.edts"
          v-else
          :key="`url_item_${j}`"
          class="ml-3"
          @click="addPlanning(old ? (old + '.' + u.id + '.' + v.id) : u.id + '.' + v.id)"
        >
          <v-list-item-content>
            <v-list-item-title :class="(selectedPlannings && selectedPlannings.includes(old ? (old + '.' + u.id + '.' + v.id) : u.id + '.' + v.id)) ? 'font-weight-bold' : ''">
              {{ v.title }}
            </v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-expansion-panel-content>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script>
import { mdiChevronDown } from '@mdi/js'
import { mapMutations, mapState } from 'vuex'

export default {
  name: 'SelectPlanning',
  props: {
    old: {
      type: String,
      default: ''
    },
    urls: {
      type: Array,
      default: () => []
    }
  },
  data () {
    return {
      mdiChevronDown
    }
  },
  computed: {
    ...mapState(['selectedPlannings'])
  },
  methods: {
    ...mapMutations(['addPlanning'])
  }
}
</script>

<style scoped>
.select_planning .v-expansion-panel-header, .v-list-item {
  min-height: 34px!important;
  height: 38px;
}

.select_planning .v-expansion-panels, .v-expansion-panel {
  border-radius: 0!important;
}

.v-expansion-panel-header {
    padding: 16px 18px;
}

.v-expansion-panel-content__wrap {
    padding: 0 18px 16px!important;
}
</style>
