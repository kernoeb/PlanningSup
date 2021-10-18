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
      width="500"
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
          :class="$vuetify.theme.dark ? 'custom_swatch-dark' : 'custom_swatch-light'"
          @change="$emit('change_settings', $event)"
        >
          <v-subheader>{{ $config.i18n.ui }}</v-subheader>
          <v-list-item>
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
          <v-divider />
          <v-subheader>{{ $config.i18n.blocklist }}</v-subheader>
          <v-list-item inactive>
            <v-combobox
              :value="blocklistSelect"
              :append-icon="mdiMenuDown"
              :items="blocklist"
              :label="$config.i18n.blocklistDesc"
              chips
              multiple
              class="ban-word"
              @change="$emit('change_blocklist_select', $event);"
            >
              <template #item="{ item, on, attrs }">
                <v-list-item v-bind="attrs" v-on="on">
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
            </v-combobox>
          </v-list-item>
          <v-subheader>{{ $config.i18n.contact }}</v-subheader>
          <v-list-item inactive>
            <div class="d-flex flex-column mb-4">
              <div>
                <v-icon class="mr-2 mt-n1" size="15">
                  {{ mdiTwitter }}
                </v-icon>
                Twitter : <a href="https://twitter.com/kernoeb" target="_blank">@kernoeb</a>
              </div>
              <div>
                <v-icon class="mr-2 mt-n1" size="15">
                  {{ mdiMail }}
                </v-icon>
                Mail : <a href="mailto:kernoeb@protonmail.com" target="_blank">kernoeb@protonmail.com</a>
              </div>
            </div>
          </v-list-item>
          <v-list-item inactive>
            <div><small><b>Donateurs :</b> W00dy, Rick 🙏</small></div>
          </v-list-item>
        </v-list-item-group>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import { mdiClose, mdiCheckboxBlankOutline, mdiCheckboxMarked, mdiCogOutline, mdiMail, mdiMenuDown, mdiTwitter } from '@mdi/js'

export default {
  name: 'Settings',
  props: {
    dialogSettings: {
      type: Boolean,
      default: false
    },
    settings: {
      type: Array,
      default: () => []
    },
    blocklistSelect: {
      type: Array,
      default: () => {}
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

      blocklist: ['Maths', 'Communication'], // Oui, bon...

      colorTP: 'blue',
      colorTD: 'green',
      colorAmphi: '#fe463a',
      colorOthers: 'orange'
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
    }
  },
  mounted () {
    try {
      const c = this.$cookies.get('customColors')
      if (c.amphi) this.colorAmphi = c.amphi
      if (c.td) this.colorTD = c.td
      if (c.tp) this.colorTP = c.tp
      if (c.other) this.colorOthers = c.other
    } catch (err) {}
  },
  methods: {
    setColor (type, color) {
      try {
        const tmpCookie = this.$cookies.get('customColors') || {}
        tmpCookie[type] = color
        this.$cookies.set('customColors', tmpCookie, { maxAge: 2147483646 })
      } catch (err) {
        this.$cookies.set('customColors', { [type]: color }, { maxAge: 2147483646 })
      }
      this.$nextTick(() => {
        this.$emit('fetch')
      })
    }
  }
}
</script>

<style>
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
