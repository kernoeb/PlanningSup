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
    selectable
    selection-type="independent"
    transition
    @input="$emit('selected-plannings', $event)"
    @update:active="addPlanning"
  >
    <template #label="{item}">
      <span :class="selectedPlannings.includes(item.fullId) ? 'selected_planning' : ''">{{ item.title }}</span>
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
        this.$emit('selected-plannings', [...this.selectedPlannings])
      }).catch(() => {
      })
    }, 0)
  },
  methods: {
    filter: (item, search, textKey) => item[textKey].toUpperCase().includes(search.toUpperCase()),
    addPlanning (event) {
      let tmp = [...this.selectedPlannings]
      if (event && event.length) {
        if (tmp.includes(event?.[0])) tmp = tmp.filter(v => v !== event?.[0])
        else tmp.push(event[0])
        this.$emit('selected-plannings', tmp)
        this.activatedPlanning = event?.[0]
      } else {
        this.$emit('selected-plannings', tmp.filter(v => v !== this.activatedPlanning))
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
.v-treeview-node__level {
  width:12px !important;
}
.accent--text svg {
  color:#2196F3 !important;
}
.treeview_plannings > .v-treeview-node:nth-last-child(1):not(.treeview_plannings > .v-treeview-node[aria-expanded=true]) {
  padding-bottom:10px;
}
.treeview_plannings > .v-treeview-node:nth-last-child(1) .v-treeview-node:nth-last-child(1):not(.treeview_plannings > .v-treeview-node:nth-last-child(1) .v-treeview-node[aria-expanded=true]) {
  padding-bottom:10px;
}
</style>
