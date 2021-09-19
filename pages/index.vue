<template>
  <div v-if="mounted">
    <div class="d-flex justify-space-between">
      <div :class="titleCss" style="transition: margin 500ms" class="text-truncate">
        <transition name="fade" mode="out-in">
          <div v-if="$refs.calendar" key="date" class="title_month text-truncate">
            {{ $refs.calendar.title }} {{ currentWeek ? `- ${currentWeek}` : '' }}
          </div>
          <div v-else key="nodate" class="title_month text-truncate">
            ...
          </div>
        </transition>
        <transition name="fade" mode="out-in">
          <div v-if="currentUniv" :key="currentUniv" style="font-size: 10px" class="text-truncate">
            {{ currentUniv }}
          </div>
          <div v-else key="nocurrentuniv" style="font-size: 10px" class="text-truncate">
            ...
          </div>
        </transition>
      </div>
      <crous v-if="currentUniv.includes('Vannes')" />
    </div>
    <transition name="fade">
      <v-alert
        v-if="status !== 'on'"
        dense
        outlined
        type="error"
      >
        <div v-if="status === 'semi'">
          <span>{{ $config.i18n.error_db_one }}</span>
        </div>
        <div v-else>
          <span v-if="timestamp">{{ $config.i18n.error_db }}{{ $moment(timestamp).format('dddd DD MMM à HH:mm') }}.</span>
          <span v-else>{{ $config.i18n.error_db2 }}</span>
        </div>
      </v-alert>
    </transition>
    <v-bottom-sheet v-model="bottom">
      <v-sheet
        class="text-center"
        height="200px"
      >
        <div v-if="selectedEvent" class="py-3">
          <div class="mt-4 font-weight-bold">
            {{ selectedEvent.name }}
          </div>
          <div v-if="selectedEvent.location || selectedEvent.description">
            {{ selectedEvent.location }}{{ (selectedEvent.location && selectedEvent.description) ? ' | ' : '' }}{{ selectedEvent.description }}
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
      :style="$vuetify.theme.dark ? 'background-color: #121212' : null"
      class="d-flex"
      height="54"
      tile
    >
      <v-btn
        class="ma-2"
        icon
        @click="$refs.calendar.prev()"
      >
        <v-icon>{{ mdiChevronLeft }}</v-icon>
      </v-btn>
      <v-select
        v-model="type"
        :items="types"
        class="ma-2"
        dense
        hide-details
        :label="$config.i18n.mode"
        outlined
        style="width: 100px"
      >
        <template #item="{ item }">
          <span style="width: 100%; float: left">
            {{ item.text }}
            <span style="color: grey; font-size: 10px">({{ item.keyboard }})</span>
          </span>
        </template>
        <template #append>
          <v-icon>
            {{ mdiMenuDown }}
          </v-icon>
        </template>
      </v-select>
      <v-spacer />
      <div class="d-flex justify-space-between" style="max-height: 24px; align-self: center; width: 125px;">
        <v-dialog
          v-model="dialogEdt"
          width="500"
        >
          <template #activator="{ on: d, attrs }">
            <v-tooltip top>
              <template #activator="{ on: tooltip }">
                <v-icon
                  v-bind="attrs"
                  v-on="{...d, ...tooltip}"
                >
                  {{ mdiFormatListBulleted }}
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
                {{ mdiCalendar }}
              </v-icon>
              <span style="font-size: 15px">{{ $config.i18n.chooseEdt }} ({{ selectedPlannings.length }} sélectionnés)</span>
            </v-card-title>

            <v-divider />

            <v-text-field
              v-model="searchCalendar"
              :label="$config.i18n.searchPlanning"
              filled
              clearable
              :clear-icon="mdiClose"
              hide-details
              dense
            />
            <v-btn text small color="green" @click="reset">
              {{ $config.i18n.reset }}
            </v-btn>
            <v-tooltip right color="blue">
              <template #activator="{ on, attrs }">
                <v-btn text small color="blue" v-bind="attrs" v-on="on">
                  {{ $config.i18n.selection }}
                </v-btn>
              </template>
              <div>
                <div v-for="(p, i) in selectedPlannings" :key="`selectedPlanning_${i}`">
                  {{ (titles.find(i => i.id === p) || {}).title }}
                </div>
              </div>
            </v-tooltip>
            <select-planning :urls="urls" />
          </v-card>
        </v-dialog>
        <v-tooltip top>
          <template #activator="{ on, attrs }">
            <v-icon
              v-bind="attrs"
              v-on="on"
              @click="setToday"
            >
              {{ mdiCalendarToday }}
            </v-icon>
          </template>
          <span style="margin-right: 2px">{{ $config.i18n.today }}</span><span style="color: lightgrey; font-size: 10px">(t)</span>
        </v-tooltip>
        <Settings
          :blocklist-select="blocklistSelect"
          :dialog-settings="dialogSettings"
          :settings="settings"
          :color-mode="colorMode"
          @change_dialog="dialogSettings = $event"
          @change_settings="settings = $event"
          @change_color_mode="colorMode = $event"
          @change_blocklist_select="blocklistSelect = $event; $cookies.set('blocklist', JSON.stringify($event), { maxAge: 2147483646 }); $fetch()"
        />
      </div>
      <v-btn
        class="ma-2"
        icon
        @click="$refs.calendar.next()"
      >
        <v-icon>{{ mdiChevronRight }}</v-icon>
      </v-btn>
    </v-sheet>
    <v-sheet height="710" :style="$vuetify.theme.dark ? 'background-color: #121212' : null">
      <div v-if="$fetchState.error" style="text-align: center">
        <span><br><v-icon class="mr-2 mb-1">{{ mdiWifiOff }}</v-icon>
          {{ $config.i18n.error1 }}<br>{{ $config.i18n.error2 }}</span>
      </div>
      <transition name="fade">
        <v-calendar
          v-show="!start"
          ref="calendar"
          v-model="value"
          v-touch="{
            left: () => $refs.calendar.next(),
            right: () => $refs.calendar.prev()
          }"
          color="primary"
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
            <div :style="{'background-color':event.color,color:'white'}" class="fill-height pl-2 roboto-font">
              <div class="text-truncate font-weight-bold">
                {{ event.name }}
              </div>
              <div v-if="event.location || event.description">
                {{ !event.distance ? event.location : '' }}{{ ((event.location && !event.distance) && event.description) ? ' | ' : '' }}{{ event.description }}
              </div>
              <div>{{ $moment(event.start).format('H:mm') }} - {{ $moment(event.end).format('H:mm') }}</div>
              <small v-if="event.distance">
                <i>{{ $config.i18n.distance }}</i>
              </small>
            </div>
          </template>
        </v-calendar>
      </transition>
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
import { mdiTwitter, mdiClose, mdiMail, mdiChevronLeft, mdiChevronDown, mdiFormatListBulleted, mdiCalendar, mdiCalendarToday, mdiCogOutline, mdiChevronRight, mdiSchool, mdiWifiOff, mdiMenuDown, mdiCheckboxBlankOutline, mdiCheckboxMarked } from '@mdi/js'
import { mapState, mapMutations } from 'vuex'
import Crous from '@/components/Crous'
import SelectPlanning from '@/components/SelectPlanning'
import Settings from '@/components/Settings'

export default {
  components: {
    Crous,
    SelectPlanning,
    Settings
  },
  middleware: 'vuetify-theme',
  data () {
    return {
      // Icons
      mdiMail,
      mdiTwitter,
      mdiChevronLeft,
      mdiChevronDown,
      mdiChevronRight,
      mdiFormatListBulleted,
      mdiCalendar,
      mdiCalendarToday,
      mdiCogOutline,
      mdiSchool,
      mdiWifiOff,
      mdiMenuDown,
      mdiCheckboxBlankOutline,
      mdiCheckboxMarked,
      mdiClose,

      bottom: false,
      selectedEvent: null,
      loading: true,
      colorMode: true,
      urls: [],
      timestamp: null,
      status: 'on',
      timer: 0,
      dialogEdt: false,
      dialogSettings: false,
      settings: [],
      blocklistSelect: [],
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
      titles: [],
      mounted: false,
      start: true,
      currentWeek: '',
      lastTimeFetch: 0,
      currentUniv: '',
      nowY: '-10px',
      width: 0,
      doublePress: false,
      playing: false,
      searchCalendar: ''
    }
  },
  fetchOnServer: false,
  async fetch () {
    this.loading = true
    const apiCalendar = '/api/calendars' || this.$config.apiCalendar
    try {
      if (this.$route.query && this.$route.query.p) {
        const tmpEvents = await this.$axios.$get(apiCalendar, { params: { p: this.$route.query.p }, withCredentials: true })
        this.setEvents(tmpEvents)
        this.loading = false
        this.$cookies.set('plannings', this.$route.query.p, { maxAge: 2147483646 })
      } else if (this.$cookies.get('plannings') !== undefined) {
        try {
          const tmpEvents = await this.$axios.$get(apiCalendar, { withCredentials: true })
          this.setEvents(tmpEvents)
          this.loading = false
        } catch (e) {
          this.$cookies.remove('plannings')
          const tmpEvents = await this.$axios.$get(apiCalendar, { withCredentials: true })
          this.setEvents(tmpEvents)
          this.loading = false
        }
      } else {
        const tmpEvents = await this.$axios.$get(apiCalendar, { withCredentials: true })
        this.setEvents(tmpEvents)
        this.loading = false
      }
    } catch (e) {
      try {
        const tmpEvents = await this.$axios.$get(apiCalendar, { withCredentials: true })
        this.setEvents(tmpEvents)
        this.loading = false
      } catch (e) {
        this.loading = false
      }
    }
  },
  computed: {
    ...mapState(['selectedPlannings']),
    titleCss () {
      return this.$vuetify.breakpoint.lgAndDown ? 'ml-4 mr-4 mb-3' : 'ma-4'
    }
  },
  watch: {
    searchCalendar () {
      this.$axios.$get(this.$config.apiUrls, { params: { q: this.searchCalendar } }).then((data) => {
        this.urls = data
      }).catch(() => {})
    },
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

    this.$nextTick(function () {
      try {
        const start = this.$moment(this.$refs.calendar.start).week().toString()
        const end = this.$moment(this.$refs.calendar.end).week().toString()
        this.currentWeek = start === end ? `${this.$config.i18n.week} ${start}` : `${this.$config.i18n.weeks} ${start} - ${end}`
      } catch (e) {
      }

      this.$refs.calendar.$on('change', (p) => {
        try {
          const start = this.$moment(p.start.date).week().toString()
          const end = this.$moment(p.end.date).week().toString()
          this.currentWeek = start === end ? `${this.$config.i18n.week} ${start}` : `${this.$config.i18n.weeks} ${start} - ${end}`
        } catch (e) {
          this.currentWeek = ''
        }
      })
    })

    this.onResize()
    window.addEventListener('resize', this.onResize, { passive: true })

    setTimeout(() => {
      this.skipWeekend()
      this.updateTime()

      this.$axios.$get(this.$config.apiUrls).then((data) => {
        this.urls = data
      }).catch(() => {})
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
    ...mapMutations(['setPlannings']),
    reset () {
      this.$cookies.remove('plannings')
      this.setPlannings([])
      this.$nextTick(() => {
        this.$router.push({ name: 'index', query: { p: undefined } })
      })
    },
    setEvents (events) {
      this.status = events.status
      this.events = [].concat.apply([], (events.plannings || []).map(v => v.events).filter(v => v))
      this.titles = (events.plannings || []).map(v => ({ id: v.id, title: v.title }))
      this.setPlannings((events.plannings || []).map(v => v.id).filter(v => v))
      this.currentUniv = events.plannings?.length > 1 ? (events.plannings.length + ' ' + this.$config.i18n.selectedPlannings) : events.plannings[0].title
      if (events.timestamp) {
        this.timestamp = events.timestamp
        if (window) { window.last_timestamp = this.timestamp }
      }
      this.start = false
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
      if (this.dialogSettings || this.dialogEdt) {
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
      } else if ((key === 'r' || key === 82) && !this.playing) {
        // Just a security check
        if (this.doublePress) {
          this.doublePress = false
          const arr = ['Never gonna give you up', 'Never gonna let you down']
          let tmp = true
          const audio = new Audio('/sound/security.mp3')
          this.playing = true
          audio.play().then(() => {}).catch(() => {})
          const s = setInterval(() => {
            this.events.forEach((v, i) => {
              v.name = i % 2 === 0 ? arr[tmp ? 0 : 1] : arr[tmp ? 1 : 0]
              v.location = 'YouTube'
              v.description = 'Rick Astley'
              v.color = tmp ? '#e28b6f' : '#c3bde7'
            })
            tmp = !tmp
          }, 531)
          setTimeout(() => {
            clearInterval(s)
            this.playing = false
            this.$fetch()
          }, 6500)
        } else {
          this.doublePress = true
          setTimeout(() => {
            this.doublePress = false
          }, 500)
        }
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
.theme--light .v-calendar-daily__day-interval {
  border-top: #c9c9c9 1px solid !important;
}

.theme--dark .v-calendar-daily__day-interval {
  border-top: #505050 1px solid !important;
}

.theme--dark.v-calendar-daily .v-calendar-daily_head-day {
  border-right: #868686 1px solid!important;
  border-bottom: #868686 1px solid!important;
}

.v-btn--fab.v-size--default {
  height: 25px !important;
  width: 25px !important;
}

.title_month {
  text-transform: capitalize;
}

.theme--dark.v-calendar-daily {
  background-color: #121212!important;
  border-top: none !important;
  border-left: none !important;
  border-bottom: none !important;
}

.v-calendar-daily .v-calendar-daily__day:nth-child(6) {
  border-right: none !important;
}

.v-calendar-daily__head .v-calendar-daily_head-day:nth-child(6) {
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

.v-event-timed-container {
  margin-left: 6px!important;
  margin-right: 6px!important;
}
</style>
