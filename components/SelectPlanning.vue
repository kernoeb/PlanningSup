<template>
  <div>
    <v-snackbar
      v-model="showSnackbar"
      :timeout="3000"
      absolute
      top
      color="teal"
      right
    >
      Copié dans le presse-papier !
    </v-snackbar>
    <v-snackbar
      v-model="showSnackbarError"
      :timeout="3000"
      absolute
      top
      color="error"
      right
    >
      Une erreur s'est produite, désolé.
    </v-snackbar>
    <v-card>
      <v-toolbar
        class="toolbar_edt"
        flat
      >
        <v-card-title class="headline">
          <v-icon class="mr-3">
            {{ mdiCalendar }}
          </v-icon>
          <div>
            <div style="font-size: 15px; height: 20px;">
              {{ $config.i18n.chooseEdt }}
            </div>
            <div style="font-size: 12px;">
              {{ (localPlannings && localPlannings.length) || 0 }} sélectionnés
            </div>
          </div>
        </v-card-title>
        <v-spacer />
        <v-btn
          v-tooltip="'Copier la sélection actuelle sous forme d\'URL dans le presse-papier'"
          icon
          @click="copyTextToClipboard($config.publicUrl + '/?p=' + localPlannings.join(','))"
        >
          <v-icon>{{ mdiContentCopy }}</v-icon>
        </v-btn><v-btn
          icon
          @click="$emit('close')"
        >
          <v-icon>{{ mdiClose }}</v-icon>
        </v-btn>
      </v-toolbar>

      <v-divider />

      <v-text-field
        v-model.trim="searchCalendar"
        :label="$config.i18n.searchPlanning"
        filled
        clearable
        :clear-icon="mdiClose"
        hide-details
        dense
      />
      <v-btn text small color="green" @click="reset">
        Réinitialiser
      </v-btn>
      <div v-if="urls">
        <v-treeview
          v-model="localPlannings"
          style="max-height: calc(90vh - 200px); overflow: auto;"
          :expand-icon="mdiMenuDown"
          :filter="filter"
          :indeterminate-icon="mdiMinusBox"
          :items="urls"
          :off-icon="mdiCheckboxBlankOutline"
          :on-icon="mdiCheckboxMarked"
          :search="searchCalendar"
          class="treeview_plannings"
          dense
          item-children="edts"
          item-key="fullId"
          item-text="title"
          open-on-click
          selectable
          selection-type="independent"
          transition
          @update:open="open"
        >
          <template #label="{item, selected}">
            <span :class="(selected || (item && item.fullId && localPlannings.some(v => v.startsWith(item.fullId)))) ? 'selected_planning' : ''">{{ item.title }}</span>
          </template>
        </v-treeview>
      </div>
      <div v-else style="min-height: 330px;" class="d-flex justify-center align-center">
        <v-progress-circular
          indeterminate
          color="yellow darken-2"
        />
      </div>
      <v-btn block :disabled="disabledValidate" @click="updatePlannings()">
        Valider
      </v-btn>
    </v-card>
  </div>
</template>

<script>
import { mdiClose, mdiContentCopy, mdiCalendar, mdiMenuDown, mdiMinusBox, mdiCheckboxBlankOutline, mdiCheckboxMarked } from '@mdi/js'

export default {
  name: 'SelectPlanning',
  props: {
    selectedPlannings: {
      type: Array,
      default: () => []
    },
    plannings: {
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
      mdiCalendar,
      mdiClose,
      mdiContentCopy,

      showSnackbar: false,
      showSnackbarError: false,
      searchCalendar: '',

      activatedPlanning: null,
      urls: null,

      localPlannings: []
    }
  },
  computed: {
    disabledValidate () {
      return JSON.stringify(this.localPlannings) === JSON.stringify(this.selectedPlannings)
    }
  },
  watch: {
    selectedPlannings: {
      handler (newVal, oldVal) {
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          this.localPlannings = newVal
        }
      },
      immediate: true
    }
  },
  mounted () {
    this.$axios.$get(`${this.$config.publicUrl}/api/v1/urls`).then((data) => {
      this.urls = data
    }).catch((err) => {
      console.log(err)
    })
  },
  methods: {
    // https://stackoverflow.com/questions/400212/how-do-i-copy-to-the-clipboard-in-javascript
    fallbackCopyTextToClipboard (text) {
      const textArea = document.createElement('textarea')
      textArea.value = text

      // Avoid scrolling to bottom
      textArea.style.top = '0'
      textArea.style.left = '0'
      textArea.style.position = 'fixed'

      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()

      try {
        const successful = document.execCommand('copy')
        const msg = successful ? 'successful' : 'unsuccessful'
        console.log('Fallback: Copying text command was ' + msg)
        this.showSnackbar = true
      } catch (err) {
        console.error('Fallback: Oops, unable to copy', err)
        this.showSnackbarError = true
      }

      document.body.removeChild(textArea)
    },
    copyTextToClipboard (text) {
      if (!navigator.clipboard) {
        this.fallbackCopyTextToClipboard(text)
        return
      }
      navigator.clipboard.writeText(text).then(() => {
        console.log('Async: Copying to clipboard was successful!')
        this.showSnackbar = true
      }, function (err) {
        console.error('Async: Could not copy text: ', err)
        this.showSnackbarError = true
      })
    },
    reset () {
      this.localPlannings = []
      this.searchCalendar = ''
    },
    open (ev) {
      console.log(ev)
    },
    filter: (item, search, textKey) => item[textKey].toUpperCase().includes(search.toUpperCase()),
    updatePlannings () {
      console.log(this.localPlannings)
      this.$emit('selected-plannings', this.localPlannings)
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
