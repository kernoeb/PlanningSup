<template>
  <div v-if="mounted">
    <div class="title_month" :class="titleCss" style="transition: margin 500ms">
      <span v-if="$refs.calendar">{{ $refs.calendar.title }} {{ currentWeek ? `- ${currentWeek}` : '' }}</span>
      <span v-else>{{ $moment().format('MMMM YYYY') }}</span>
      <div v-if="currentUniv" style="font-size: 10px">
        {{ currentUniv }}
      </div>
    </div>
    <transition name="fade">
      <v-alert
        v-if="status !== 'on'"
        dense
        outlined
        type="error"
      >
        <span v-if="timestamp">{{ $config.i18n.error_db }}{{ $moment(timestamp).format('dddd DD MMM à HH:mm') }}.</span>
        <span v-else>{{ $config.i18n.error_db2 }}</span>
      </v-alert>
    </transition>
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
          text
          @click="bottom = !bottom"
        >
          <span style="color: red">{{ $config.i18n.close }}</span>
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
        <template #item="{ item }">
          <span style="width: 100%; float: left">
            {{ item.text }}
            <span style="color: grey; font-size: 10px">({{ item.keyboard }})</span>
          </span>
        </template>
      </v-select>
      <v-spacer />
      <v-dialog
        v-if="urls.length"
        v-model="dialogEdt"
        width="500"
      >
        <template #activator="{ on: d, attrs }">
          <v-tooltip top>
            <template #activator="{ on: tooltip }">
              <v-icon
                v-bind="attrs"
                class="ma-2"
                v-on="{...d, ...tooltip}"
              >
                mdi-format-list-bulleted
              </v-icon>
            </template>
            <span style="margin-right: 2px">{{ $config.i18n.changeEdt }}</span><span
              style="color: lightgrey; font-size: 10px"
            >(u)</span>
          </v-tooltip>
        </template>
        <v-card>
          <v-card-title class="headline">
            <v-icon class="mr-2">
              mdi-calendar
            </v-icon>
            <span style="font-size: 15px">{{ $config.i18n.chooseEdt }}</span>
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
                        <v-list-item class="ml-3" @click="dialogEdt = false">
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
        <template #activator="{ on, attrs }">
          <v-icon
            v-bind="attrs"
            class="ma-2"
            v-on="on"
            @click="setToday"
          >
            mdi-calendar-today
          </v-icon>
        </template>
        <span style="margin-right: 2px">{{ $config.i18n.today }}</span><span style="color: lightgrey; font-size: 10px">(t)</span>
      </v-tooltip>
      <v-dialog
        v-model="dialogSettings"
        width="500"
      >
        <template #activator="{ on: d, attrs }">
          <v-tooltip top>
            <template #activator="{ on: tooltip }">
              <v-icon
                v-bind="attrs"
                class="ma-2"
                v-on="{...d, ...tooltip}"
              >
                mdi-cog-outline
              </v-icon>
            </template>
            <span style="margin-right: 2px">{{ $config.i18n.settings }}</span><span
              style="color: lightgrey; font-size: 10px"
            >(p)</span>
          </v-tooltip>
        </template>
        <v-card>
          <v-card-title class="headline">
            <v-icon class="mr-2">
              mdi-cog-outline
            </v-icon>
            <span style="font-size: 15px">{{ $config.i18n.settings }}</span>
          </v-card-title>

          <v-divider />

          <v-list-item-group
            v-model="settings"
            multiple
          >
            <v-subheader>{{ $config.i18n.ui }}</v-subheader>
            <v-list-item>
              <v-list-item-action>
                <v-checkbox v-model="checkedTheme" />
              </v-list-item-action>

              <v-list-item-content @click="$vuetify.theme.dark = !$vuetify.theme.dark">
                <v-list-item-title>{{ $config.i18n.lightThemeMsg }}</v-list-item-title>
                <v-list-item-subtitle>{{ $config.i18n.lightThemeDesc }}</v-list-item-subtitle>
              </v-list-item-content>
            </v-list-item>
            <v-list-item>
              <v-list-item-action>
                <v-checkbox v-model="colorMode" />
              </v-list-item-action>

              <v-list-item-content @click="colorMode = !colorMode">
                <v-list-item-title>{{ $config.i18n.colorMode }}</v-list-item-title>
                <v-list-item-subtitle>{{ $config.i18n.colorModeDesc }}</v-list-item-subtitle>
              </v-list-item-content>
            </v-list-item>
            <v-divider />
            <v-subheader>{{ $config.i18n.blocklist }}</v-subheader>
            <v-list-item inactive>
              <v-combobox
                v-model="blocklistSelect"
                :items="blocklist"
                :label="$config.i18n.blocklistDesc"
                chips
                multiple
                @change="$cookies.set('blocklist', JSON.stringify(blocklistSelect), { maxAge: 2147483646 }); $fetch()"
              />
            </v-list-item>
          </v-list-item-group>
        </v-card>
      </v-dialog>
      <v-btn
        class="ma-2"
        icon
        @click="$refs.calendar.next()"
      >
        <v-icon>mdi-chevron-right</v-icon>
      </v-btn>
    </v-sheet>
    <v-sheet height="700">
      <div v-if="$fetchState.error || (!events.length && !$fetchState.pending)" style="text-align: center">
        <span><br><v-icon class="mr-2 mb-1">mdi-wifi-off</v-icon>
          {{ $config.i18n.error1 }}<br>{{ $config.i18n.error2 }}</span>
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
        @click:date="goToDay"
        @click:event="showEvent"
      >
        <template #day-body="{ date, week }">
          <div
            :class="{ first: date === week[0].date }"
            :style="{ top: nowY }"
            class="v-current-time"
          />
        </template>
        <template #event="{event}">
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
  <div v-else class="d-flex justify-center mt-3">
    <v-progress-circular
      color="primary"
      indeterminate
    />
  </div>
</template>

<script>
export default {
  middleware: 'vuetify-theme',
  data () {
    return {
      bottom: false,
      selectedEvent: null,
      loading: true,
      colorMode: true,
      urls: [],
      first: false,
      timestamp: null,
      status: 'on',
      timer: 0,
      dialogEdt: false,
      dialogSettings: false,
      settings: [],
      blocklistSelect: [],
      blocklist: ['Projets Tuteurés', 'Maths'],
      type: 'week',
      types: [{
        text: this.$config.i18n.month,
        keyboard: 'M',
        value: 'month'
      }, {
        text: this.$config.i18n.week,
        keyboard: 'S/W',
        value: 'week'
      }, {
        text: this.$config.i18n.day,
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
      nowY: '-10px',
      width: 0
    }
  },
  async fetch () {
    if (!this.first) {
      this.urls = await this.$axios.$get(this.$config.apiUrls)
    }
    this.first = true
    this.loading = true
    try {
      if (this.$route.query && this.$route.query.u && this.$route.query.n && this.$route.query.t) {
        const tmpEvents = await this.$axios.$get(this.$config.apiCalendar, {
          params: {
            u: this.$route.query.u,
            n: this.$route.query.n,
            t: this.$route.query.t
          },
          withCredentials: true
        })
        this.setEvents(tmpEvents)
        this.loading = false
        this.$cookies.set('edt', Buffer.from(JSON.stringify({
          u: this.$route.query.u,
          n: this.$route.query.n,
          t: this.$route.query.t
        }), 'binary').toString('base64'), { maxAge: 2147483646 })
      } else if (this.$cookies.get('edt') !== undefined) {
        try {
          const tmp = JSON.parse(Buffer.from(this.$cookies.get('edt'), 'base64').toString('binary'))
          const tmpEvents = await this.$axios.$get(this.$config.apiCalendar, {
            params: {
              u: tmp.u,
              n: tmp.n,
              t: tmp.t
            },
            withCredentials: true
          })
          this.setEvents(tmpEvents)
          this.loading = false
        } catch (e) {
          this.$cookies.remove('edt')
          const tmpEvents = await this.$axios.$get(this.$config.apiCalendar, { withCredentials: true })
          this.setEvents(tmpEvents)
          this.loading = false
        }
      } else {
        const tmpEvents = await this.$axios.$get(this.$config.apiCalendar, { withCredentials: true })
        this.setEvents(tmpEvents)
        this.loading = false
      }
    } catch (e) {
      try {
        const tmpEvents = await this.$axios.$get(this.$config.apiCalendar, { withCredentials: true })
        this.setEvents(tmpEvents)
        this.loading = false
      } catch (e) {
        this.loading = false
      }
    }
  },
  computed: {
    titleCss () {
      return this.$vuetify.breakpoint.lgAndDown ? 'ml-4 mr-4 mb-3' : 'ma-4'
    },
    checkedTheme: {
      get () {
        return !this.$vuetify.theme.dark
      },
      set () {
        this.$vuetify.theme.dark = !this.$vuetify.theme.dark
      }
    }
  },
  watch: {
    '$route.query': '$fetch',
    '$vuetify.theme.dark' () {
      this.$cookies.set('theme', this.$vuetify.theme.dark ? 'true' : 'false', { maxAge: 2147483646 })
    },
    colorMode () {
      this.setColorMode()
    }
  },
  created () {
    try {
      if (this.$cookies.get('colorMode') !== undefined) {
        const tmp = this.$cookies.get('colorMode')
        if (typeof tmp === 'boolean') {
          this.colorMode = tmp
        } else {
          this.colorMode = true
        }
      } else {
        this.colorMode = true
      }
    } catch (e) {
      this.colorMode = true
    }

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
  },
  beforeDestroy () {
    if (typeof window === 'undefined') {
      return
    }

    clearInterval(this.timer)
    window.removeEventListener('keyup', this.keyboard)
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
      this.currentWeek = start === end ? `${this.$config.i18n.week} ${start}` : `${this.$config.i18n.weeks} ${start} - ${end}`
    } catch (e) {
    }

    try {
      this.$refs.calendar.$on('change', (p) => {
        try {
          const start = this.$moment(p.start.date).week().toString()
          const end = this.$moment(p.end.date).week().toString()
          this.currentWeek = start === end ? `${this.$config.i18n.week} ${start}` : `${this.$config.i18n.weeks} ${start} - ${end}`
        } catch (e) {
        }
      })
    } catch (e) {
    }

    this.onResize()
    window.addEventListener('resize', this.onResize, { passive: true })

    setTimeout(() => {
      this.skipWeekend()
      this.updateTime()
    }, 0)

    window.addEventListener('keyup', this.keyboard)

    setTimeout(() => {
      window.onfocus = () => {
        this.updateTime()
        if (!this.loading && (new Date().getTime() - this.lastTimeFetch) > 40000) {
          this.lastTimeFetch = new Date().getTime()
          this.$fetch()
        }
      }
    }, 40000)

    this.timer = setInterval(() => {
      this.$fetch()
      this.updateTime()
    }, 120000)
  },
  methods: {
    setEvents (events) {
      this.status = events.status
      this.events = events.data
      this.currentUniv = events.name
      if (events.timestamp) {
        this.timestamp = events.timestamp
      }
    },
    setColorMode () {
      this.$cookies.set('colorMode', this.colorMode, { maxAge: 2147483646 })
      this.$fetch()
    },
    goToDay (day) {
      this.type = 'day'
      this.value = this.$refs.calendar.timestampToDate(day)
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
    showEvent ({
      nativeEvent,
      event
    }) {
      this.bottom = true
      this.selectedEvent = event
      nativeEvent.stopPropagation()
    },
    setToday () {
      this.value = ''
    },
    keyboard (event) {
      if (this.dialogSettings) {
        return
      }

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
        this.dialogEdt = !this.dialogEdt
      } else if (key === 'p' || key === 80) {
        this.dialogSettings = !this.dialogSettings
      } else if (key === 't' || key === 84) {
        this.value = ''
      }
    },
    onResize () {
      if (this.width !== window.innerWidth) {
        this.width = window.innerWidth
        if (window.innerWidth < 600) {
          this.type = 'day'
        } else {
          this.type = 'week'
        }
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
