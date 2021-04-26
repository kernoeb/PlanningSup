<template>
  <v-dialog
    v-model="dialog"
    :fullscreen="$vuetify.breakpoint.smAndDown"
    :hide-overlay="$vuetify.breakpoint.smAndDown"
    :width="$vuetify.breakpoint.smAndDown ? null : 500"
  >
    <template #activator="{ on, attrs }">
      <v-btn
        small
        rounded
        v-bind="attrs"
        v-on="on"
        @click="getMenus()"
      >
        <v-icon small>
          {{ mdiFoodForkDrink }}
        </v-icon>
      </v-btn>
    </template>
    <v-card v-if="menu">
      <v-toolbar :style="$vuetify.breakpoint.smAndDown ? 'position: fixed; z-index: 1500; width: 100%;' : null">
        <v-spacer />
        <v-toolbar-title>Menu crous Kercado</v-toolbar-title>
        <v-spacer />
        <v-btn
          icon
          dark
          @click="dialog = false"
        >
          <v-icon>{{ mdiClose }}</v-icon>
        </v-btn>
      </v-toolbar>

      <v-expansion-panels :style="$vuetify.breakpoint.smAndDown ? 'top: 60px;' : null">
        <v-expansion-panel
          v-for="(m,i) in menu"
          :key="`menu_${i}`"
        >
          <v-expansion-panel-header>
            {{ m.title }}
          </v-expansion-panel-header>
          <v-expansion-panel-content>
            <v-row no-gutters>
              <v-col
                v-for="(c, j) in m.content"
                :key="`menu_dej_${i}_${j}`"
                cols="12"
                sm="4"
                class="mt-2 menu_content"
                style="width: 100%; font-size: 10px;"
              >
                <div class="pa-2" v-html="c" />
                <v-divider v-if="$vuetify.breakpoint.smAndDown && j !== m.content.length - 1" class="mt-2" />
              </v-col>
            </v-row>
          </v-expansion-panel-content>
        </v-expansion-panel>
      </v-expansion-panels>
    </v-card>
    <v-progress-linear
      v-else
      indeterminate
      color="yellow"
      absolute
      top
      style="z-index: 2000"
    />
  </v-dialog>
</template>

<script>
import { mdiClose, mdiFoodForkDrink } from '@mdi/js'

export default {
  name: 'Crous',
  data () {
    return {
      mdiClose,
      mdiFoodForkDrink,
      dialog: false,
      menu: null
    }
  },
  methods: {
    getMenus () {
      try {
        this.$plausible.trackEvent('crous')
      } catch (err) {}
      this.$axios.$get(this.$config.apiCrous).then((b) => {
        this.menu = b
      }).catch(() => {
        this.menu = []
      })
    }
  }
}
</script>

<style>
.menu_content h4 {
  font-size: 15px;
}
</style>
