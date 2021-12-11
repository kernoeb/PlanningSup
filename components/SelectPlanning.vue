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
          @click="copyTextToClipboard()"
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
          style="max-height: calc(90vh - 200px); overflow: auto;"
          :expand-icon="mdiMenuDown"
          :filter="filter"
          :items="urls"
          :search="searchCalendar"
          class="treeview_plannings"
          dense
          open-on-click
          item-children="edts"
          item-key="fullId"
          item-text="title"
          transition
        >
          <template #label="{ item }">
            <div :class="(item && item.fullId && localPlannings.some(v => v.startsWith(item.fullId))) ? 'selected_planning' : ''">
              <v-checkbox
                v-if="!item.edts"
                v-model="localPlannings"
                color="#2196F3"
                :value="item.fullId"
                :indeterminate-icon="mdiCheckboxBlankOutline"
                :off-icon="mdiCheckboxBlankOutline"
                :on-icon="mdiCheckboxMarked"
                :label="item.title"
              />
              <div v-else>
                {{ item.title }}
              </div>
            </div>
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
    this.$axios.$get('/api/v1/urls').then((data) => {
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
    copyTextToClipboard () {
      const { href } = location
      const text = (href.endsWith('/') ? href.slice(0, -1) : href) + '/?p=' + this.localPlannings.join(',')

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
    filter: (item, search, textKey) => item[textKey].toUpperCase().includes(search.toUpperCase()),
    updatePlannings () {
      console.log(this.localPlannings)
      this.$emit('selected-plannings', this.localPlannings)
    }
  }
}
</script>

<style>
.v-treeview-node__level {
  width: 8px !important;
}
.accent--text svg {
  color:#2196F3 !important;
}
.treeview_plannings .v-input__slot {
  margin-bottom: 0!important;
  min-height: 40px;
  padding-left: 8px;
 }
.treeview_plannings .v-messages {
  display: none!important;
}
.treeview_plannings .v-input--selection-controls {
  margin-top: 0!important;
  padding-top: 0!important;
}
.treeview_plannings .theme--light.v-label {
  color: inherit!important;
}
</style>
