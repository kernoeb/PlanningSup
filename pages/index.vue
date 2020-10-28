<template>
  <div v-show="mounted">
    <div class="ma-4 title_month">
      <span v-if="$refs.calendar">{{ $refs.calendar.title }} {{ currentWeek ? `- ${currentWeek}` : '' }}</span>
      <span v-else-if="$vuetify.breakpoint.mobile">{{ $moment().format('MMMM') }}</span>
      <span v-else>{{ $moment().format('MMMM YYYY') }}</span>
      <div v-if="currentUniv" style="font-size: 10px">
        {{ currentUniv }}
      </div>
    </div>
    <v-bottom-sheet v-model="bottom">
      <v-sheet
        class="text-center"
        height="200px"
      >
        <div v-if="selectedEvent" class="py-3">
          <div class="mt-4">
            <strong>{{ selectedEvent.name }}</strong>
          </div>
          <div v-if="selectedEvent.location || selectedEvent.description">
            {{
              selectedEvent.location
            }}{{
              (selectedEvent.location && selectedEvent.description) ? ' | ' : ''
            }}{{ selectedEvent.description }}
          </div>
          <div>{{ $moment(selectedEvent.start).format('H:mm') }} - {{ $moment(selectedEvent.end).format('H:mm') }}</div>
        </div>
        <v-btn
          class="mt-6"
          color="red"
          text
          @click="bottom = !bottom"
        >
          Fermer
        </v-btn>
      </v-sheet>
    </v-bottom-sheet>
    <v-progress-linear
      :active="loading || $fetchState.pending"
      :indeterminate="loading || $fetchState.pending"
      color="yellow darken-2"
      style="position: absolute;"
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
        label="Mode"
        outlined
        style="width: 100px"
      >
        <template v-slot:item="{ item }">
          <span style="width: 100%; float: left">
            {{ item.text }}
            <span style="color: grey; font-size: 10px">({{ item.keyboard }})</span>
          </span>
        </template>
      </v-select>
      <v-spacer />
      <v-tooltip top>
        <template v-slot:activator="{ on, attrs }">
          <v-icon
            v-bind="attrs"
            class="ma-2"
            v-on="on"
            @click="$vuetify.theme.dark ? $vuetify.theme.dark = false : $vuetify.theme.dark = true"
          >
            mdi-theme-light-dark
          </v-icon>
        </template>
        <span>Changer le thème</span>
      </v-tooltip>
      <v-dialog
        v-model="dialog"
        width="500"
      >
        <template v-slot:activator="{ on: dialog, attrs }">
          <v-tooltip top>
            <template v-slot:activator="{ on: tooltip }">
              <v-icon
                v-bind="attrs"
                class="ma-2"
                v-on="{...dialog, ...tooltip}"
              >
                mdi-format-list-bulleted
              </v-icon>
            </template>
            <span style="margin-right: 2px">Changer d'EDT</span><span style="color: lightgrey; font-size: 10px">(u)</span>
          </v-tooltip>
        </template>
        <v-card>
          <v-card-title class="headline">
            <v-icon class="mr-2">
              mdi-calendar
            </v-icon>
            <span style="font-size: 15px">Choisir un emploi du temps</span>
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
                      <nuxt-link
                        v-for="(url3, k) in url2.edts"
                        :key="`urls_3_${k}`"
                        :to="{name: 'index', query: {u: url.univ, n: url2.id, t: url3.id}}"
                      >
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
      <v-tooltip top>
        <template v-slot:activator="{ on, attrs }">
          <v-icon
            v-bind="attrs"
            class="ma-2"
            v-on="on"
            @click="setToday"
          >
            mdi-calendar-today
          </v-icon>
        </template>
        <span style="margin-right: 2px">Aujourd'hui</span><span style="color: lightgrey; font-size: 10px">(t)</span>
      </v-tooltip>
      <v-btn
        class="ma-2"
        icon
        @click="$refs.calendar.next()"
      >
        <v-icon>mdi-chevron-right</v-icon>
      </v-btn>
    </v-sheet>
    <v-sheet height="700">
      <div v-if="$fetchState.error || !events.length" style="text-align: center">
        <span><br><v-icon class="mr-2 mb-1">mdi-wifi-off</v-icon>
          Bon y a eu un soucis.<br>Revient plus tard bg.</span>
      </div>
      <v-calendar
        v-show="events.length"
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
        @click:event="showEvent"
      >
        <template v-slot:day-body="{ date, week }">
          <div
            :class="{ first: date === week[0].date }"
            :style="{ top: nowY }"
            class="v-current-time"
          />
        </template>
        <template v-slot:event="{event}">
          <div :style="{'background-color':event.color,color:'white'}" class="fill-height pl-2">
            <div><strong>{{ event.name }}</strong></div>
            <div v-if="event.location || event.description">
              {{ event.location }}{{
                (event.location && event.description) ? ' | ' : ''
              }}{{ event.description }}
            </div>
            <div>{{ $moment(event.start).format('H:mm') }} - {{ $moment(event.end).format('H:mm') }}</div>
          </div>
        </template>
      </v-calendar>
    </v-sheet>
  </div>
</template>

<script>
import urls from '../static/url.json'

export default {
  middleware: 'vuetify-theme',
  async fetch () {
    this.loading = true
    try {
      if (this.$route.query && this.$route.query.u && this.$route.query.n && this.$route.query.t) {
        this.events = await this.$axios.$get('/api/getCalendar', {
          params: {
            u: this.$route.query.u,
            n: this.$route.query.n,
            t: this.$route.query.t
          }
        })
        this.setUnivTitle(this.$route.query.u, this.$route.query.n, this.$route.query.t)
        this.loading = false
        this.$cookies.set('edt', Buffer.from(JSON.stringify({
          u: this.$route.query.u,
          n: this.$route.query.n,
          t: this.$route.query.t
        }), 'binary').toString('base64'))
      } else if (this.$cookies.get('edt') !== undefined) {
        try {
          const tmp = JSON.parse(Buffer.from(this.$cookies.get('edt'), 'base64').toString('binary'))
          this.events = await this.$axios.$get('/api/getCalendar', {
            params: {
              u: tmp.u,
              n: tmp.n,
              t: tmp.t
            }
          })
          this.setUnivTitle(tmp.u, tmp.n, tmp.t)
          this.loading = false
        } catch (e) {
          this.$cookies.remove('edt')
          this.events = await this.$axios.$get('/api/getCalendar')
          this.setUnivTitle()
          this.loading = false
        }
      } else {
        this.events = await this.$axios.$get('/api/getCalendar')
        this.setUnivTitle()
        this.loading = false
      }
    } catch (e) {
      try {
        this.events = await this.$axios.$get('/api/getCalendar')
        this.setUnivTitle()
        this.loading = false
      } catch (e) {
        this.loading = false
      }
    }
  },
  data: () => ({
    bottom: false,
    selectedEvent: null,
    loading: true,
    urls,
    dialog: false,
    type: 'week',
    types: [{
      text: 'Mois',
      keyboard: 'M',
      value: 'month'
    }, {
      text: 'Semaine',
      keyboard: 'S/W',
      value: 'week'
    }, {
      text: 'Jour',
      keyboard: 'J/D',
      value: 'day'
    }],
    weekday: [1, 2, 3, 4, 5, 6, 0],
    value: '',
    events: [],
    mounted: false,
    currentWeek: '',
    lastTimeFetch: 0,
    currentUniv: '',
    nowY: '-10px'
  }),
  watch: {
    '$route.query': '$fetch',
    '$vuetify.theme.dark' () {
      this.$cookies.set('theme', this.$vuetify.theme.dark ? 'true' : 'false')
    }
  },
  beforeDestroy () {
    if (typeof window === 'undefined') {
      return
    }

    window.removeEventListener('resize', this.onResize, { passive: true })
  },
  mounted () {
    this.mounted = true

    try {
      this.$vuetify.theme.dark = JSON.parse(this.$cookies.get('theme'))
    } catch (e) {
      this.$vuetify.theme.dark = true
    }

    try {
      const start = this.$moment(this.$refs.calendar.start).week().toString()
      const end = this.$moment(this.$refs.calendar.end).week().toString()
      this.currentWeek = start === end ? `Semaine ${start}` : `Semaines ${start} - ${end}`
    } catch (e) {
    }

    try {
      this.$refs.calendar.$on('change', (p) => {
        try {
          const start = this.$moment(p.start.date).week().toString()
          const end = this.$moment(p.end.date).week().toString()
          this.currentWeek = start === end ? `Semaine ${start}` : `Semaines ${start} - ${end}`
        } catch (e) {
        }
      })
    } catch (e) {
    }

    this.onResize()
    window.addEventListener('resize', this.onResize, { passive: true })

    setTimeout(() => {
      this.skipWeekend()
    }, 0)

    window.addEventListener('keyup', this.keyboard)

    this.updateTime()
    setTimeout(() => {
      window.onfocus = () => {
        this.updateTime()
        if (!this.loading && (new Date().getTime() - this.lastTimeFetch) > 40000) {
          this.lastTimeFetch = new Date().getTime()
          this.$fetch()
        }
      }
    }, 40000)

    setInterval(() => {
      this.$fetch()
      this.updateTime()
    }, 120000)
  },
  methods: {
    setUnivTitle (reqU, reqN, reqT) {
      try {
        if (reqU && reqN && reqT) {
          const univ = urls.find(u => u.univ === reqU)
          const univ2 = univ.univ_edts.find(u => u.id === reqN)
          const univ3 = univ2.edts.find(u => u.id === reqT)
          this.currentUniv = univ.title + ' > ' + univ2.title + ' ' + univ3.title
        } else {
          this.currentUniv = 'IUT de Vannes > Licence Pro DLIS'
        }
      } catch (e) {}
    },
    updateTime () {
      const tmp = new Date()
      this.nowY = this.$refs.calendar ? this.$refs.calendar.timeToY((tmp.getHours() < 10 ? '0' : '') + tmp.getHours() + ':' + (tmp.getMinutes() < 10 ? '0' : '') + tmp.getMinutes()) + 'px' : '-10px'
    },
    skipWeekend () {
      try {
        if (this.type !== 'month') {
          if (this.type === 'week') {
            if ([0, 6].includes(new Date().getDay())) {
              this.$refs.calendar.move()
            }
          } else if (this.type === 'day') {
            if (new Date().getDay() === 6) {
              this.$refs.calendar.move(2)
            } else if (new Date().getDay() === 0) {
              this.$refs.calendar.move(1)
            }
          }
        }
      } catch (err) {
      }
    },
    showEvent ({ nativeEvent, event }) {
      this.bottom = true
      this.selectedEvent = event
      nativeEvent.stopPropagation()
    },
    setToday () {
      this.value = ''
    },
    keyboard (event) {
      if (event.defaultPrevented) {
        return
      }

      const key = event.key || event.keyCode

      if (key === 'ArrowLeft' || key === 37) {
        this.$refs.calendar.prev()
      } else if (key === 'ArrowRight' || key === 39) {
        this.$refs.calendar.next()
      } else if (key === 'd' || key === 68 || key === 'j' || key === 74) {
        this.type = 'day'
      } else if (key === 'w' || key === 87 || key === 's' || key === 83) {
        this.type = 'week'
      } else if (key === 'm' || key === 77) {
        this.type = 'month'
      } else if (key === 'u' || key === 85) {
        this.dialog = !this.dialog
      } else if (key === 't' || key === 84) {
        this.value = ''
      }
    },
    onResize () {
      if (window.innerWidth < 600) {
        this.type = 'day'
      } else {
        this.type = 'week'
      }
    }
  }
}
</script>

<style>
.v-calendar-daily__day-interval {
  border-top: #505050 1px solid !important;
}

.v-btn--fab.v-size--default {
  height: 25px !important;
  width: 25px !important;
}

.title_month:first-letter {
  text-transform: capitalize
}

.theme--dark.v-calendar-daily {
  border-top: none !important;
  border-left: none !important;
  border-bottom: none !important;
}

.v-calendar-daily .v-calendar-daily__day:nth-child(6) {
  border-right: none !important;
}

.v-calendar-daily__day-container .v-calendar-daily__day:nth-child(8) {
  display: none !important;
}

.v-calendar-daily__day-container .v-calendar-daily__day:nth-child(7) {
  display: none !important;
}

.v-calendar-daily__head .v-calendar-daily_head-day:nth-child(7) {
  display: none !important;
}

.v-calendar-daily__head .v-calendar-daily_head-day:nth-child(8) {
  display: none !important;
}

.v-calendar-daily__scroll-area {
  overflow: hidden !important;
}

.v-current-time {
  height: 2px;
  background-color: rgba(210, 78, 78, 0.8);
  position: absolute;
  left: -1px;
  right: 0;
  pointer-events: none;
}
</style>
