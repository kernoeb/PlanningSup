<template>
  <div v-show="mounted">
    <div style="width: 150px" class="ma-4 title_month">
      <span v-if="$refs.calendar">{{ $refs.calendar.title }}</span>
      <span v-else-if="$vuetify.breakpoint.mobile">{{ $moment().format('MMMM') }}</span>
      <span v-else>{{ $moment().format('MMMM YYYY') }}</span>
    </div>
    <v-progress-linear
      color="yellow darken-2"
      :active="loading"
      :indeterminate="loading"
    />
    <v-sheet
      class="d-flex"
      height="54"
      tile
    >
      <v-btn
        class="ma-2"
        icon
        @click="$refs.calendar.prev()"
      >
        <v-icon>mdi-chevron-left</v-icon>
      </v-btn>
      <v-select
        v-model="type"
        :items="types"
        class="ma-2"
        dense
        hide-details
        label="type"
        outlined
        style="width: 100px"
      />
      <v-spacer />
      <v-icon
        class="ma-2"
        @click="$vuetify.theme.dark ? $vuetify.theme.dark = false : $vuetify.theme.dark = true"
      >
        mdi-theme-light-dark
      </v-icon>
      <v-dialog
        v-model="dialog"
        width="500"
      >
        <template v-slot:activator="{ on, attrs }">
          <v-icon
            class="ma-2"
            v-bind="attrs"
            v-on="on"
          >
            mdi-format-list-bulleted
          </v-icon>
        </template>
        <v-card>
          <v-card-title class="headline">
            <v-icon class="mr-2">
              mdi-calendar
            </v-icon>
            Choisir un emploi du temps
          </v-card-title>

          <v-divider />

          <v-expansion-panels>
            <v-expansion-panel
              v-for="(url,i) in urls"
              :key="`urls_${i}`"
            >
              <v-expansion-panel-header>
                {{ url.title }}
              </v-expansion-panel-header>
              <v-expansion-panel-content>
                <v-expansion-panels>
                  <v-expansion-panel
                    v-for="(url2,j) in url.univ_edts"
                    :key="`urls_2_${j}`"
                  >
                    <v-expansion-panel-header>
                      {{ url2.title }}
                    </v-expansion-panel-header>
                    <v-expansion-panel-content>
                      <nuxt-link v-for="(url3, k) in url2.edts" :key="`urls_3_${k}`" :to="{name: 'index', query: {u: url.univ, n: url2.name, t: url3.name}}">
                        <v-list-item class="ml-3" @click="dialog = false">
                          <v-list-item-content>
                            <v-list-item-title>
                              {{ url3.title }}
                            </v-list-item-title>
                          </v-list-item-content>
                        </v-list-item>
                      </nuxt-link>
                    </v-expansion-panel-content>
                  </v-expansion-panel>
                </v-expansion-panels>
              </v-expansion-panel-content>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-card>
      </v-dialog>
      <v-icon
        class="ma-2"
        @click="setToday"
      >
        mdi-calendar-today
      </v-icon>
      <v-btn
        class="ma-2"
        icon
        @click="$refs.calendar.next()"
      >
        <v-icon>mdi-chevron-right</v-icon>
      </v-btn>
    </v-sheet>
    <v-sheet v-if="events.length" height="700">
      <v-calendar
        ref="calendar"
        v-model="value"
        :event-overlap-threshold="30"
        :events="events"
        :type="type"
        :weekdays="weekday"
        event-overlap-mode="stack"
        first-time="07:00"
        locale="fr"
        show-month-on-first
        show-week
      >
        <template v-slot:event="{event}">
          <div :style="{'background-color':event.color,color:'white'}" class="fill-height pl-2">
            <div><strong>{{ event.name }}</strong></div>
            <div>{{ event.location ? event.location + ' | ' : '' }}{{ cleanDescription(event.description) }}</div>
            <div>{{ $moment(event.start).format('H:mm') }} - {{ $moment(event.end).format('H:mm') }}</div>
          </div>
        </template>
      </v-calendar>
    </v-sheet>
  </div>
</template>

<script>
import ical from 'cal-parser'
import urls from '../static/url.json'

export default {
  async fetch () {
    this.loading = true
    let tmpUrl = urls[0].univ_edts[0].edts[0].url
    if (this.$route.query && this.$route.query.u && this.$route.query.n && this.$route.query.t) {
      const univ = urls.filter(u => u.univ === this.$route.query.u)
      const univ2 = univ[0].univ_edts.filter(u => u.name === this.$route.query.n)
      tmpUrl = univ2[0].edts.filter(u => u.name === this.$route.query.t)[0].url
    }
    const data = await this.$http.$get('https://cors-anywhere-kernoeb.herokuapp.com/' + tmpUrl, {
      headers: {
        Origin: 'https://ent.univ-ubs.fr'
      }
    })
    const ics = ical.parseString(data)

    const events = []
    for (const i of ics.events) {
      events.push({
        name: i.summary.value,
        start: new Date(i.dtstart.value).getTime(),
        end: new Date(i.dtend.value).getTime(),
        color: this.getColor(i.summary.value, i.location.value),
        timed: true,
        location: i.location.value,
        description: i.description.value
      })
    }
    this.events = events
    this.loading = false
  },
  data: () => ({
    loading: true,
    urls,
    dialog: false,
    type: 'week',
    types: [{
      text: 'Mois',
      value: 'month'
    }, {
      text: 'Semaine',
      value: 'week'
    }, {
      text: 'Jour',
      value: 'day'
    }],
    weekday: [1, 2, 3, 4, 5, 6, 0],
    value: '',
    events: [],
    mounted: false
  }),
  watch: {
    '$route.query': '$fetch',
    '$vuetify.theme.dark' () {
      document.cookie = 'theme=' + this.$vuetify.theme.dark
    }
  },
  beforeDestroy () {
    if (typeof window === 'undefined') { return }

    window.removeEventListener('resize', this.onResize, { passive: true })
  },
  mounted () {
    this.mounted = true
    this.$vuetify.theme.dark = JSON.parse(document.cookie.split('theme=')[1])
    this.onResize()

    window.addEventListener('resize', this.onResize, { passive: true })
  },
  /* activated () {
    // Call fetch again if last fetch more than 30 sec ago
    if (this.$fetchState.timestamp <= Date.now() - 5000) {
      this.$fetch()
    }
  }, */
  methods: {
    setToday () {
      this.value = ''
    },
    onResize () {
      if (window.innerWidth < 600) {
        this.type = 'day'
      } else {
        this.type = 'week'
      }
    },
    getColor (n, l) {
      if (n.includes('CM') || n.includes('Amphi') || l.includes('Amphi')) {
        return '#fe463a'
      } else if (n.includes('TD') || l.includes('V-B')) {
        return 'green'
      } else if (n.includes('TP')) {
        return 'blue'
      } else {
        return 'orange'
      }
    },
    cleanDescription (d) {
      return d.split(' (Exporté')[0].split('LP DLIS ')[1]
    }
  }
}
</script>

<style>
.v-calendar-daily__day-interval {
  border-top: #505050 1px solid!important;
}

.v-btn--fab.v-size--default {
  height: 25px!important;
  width: 25px!important;
}

.title_month:first-letter {
  text-transform: capitalize
}

.theme--dark.v-calendar-daily {
  border-top: none!important;
  border-left: none!important;
  border-bottom: none!important;
}

.v-calendar-daily__day-container .v-calendar-daily__day:last-child {
  border-right: none!important;
}

.v-calendar-daily__scroll-area {
  overflow: hidden!important;
}
</style>
