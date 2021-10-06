<template>
  <v-dialog
    :value="dialogSettings"
    width="500"
    @input="$emit('change_dialog', $event)"
  >
    <template #activator="{ on: d, attrs }">
      <v-tooltip top>
        <template #activator="{ on: tooltip }">
          <v-icon
            v-bind="attrs"
            v-on="{...d, ...tooltip}"
          >
            {{ mdiCogOutline }}
          </v-icon>
        </template>
        <span style="margin-right: 2px">{{ $config.i18n.settings }}</span><span
          style="color: lightgrey; font-size: 10px"
        >(p)</span>
      </v-tooltip>
    </template>
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

      blocklist: ['Maths', 'Communication'] // Oui, bon...
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
  }
}
</script>

<style>
.ban-word .v-input__append-inner:hover {
  cursor:pointer;
}
</style>
