<template>
  <div>
    <v-btn
      small
      rounded
      @click="dialog = true; getMenus()"
    >
      <v-icon small>
        {{ mdiFoodForkDrink }}
      </v-icon>
    </v-btn>
    <v-dialog
      v-model="dialog"
      :fullscreen="$vuetify.breakpoint.smAndDown"
      :hide-overlay="$vuetify.breakpoint.smAndDown"
      :width="$vuetify.breakpoint.smAndDown ? null : 500"
    >
      <v-card
        min-height="544"
        height="100%"
      >
        <v-toolbar :style="$vuetify.breakpoint.smAndDown ? 'position: fixed; z-index: 1500; width: 100%;' : null">
          <v-progress-linear
            v-if="menu === null"
            indeterminate
            color="yellow"
            absolute
            top
          />
          <v-spacer />
          <v-toolbar-title>Menu crous Kercado</v-toolbar-title>
          <v-spacer />
          <v-btn
            icon
            @click="dialog = false"
          >
            <v-icon>{{ mdiClose }}</v-icon>
          </v-btn>
        </v-toolbar>

        <v-expansion-panels :style="$vuetify.breakpoint.smAndDown ? 'top: 60px;' : null">
          <v-expansion-panel
            v-for="(m,i) in (menu || [])"
            :key="`menu_${i}`"
          >
            <v-expansion-panel-header :class="isToday(new Date(m.date)) ? 'font-weight-bold green lighten-1 white--text' : null">
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
                  <div
                    class="pa-2"
                    v-html="c"
                  />
                  <v-divider
                    v-if="$vuetify.breakpoint.smAndDown && j !== m.content.length - 1"
                    class="mt-2"
                  />
                </v-col>
              </v-row>
            </v-expansion-panel-content>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import { mdiClose, mdiFoodForkDrink } from '@mdi/js'

export default {
  name: 'DialogCrous',
  data () {
    return {
      // Icons
      mdiClose,
      mdiFoodForkDrink,

      dialog: false,
      menu: null
    }
  },
  methods: {
    isToday (someDate) {
      const today = new Date()
      return someDate.getDate() === today.getDate() &&
        someDate.getMonth() === today.getMonth() &&
        someDate.getFullYear() === today.getFullYear()
    },
    getMenus () {
      this.$axios.$get('/api/v1/crous_menu').then((b) => {
        this.menu = b
        try {
          this.$plausible.trackEvent('crous')
        } catch (err) {}
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
