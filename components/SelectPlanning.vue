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
      <div style="max-height: calc(90vh - 300px); overflow: auto;">
        <transition name="fade">
          <div v-if="filteredFavorites && filteredFavorites.length" class="pa-2">
            <v-card rounded>
              <v-card-title>
                <v-icon color="orange" class="mt-n1 mr-1">
                  {{ mdiStar }}
                </v-icon>
                <span class="text-h6 font-weight-bold">Favoris</span>
              </v-card-title>
              <v-card-text>
                <v-list rounded dense>
                  <transition-group name="list-complete" tag="div">
                    <v-list-item
                      v-for="(favorite, i) in filteredFavorites"
                      :key="`${i}-${favorite}`"
                      dense
                      class="list-complete-item"
                      link
                      @click="localPlannings = [favorite]; updatePlannings(); $emit('close');"
                    >
                      <v-list-item-content>
                        <v-list-item-title>{{ getFavoriteName(favorite) }}</v-list-item-title>
                        <v-list-item-subtitle class="text--disabled">
                          {{ favorite }}
                        </v-list-item-subtitle>
                      </v-list-item-content>
                      <v-list-item-action>
                        <v-btn small icon @click="setFavorite(favorite)">
                          <v-icon small color="red">
                            {{ mdiDelete }}
                          </v-icon>
                        </v-btn>
                      </v-list-item-action>
                    </v-list-item>
                  </transition-group>
                </v-list>
              </v-card-text>
            </v-card>
          </div>
        </transition>
        <div>
          <div v-if="urls" class="mb-2">
            <v-treeview
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
                <div class="d-flex justify-space-between">
                  <div :class="(item && item.fullId && localPlannings.some(v => v.startsWith(item.fullId))) ? 'selected_planning' : ''" style="width: 100%;">
                    <v-checkbox
                      v-if="!item.edts"
                      v-model="localPlannings"
                      :title="item.fullId"
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
                  <v-hover v-if="!item.edts" v-slot="{ hover }">
                    <v-btn
                      icon
                      style="margin-top: 2px;"
                      @click="setFavorite(item.fullId)"
                    >
                      <v-icon v-if="(favorites || []).includes(item.fullId)" color="orange">
                        {{ mdiStar }}
                      </v-icon>
                      <v-icon v-else :color="hover ? 'orange' : 'grey lighten-2'">
                        {{ mdiStarOutline }}
                      </v-icon>
                    </v-btn>
                  </v-hover>
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
        </div>
      </div>

      <v-btn block :disabled="disabledValidate" @click="updatePlannings()">
        Valider
      </v-btn>
    </v-card>
  </div>
</template>

<script>
import { mdiDelete, mdiStarHalfFull, mdiStar, mdiStarOutline, mdiClose, mdiContentCopy, mdiCalendar, mdiMenuDown, mdiMinusBox, mdiCheckboxBlankOutline, mdiCheckboxMarked } from '@mdi/js'

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
    },
    dialog: {
      type: Boolean,
      default: false
    }
  },
  data () {
    return {
      mdiDelete,
      mdiCheckboxBlankOutline,
      mdiCheckboxMarked,
      mdiMinusBox,
      mdiMenuDown,
      mdiCalendar,
      mdiClose,
      mdiContentCopy,
      mdiStarHalfFull,
      mdiStar,
      mdiStarOutline,

      showSnackbar: false,
      showSnackbarError: false,
      searchCalendar: '',

      activatedPlanning: null,
      urls: null,

      localPlannings: [],
      favorites: [],

      planningNames: null
    }
  },
  computed: {
    filteredFavorites () {
      if (!this.favorites) return null
      return [...this.favorites].filter(v => v)
    },
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
  created () {
    try {
      this.favorites = this.$cookies?.get('favorites')?.split(',') || []
      this.getNames()
      if (this.$cookies?.get('favorites') === '') this.$cookies.remove('favorites')
    } catch (err) {}
  },
  mounted () {
    window.addEventListener('keyup', this.keyup)

    this.$axios.$get('/api/v1/urls').then((data) => {
      this.urls = data
    }).catch((err) => {
      console.log(err)
    })
  },
  beforeDestroy () {
    window.removeEventListener('keyup', this.keyup)
  },
  methods: {
    keyup (event) {
      if (event.key === 'Enter' || event.keyCode === 13) {
        if (!this.disabledValidate && this.dialog) this.updatePlannings()
      }
    },
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
    getNames () {
      if (this.favorites && this.favorites.length) {
        this.$axios.$get('/api/v1/calendars/info', { params: { p: this.favorites.join(',') } }).then((data) => {
          this.planningNames = data
        }).catch(() => {
          this.planningNames = []
        })
      }
    },
    reset () {
      this.localPlannings = []
      this.searchCalendar = ''
    },
    filter: (item, search, textKey) => item[textKey].toUpperCase().includes(search.toUpperCase()),
    updatePlannings () {
      this.$emit('selected-plannings', this.localPlannings)
    },
    setFavorite (id) {
      let tmp = [...(this.favorites || [])]
      if ((this.favorites || []).includes(id)) tmp = tmp.filter(v => v !== id)
      else tmp.push(id)
      const final = [...new Set(tmp)]
      this.favorites = final
      this.$cookies.set('favorites', final.join(','), { maxAge: 2147483646 })
      this.getNames()
    },
    getFavoriteName (favorite) {
      if (this.planningNames === null) return ''
      return this.planningNames?.find(v => v.planning === favorite)?.title || favorite
    }
  }
}
</script>

<style>
.v-treeview-node__level {
  width: 17px !important;
}
.accent--text svg {
  color:#2196F3 !important;
}
.treeview_plannings.theme--light .v-treeview-node__root .v-treeview-node__level::before {
  border: 0.5px dashed rgba(211, 196, 196, 0.7) !important;
}

.treeview_plannings .v-treeview-node__root .v-treeview-node__level::before {
  border: 0.5px dashed rgba(211, 196, 196, 0.3) !important;
}

.treeview_plannings .v-treeview-node__root .v-treeview-node__level::before {
  height: 38px !important;
  content: '' !important;
  margin-left: 10px !important;
  display: flex !important;
  width: 0!important;
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

.list-complete-item {
  transition: all 0.4s;
}
.list-complete-enter, .list-complete-leave-to  {
  opacity: 0;
  transform: translateY(-30px);
}
.list-complete-leave-active {
  position: absolute;
}
.fade-enter-active, .fade-leave-active {
  transition: opacity .5s;
}
.fade-enter, .fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
  opacity: 0;
}
</style>
