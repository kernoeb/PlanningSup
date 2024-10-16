<template>
  <div>
    <v-tooltip top>
      <template #activator="{ on, attrs }">
        <v-btn
          icon
          v-bind="attrs"
          @click="$emit('change_dialog', true)"
          v-on="on"
        >
          <v-icon>{{ mdiCogOutline }}</v-icon>
        </v-btn>
      </template>
      <span style="margin-right: 2px">{{ $config.i18n.settings }}</span><span
        style="color: lightgrey; font-size: 10px"
      >(p)</span>
    </v-tooltip>
    <v-dialog
      :value="dialogSettings"
      width="600"
      @input="$emit('change_dialog', $event)"
    >
      <v-card>
        <v-toolbar
          class="toolbar_edt"
          flat
        >
          <v-card-title class="headline">
            <v-icon class="mr-2">
              {{ mdiCogOutline }}
            </v-icon>
            <span style="font-size: 15px">{{ $config.i18n.settings }}</span>
          </v-card-title>
          <v-spacer />
          <v-btn
            icon
            @click="$emit('change_dialog', false)"
          >
            <v-icon>{{ mdiClose }}</v-icon>
          </v-btn>
        </v-toolbar>

        <v-divider />

        <v-list-item-group
          :value="settings"
          multiple
          class="pa-2"
          :class="$vuetify.theme.dark ? 'custom_swatch-dark' : 'custom_swatch-light'"
          @change="$emit('change_settings', $event)"
        >
          <v-subheader>{{ $config.i18n.ui }}</v-subheader>
          <v-list-item
            inactive
            style="cursor:pointer;"
          >
            <v-list-item-action>
              <v-checkbox
                v-model="checkedTheme"
                :indeterminate-icon="mdiCheckboxBlankOutline"
                :off-icon="mdiCheckboxBlankOutline"
                :on-icon="mdiCheckboxMarked"
              />
            </v-list-item-action>

            <v-list-item-content @click="$vuetify.theme.dark = !$vuetify.theme.dark">
              <v-list-item-title>{{ $config.i18n.lightThemeMsg }}</v-list-item-title>
              <v-list-item-subtitle>{{ $config.i18n.lightThemeDesc }}</v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
          <v-list-item
            inactive
            style="cursor:pointer;"
          >
            <v-list-item-action>
              <v-checkbox
                v-model="checkedFullDark"
                :indeterminate-icon="mdiCheckboxBlankOutline"
                :off-icon="mdiCheckboxBlankOutline"
                :on-icon="mdiCheckboxMarked"
              />
            </v-list-item-action>
            <v-list-item-content @click="forceFullMode()">
              <v-list-item-title>Événements sombres</v-list-item-title>
              <v-list-item-subtitle>Encore plus dark (mode forcé)</v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
          <v-list-item
            inactive
            style="cursor:pointer;"
          >
            <v-list-item-action>
              <v-checkbox
                v-model="checkedMergeDuplicates"
                :indeterminate-icon="mdiCheckboxBlankOutline"
                :off-icon="mdiCheckboxBlankOutline"
                :on-icon="mdiCheckboxMarked"
              />
            </v-list-item-action>
            <v-list-item-content @click="switchMergeDuplicates()">
              <v-list-item-title>Fusionner les événements identiques</v-list-item-title>
              <v-list-item-subtitle>Pour les utilisateurs qui doivent sélectionner plusieurs plannings</v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
          <v-subheader>{{ $config.i18n.colors }}</v-subheader>
          <v-list-item inactive>
            <v-list-item-action>
              <v-swatches
                v-model="colorTD"
                :background-color="$vuetify.theme.dark ? '#151515' : '#fff'"
                :trigger-style="{ width: '30px', height: '30px', borderRadius: '5px' }"
                show-fallback
                fallback-input-type="color"
                @input="setColor('td', $event)"
              />
            </v-list-item-action>
            <v-list-item-content>
              <v-list-item-title>TD</v-list-item-title>
              <v-list-item-subtitle>{{ $config.i18n.types.td }}</v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
          <v-list-item inactive>
            <v-list-item-action>
              <v-swatches
                v-model="colorTP"
                :background-color="$vuetify.theme.dark ? '#000' : '#fff'"
                :trigger-style="{ width: '30px', height: '30px', borderRadius: '5px' }"
                show-fallback
                fallback-input-type="color"
                @input="setColor('tp', $event)"
              />
            </v-list-item-action>
            <v-list-item-content>
              <v-list-item-title>TP</v-list-item-title>
              <v-list-item-subtitle>{{ $config.i18n.types.tp }}</v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
          <v-list-item inactive>
            <v-list-item-action>
              <v-swatches
                v-model="colorAmphi"
                :background-color="$vuetify.theme.dark ? '#000' : '#fff'"
                :trigger-style="{ width: '30px', height: '30px', borderRadius: '5px' }"
                show-fallback
                fallback-input-type="color"
                @input="setColor('amphi', $event)"
              />
            </v-list-item-action>
            <v-list-item-content>
              <v-list-item-title>Amphis</v-list-item-title>
              <v-list-item-subtitle>{{ $config.i18n.types.amphi }}</v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
          <v-list-item inactive>
            <v-list-item-action>
              <v-swatches
                v-model="colorOthers"
                :background-color="$vuetify.theme.dark ? '#000' : '#fff'"
                :trigger-style="{ width: '30px', height: '30px', borderRadius: '5px' }"
                show-fallback
                fallback-input-type="color"
                @input="setColor('other', $event)"
              />
            </v-list-item-action>
            <v-list-item-content>
              <v-list-item-title>{{ $config.i18n.others }}</v-list-item-title>
              <v-list-item-subtitle>{{ $config.i18n.types.other }}</v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
          <div
            class="pl-4 mb-2"
            style="font-weight: 300; font-size: 15px;"
            @click="reset()"
          >
            <a class="hover_reset">Réinitialiser</a>
          </div>
          <v-divider />
          <v-subheader>{{ $config.i18n.blocklist }}</v-subheader>
          <v-list-item inactive>
            <v-combobox
              v-model="blocklistSelect"
              :append-icon="mdiMenuDown"
              :search-input.sync="blocklistSelectSearch"
              :items="blocklist"
              :label="$config.i18n.blocklistDesc"
              chips
              multiple
              class="ban-word"
              @change="updateBlocklist"
            >
              <template #selection="{ attrs, item, parent, selected }">
                <v-chip
                  v-bind="attrs"
                  :input-value="selected"
                  label
                  small
                >
                  <span class="pr-2">
                    {{ item }}
                  </span>
                  <v-btn
                    icon
                    x-small
                    @click="parent.selectItem(item)"
                  >
                    <v-icon
                      small
                      color="red"
                    >
                      {{ mdiClose }}
                    </v-icon>
                  </v-btn>
                </v-chip>
              </template>
              <template #item="{ item, on, attrs }">
                <v-list-item
                  v-bind="attrs"
                  v-on="on"
                >
                  <v-list-item-action>
                    <v-checkbox
                      :indeterminate-icon="mdiCheckboxBlankOutline"
                      :input-value="attrs.inputValue"
                      :off-icon="mdiCheckboxBlankOutline"
                      :on-icon="mdiCheckboxMarked"
                    />
                  </v-list-item-action>
                  <v-list-item-content>
                    <v-list-item-title>
                      {{ item }}
                    </v-list-item-title>
                  </v-list-item-content>
                </v-list-item>
              </template>
              <template #append>
                <v-btn
                  :disabled="!blocklistSelectSearch || blocklistSelect.includes(blocklistSelectSearch)"
                  icon
                  @click="blocklistSelect.push(blocklistSelectSearch); blocklistSelectSearch = ''; updateBlocklist(blocklistSelect)"
                >
                  <v-icon>{{ mdiPlus }}</v-icon>
                </v-btn>
              </template>
            </v-combobox>
          </v-list-item>
          <v-list-item
            inactive
            style="cursor:pointer;"
            class="mb-2"
            :disabled="disabledHighlightTeacher"
          >
            <v-list-item-action>
              <v-checkbox
                v-model="checkedHighlightTeacher"
                :disabled="disabledHighlightTeacher"
                :indeterminate-icon="mdiCheckboxBlankOutline"
                :off-icon="mdiCheckboxBlankOutline"
                :on-icon="mdiCheckboxMarked"
              />
            </v-list-item-action>
            <v-list-item-content @click="setHighlightTeacher()">
              <v-list-item-title>Mettre en évidence les événements qui ont un professeur associé</v-list-item-title>
              <v-list-item-subtitle>Les cours sans professeur associé seront grisés</v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>

          <v-divider />

          <v-list-item
            inactive
            :ripple="false"
            class="mb-2"
          >
            <v-list-item-content class="pt-0">
                <LazyTimezoneSelector
                    @fetch="delayedFetch"
                />
            </v-list-item-content>
          </v-list-item>

          <v-divider />

          <div>
            <v-subheader>FAQ / Aide</v-subheader>
            <lazy-help-info style="width: 98%;" />
          </div>

          <br>

          <v-divider />

          <v-subheader>{{ $config.i18n.contact }}</v-subheader>
          <v-list-item inactive>
            <div class="d-flex flex-column mb-4">
              <div>
                <v-icon
                  class="mr-2 mt-n1"
                  size="15"
                >
                  {{ mdiTwitter }}
                </v-icon>
                Twitter : <a
                  href="https://twitter.com/kernoeb"
                  target="_blank"
                >@kernoeb</a>
              </div>
              <div>
                <v-icon
                  class="mr-2 mt-n1"
                  size="15"
                >
                  {{ mdiMail }}
                </v-icon>
                Mail : <a
                  href="mailto:kernoeb@protonmail.com"
                  target="_blank"
                >kernoeb@protonmail.com</a>
              </div>
            </div>
          </v-list-item>
          <v-list-item inactive>
            <div><small><b>❤️ Donateurs :</b> Ewennn ⭐, W00dy, Rick, Lahgolz, Dyskal, Mimipepin, Atao, PandAmiral, ShockedPlot, BatLeDev, Louanne M., RidzArt, EDM115</small></div>
          </v-list-item>
        </v-list-item-group>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import { mdiPlus, mdiClose, mdiCheckboxBlankOutline, mdiCheckboxMarked, mdiCogOutline, mdiMail, mdiMenuDown, mdiTwitter, mdiArrowRightCircleOutline } from '@mdi/js'

export default {
  name: 'DialogSettings',
  props: {
    dialogSettings: {
      type: Boolean,
      default: false
    },
    settings: {
      type: Array,
      default: () => []
    },
    selectedPlanningsIds: {
      type: Array,
      default: () => []
    }
  },
  data () {
    return {
      // Icons
      mdiMail,
      mdiTwitter,
      mdiCogOutline,
      mdiMenuDown,
      mdiCheckboxBlankOutline,
      mdiCheckboxMarked,
      mdiClose,
      mdiArrowRightCircleOutline,
      mdiPlus,

      blocklist: ['Maths', 'Communication', 'Férié'], // Oui, bon...
      blocklistSelect: [],
      blocklistSelectSearch: '',

      localeUtils: {},

      colorTP: '#bbe0ff',
      colorTD: '#d4fbcc',
      colorAmphi: '#efd6d8',
      colorOthers: '#eddd6e',

      fullDark: false,
      mergeDuplicates: true,
      highlightTeacher: false
    }
  },
  computed: {
    checkedTheme: {
      get () {
        return !this.$vuetify.theme.dark
      },
      set () {
        this.$vuetify.theme.dark = !this.$vuetify.theme.dark
      }
    },
    checkedFullDark: {
      get () {
        return this.fullDark
      },
      set () {
        this.forceFullMode()
      }
    },
    checkedMergeDuplicates: {
      get () {
        return this.mergeDuplicates
      },
      set () {
        this.switchMergeDuplicates()
      }
    },
    checkedHighlightTeacher: {
      get () {
        return this.highlightTeacher
      },
      set () {
        this.setHighlightTeacher()
      }
    },
    disabledHighlightTeacher () {
      if (this.selectedPlanningsIds && this.selectedPlanningsIds.length) {
        return !this.selectedPlanningsIds.every(id => id.startsWith('iutdenantes.info.') || id.startsWith('iutdevannes.butdutinfo.')) // special case for iutdenantes.info and iutdevannes.butdutinfo
      }
      return true
    }
  },
  created () {
    try {
      this.fullDark = this.$cookies.get('fullDark', { parseJSON: false }) === 'true' || false
    } catch (err) {
      this.fullDark = false
    }

    try {
      this.mergeDuplicates = this.$cookies.get('mergeDuplicates', { parseJSON: false }) !== 'false'
    } catch (err) {
      this.mergeDuplicates = true
    }
  },
  mounted () {
    if (this.$cookies.get('blocklist') !== undefined) {
      try {
        const tmp = JSON.parse(this.$cookies.get('blocklist', { parseJSON: false }))
        if (tmp.length) {
          this.blocklistSelect = tmp
        } else {
          this.$cookies.remove('blocklist')
        }
      } catch (e) {
        this.$cookies.remove('blocklist')
      }
    }

    try {
      const c = this.$cookies.get('customColorList')
      if (c.amphi) this.colorAmphi = c.amphi
      if (c.td) this.colorTD = c.td
      if (c.tp) this.colorTP = c.tp
      if (c.other) this.colorOthers = c.other
    } catch (err) {}

    if (this.$cookies.get('locale-utils') !== undefined) {
      try {
        const tmp = this.$cookies.get('locale-utils', { parseJSON: true })
        if (tmp && Object.keys(tmp).length > 0 && tmp.oldTZ && tmp.newTZ) {
          this.localeUtils = tmp
        } else {
          this.$cookies.remove('locale-utils')
        }
      } catch (e) {
        this.$cookies.remove('locale-utils')
      }
    }

    try {
      const highlightTeacher = this.$cookies.get('highlightTeacher', { parseJSON: true })
      if (typeof highlightTeacher === 'boolean') this.highlightTeacher = highlightTeacher
      else this.highlightTeacher = false
    } catch (err) {
      this.highlightTeacher = false
    }
  },
  methods: {
    forceFullMode () {
      this.fullDark = !this.fullDark
      this.$cookies.set('fullDark', this.fullDark, { maxAge: 2147483646 })
      try {
        if (document && document.querySelector('body')) {
          const body = document.querySelector('body')
          if (body.className.includes('fullDark')) body.className = body.className.replace('fullDark', '').trim()
          else body.className = (body.className + ' fullDark').trim()
        }
      } catch (err) {}
    },
    switchMergeDuplicates () {
      this.mergeDuplicates = !this.mergeDuplicates
      this.$cookies.set('mergeDuplicates', this.mergeDuplicates, { maxAge: 2147483646 })
      this.delayedFetch()
    },
    setHighlightTeacher () {
      this.highlightTeacher = !this.highlightTeacher
      this.$cookies.set('highlightTeacher', this.highlightTeacher, { maxAge: 2147483646 })
      this.delayedFetch()
    },
    reset () {
      this.$cookies.remove('customColorList')
      this.colorTP = '#bbe0ff'
      this.colorTD = '#d4fbcc'
      this.colorAmphi = '#efd6d8'
      this.colorOthers = '#eddd6e'
      this.delayedFetch()
    },
    delayedFetch () {
      this.$nextTick(() => {
        this.$emit('fetch')
      })
    },
    updateBlocklist (event) {
      try {
        this.$cookies.set('blocklist', JSON.stringify(event), { maxAge: 2147483646 })
        this.delayedFetch()
      } catch (err) {
      }
    },
    updateLocaleUtils (event) {
      try {
        this.$cookies.set('locale-utils', JSON.stringify(event), { maxAge: 2147483646 })
        if ((event.oldTZ && event.newTZ) || (!event.oldTZ && !event.newTZ)) this.delayedFetch()
      } catch (err) {
      }
    },
    setColor (type, color) {
      try {
        const tmpCookie = this.$cookies.get('customColorList') || {}
        tmpCookie[type] = color
        this.$cookies.set('customColorList', tmpCookie, { maxAge: 2147483646 })
      } catch (err) {
        this.$cookies.set('customColorList', { [type]: color }, { maxAge: 2147483646 })
      }
      this.delayedFetch()
    }
  }
}
</script>

<style>
.hover_reset:hover {
  filter: brightness(120%);
}

.ban-word .v-input__append-inner:hover {
  cursor:pointer;
}

.custom_swatch-light .vue-swatches__container {
  box-shadow: 0 2px 3px rgba(10, 10, 10, 0.2), 0 0 0 1px rgba(10, 10, 10, 0.2)!important;
}
.custom_swatch-dark .vue-swatches__container {
  box-shadow: 0 2px 3px rgba(199, 198, 198, 0.2), 0 0 0 1px rgba(222, 218, 218, 0.2)!important;
}
</style>
