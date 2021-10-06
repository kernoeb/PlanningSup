<template>
  <v-treeview
    :expand-icon="mdiMenuDown"
    :filter="filter"
    :indeterminate-icon="mdiMinusBox"
    :items="urls"
    :off-icon="mdiCheckboxBlankOutline"
    :on-icon="mdiCheckboxMarked"
    :search="searchCalendar"
    :value="selectedPlannings"
    activatable
    class="treeview_plannings"
    dense
    item-children="edts"
    item-key="fullId"
    item-text="title"
    open-on-click
    return-object
    selectable
    selection-type="independent"
    transition
    @input="$emit('selected-plannings', $event)"
    @update:active="addPlanning"
  >
    <template #label="{item}">
      <span :class="selectedPlannings.some(i => i.fullId === item.fullId) ? 'selected_planning' : ''">{{ item.title }}</span>
    </template>
  </v-treeview>
</template>

<script>
import { mdiMenuDown, mdiMinusBox, mdiCheckboxBlankOutline, mdiCheckboxMarked } from '@mdi/js'

export default {
  name: 'SelectPlanning',
  props: {
    searchCalendar: {
      type: String,
      default: ''
    },
    selectedPlannings: {
      type: Array,
      default: () => []
    }
  },
  data () {
    return {
      mdiCheckboxBlankOutline,
      mdiCheckboxMarked,
      mdiMinusBox,
      mdiMenuDown,

      activatedPlanning: null,
      urls: []
    }
  },
  mounted () {
    setTimeout(() => {
      this.$axios.$get(this.$config.apiUrls).then((data) => {
        this.urls = data
      }).catch(() => {
      })
    }, 0)
  },
  methods: {
    filter: (item, search, textKey) => item[textKey].toUpperCase().includes(search.toUpperCase()),
    addPlanning (event) {
      if (event && event.length) {
        let tmp = [...this.selectedPlannings]
        if (tmp.some(v => v.fullId === event?.[0]?.fullId)) tmp = tmp.filter(v => v.fullId !== event?.[0]?.fullId)
        else tmp.push(event[0])
        this.$emit('selected-plannings', tmp)
        this.activatedPlanning = event?.[0]?.fullId
      } else {
        this.$emit('selected-plannings', this.selectedPlannings.filter(v => v.fullId !== this.activatedPlanning))
      }
    }
  }
}
</script>

<style>
.treeview_plannings button.v-treeview-node__checkbox {
  display: none !important;
}

.treeview_plannings .v-treeview-node--leaf button.v-treeview-node__checkbox {
  display: block !important;
}
</style>
