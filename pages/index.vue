<template>
  <div
    v-if="mounted"
    :class="{hideWeekends}"
  >
    <!--    <client-only>
      <lazy-snackbar />
    </client-only>-->

    <div class="d-flex justify-space-between">
      <div
        :class="titleCss"
        style="transition: margin 500ms"
        class="text-truncate"
      >
        <transition
          name="fade"
          mode="out-in"
        >
          <div
            v-if="$refs.calendar"
            key="date"
            class="title_month text-truncate"
            style="font-family: Roboto, sans-serif; font-size: 16px; font-weight: 500;"
          >
            {{ $refs.calendar.title }} {{ currentWeek ? `- ${currentWeek}` : '' }}<span
              v-if="nbHours"
              class="text--secondary text-lowercase"
              style="font-size: 12px;"
            >&nbsp;{{ nbHours }}</span>
          </div>
          <div
            v-else
            key="nodate"
            class="title_month text-truncate"
            style="font-family: Roboto, sans-serif; font-size: 16px; font-weight: 500;"
          >
            ...
          </div>
        </transition>
        <v-tooltip bottom>
          <template #activator="{ on, attrs }">
            <transition
              name="fade"
              mode="out-in"
            >
              <div
                v-if="plannings && plannings.length === 1"
                key="one_planning"
                style="font-size: 11px; font-family: Roboto, sans-serif; font-weight: 300;"
                class="text-truncate"
              >
                {{ plannings[0].title }}
              </div>
              <div
                v-else-if="plannings && plannings.length > 1"
                key="multiple_plannings"
                style="font-size: 11px; font-family: Roboto, sans-serif; font-weight: 300; cursor: pointer;"
                class="text-truncate"
                v-bind="attrs"
                v-on="on"
              >
                {{ plannings.length + ' ' + $config.i18n.selectedPlannings }}
              </div>
              <div
                v-else
                key="no_current_planning"
                style="font-size: 11px; font-family: Roboto, sans-serif; font-weight: 300;"
                class="text-truncate"
              >
                ...
              </div>
            </transition>
          </template>
          <div
            v-for="(p, i) in (plannings || []).filter(v => v && v.title)"
            :key="`selectedPlanning_${i}`"
            style="font-size: 12px;"
          >
            {{ p.title }}
          </div>
        </v-tooltip>
      </div>
    </div>
    <transition
      name="fade"
      mode="out-in"
    >
      <error-alert
        v-if="plannings != null && ((selectedPlanningsIds !== undefined && selectedPlanningsIds !== null) || (selectedPlanningsIds && selectedPlanningsIds.length !== 0)) && status !== 'ok'"
        :plannings="plannings"
        :status="status"
      />
    </transition>
    <event-bottom
      :selected-event="selectedEvent"
      :bottom="bottom"
      @change="bottom = $event"
      @close="bottom = false"
    />
    <v-progress-linear
      :active="loading || $fetchState.pending"
      :indeterminate="loading || $fetchState.pending"
      color="yellow darken-2"
      style="position: absolute;margin-left: auto;margin-right: auto;left: 0;right: 0;text-align: center; width: 95%;"
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
        style="max-width: 350px"
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
      <div
        class="d-flex justify-space-between"
        style="align-self: center; width: 125px;"
      >
        <v-tooltip top>
          <template #activator="{ on, attrs }">
            <v-btn
              id="change-planning-button"
              v-bind="attrs"
              icon
              v-on="on"
              @click="dialogEdt = true"
            >
              <v-icon>
                {{ mdiFormatListBulleted }}
              </v-icon>
            </v-btn>
          </template>
          <span style="margin-right: 2px">{{ $config.i18n.changeEdt }}</span><span
            style="color: lightgrey; font-size: 10px"
          >(u)</span>
        </v-tooltip>
        <v-dialog
          v-model="dialogEdt"
          width="500"
        >
          <lazy-select-planning
            v-if="selectedPlanningsIds"
            :dialog="dialogEdt"
            :selected-plannings="selectedPlanningsIds"
            @selected-plannings="selectedPlanningsIds = $event; $fetch();"
            @close="dialogEdt = false"
          />
        </v-dialog>
        <v-tooltip top>
          <template #activator="{ on, attrs }">
            <v-btn
              v-bind="attrs"
              icon
              v-on="on"
              @click="setToday"
            >
              <v-icon>
                {{ mdiCalendarToday }}
              </v-icon>
            </v-btn>
          </template>
          <span style="margin-right: 2px">{{ $config.i18n.today }}</span><span style="color: lightgrey; font-size: 10px">(t)</span>
        </v-tooltip>
        <lazy-dialog-settings
          :dialog-settings="dialogSettings"
          :settings="settings"
          :selected-plannings-ids="selectedPlanningsIds || []"
          @fetch="$fetch()"
          @change_dialog="dialogSettings = $event"
          @change_settings="settings = $event"
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
    <v-sheet
      height="710"
      :style="$vuetify.theme.dark ? 'background-color: #121212' : null"
    >
      <div
        v-if="$fetchState.error"
        style="text-align: center"
      >
        <span><br><v-icon class="mr-2 mb-1">{{ mdiWifiOff }}</v-icon>
          {{ $config.i18n.error1 }}<br>{{ $config.i18n.error2 }}</span>
      </div>
      <div
        v-else-if="errorMessage"
        class="title"
        style="text-align: center"
      >
        <br>
        <div v-if="errorMessage === 'unknown'">
          <span>Planning inexistant :(</span>
          <br>
          <small class="text--disabled">ou quelque chose a changé, désolé !</small>
        </div>
        <span v-else>{{ errorMessage }}</span>
        <br><br>
        <div
          id="interrogation"
          style="font-size: 80px; cursor: pointer; display: inline-block; width: 100px;"
        >
          ?
        </div>
        <br><br><v-btn @click="resetNewPlanning()">
          Sélectionner un planning
        </v-btn>
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
          @change="calendarChange"
        >
          <template #day-body="{ date, week }">
            <div
              v-if="showCurrentTime(date)"
              :class="{ first: date === week[0].date }"
              :style="{ top: nowY }"
              class="v-current-time"
            />
          </template>
          <template #event="{event}">
            <div
              v-tooltip.bottom="{content: () => getCustomEventContent(event)}"
              :class="(event.end && event.start && ((event.end - event.start) <= 3600000)) ? '' : 'justify-center'"
              :style="{'background-color':event.color,color:'white'}"
              class="event_custom fill-height ml-3 roboto-font black--text d-flex flex-column"
              style="margin-top: -2px;"
            >
              <div class="text-truncate font-weight-bold text-body-2 flex-shrink-0">
                {{ event.name }}
              </div>
              <div v-if="event.location || event.description">
                {{ !event.distance ? event.location : '' }}<b>{{ ((event.location && !event.distance) && event.description) ? ' · ' : '' }}</b>{{ event.description }}
              </div>
              <div style="font-weight: 300">
                {{ $moment(event.start).format('H:mm') }} - {{ $moment(event.end).format('H:mm') }}
              </div>
              <small v-if="event.distance">
                <i>{{ $config.i18n.distance }}</i>
              </small>
            </div>
          </template>
        </v-calendar>
      </transition>
    </v-sheet>
  </div>
  <div
    v-else
    class="d-flex justify-center mt-3"
  >
    <v-progress-circular
      color="primary"
      indeterminate
    />
  </div>
</template>

<script>
import { mdiMinusBox, mdiTwitter, mdiClose, mdiMail, mdiChevronLeft, mdiChevronDown, mdiFormatListBulleted, mdiCalendar, mdiCalendarToday, mdiCogOutline, mdiChevronRight, mdiSchool, mdiWifiOff, mdiMenuDown, mdiCheckboxBlankOutline, mdiCheckboxMarked } from '@mdi/js'
import humanizeDuration from 'humanize-duration'
const shortFrenchHumanizer = humanizeDuration.humanizer({
  language: 'shortFr',
  languages: {
    shortFr: {
      y: () => 'a',
      mo: () => 'mo',
      w: () => 's',
      d: () => 'j',
      h: () => 'h',
      m: () => 'm',
      s: () => 's',
      ms: () => 'ms'
    }
  }
})

export default {
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
      mdiMinusBox,

      plannings: null,
      selectedPlanningsIds: null,
      errorMessage: null,
      bottom: false,
      selectedEvent: null,
      loading: false,
      timestamp: null,
      status: 'on',
      timer: 0,
      dialogEdt: false,
      dialogSettings: false,
      settings: [],
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
      start: true,
      currentWeek: '',
      lastTimeFetch: 0,
      nowY: '-10px',
      dateNow: '',
      width: 0,
      doublePress: false,
      playing: false,
      skipOk: false,
      tmpP: null,
      nbHours: null,
      lastTimestamp: null,

      localeUtils: {}
    }
  },
  fetchOnServer: false,
  async fetch () {
    if (this.loading) return
    this.loading = true
    // Planning v1 migration
    this.$cookies.remove('edt')
    this.$cookies.remove('customColors')
    this.$cookies.remove('colorMode')
    if (this.$cookies.get('plannings')) {
      try {
        const oldCookie = Buffer.from(decodeURIComponent(this.$cookies.get('plannings', { parseJSON: false })), 'base64').toString()
        if (oldCookie.startsWith('[') && oldCookie.endsWith(']')) {
          const j = JSON.parse(oldCookie)
          this.$cookies.set('plannings', j.join(','), { maxAge: 2147483646 })
        }
      } catch (err) {
        console.log(err)
      }
    }

    if (this.selectedPlanningsIds == null) {
      let planningString
      try {
        planningString = this.$route?.query?.p || this.$cookies.get('plannings', { parseJSON: false }) || this.$config.defaultPlanning
      } catch (err) {
        console.log(err)
        planningString = this.$config.defaultPlanning
      }
      this.selectedPlanningsIds = planningString.split(',')
    } else if (this.selectedPlanningsIds && this.selectedPlanningsIds.length === 0) {
      this.events = []
      this.plannings = []
      this.loading = false
      return
    }

    try {
      await this.getEvents()
    } catch (e) {
      if (e?.response?.status === 404 && e?.response?.data?.includes('planning')) {
        this.errorMessage = 'unknown'
        this.resetRoute()
      } else this.errorMessage = null
      // Let's try again, just to be sure
      console.log(e)
      try {
        await this.getEvents()
      } catch (err) {
        console.log(err)
        this.loading = false
      }
    }

    this.loading = false
  },
  computed: {
    // used in watcher
    calculateNbHoursComputed () {
      return !!this.events?.length && this.skipOk && this.lastTimestamp && this.tmpP
    },
    titleCss () {
      return this.$vuetify.breakpoint.lgAndDown ? 'ml-4 mr-4 mb-3' : 'ma-4'
    },
    hideWeekends () {
      return this.$config.hideWeekends
    }
  },
  watch: {
    '$vuetify.theme.dark' () {
      this.$cookies.set('theme', this.$vuetify.theme.dark ? 'true' : 'false', { maxAge: 2147483646 })
    },
    calculateNbHoursComputed: {
      handler (n) {
        if (n) {
          try {
            this.calculateNbHours({ start: n.start.date, end: n.end.date })
          } catch (err) {
            this.nbHours = null
            console.log(err)
          }
        }
      },
      immediate: true
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

    this.$nextTick(function () {
      try {
        const start = this.$moment(this.$refs.calendar.start).week().toString()
        const end = this.$moment(this.$refs.calendar.end).week().toString()
        this.currentWeek = start === end ? `${this.$config.i18n.week} ${start}` : `${this.$config.i18n.weeks} ${start} - ${end}`
      } catch (e) {
      }

      if (this.$refs && this.$refs.calendar) {
        this.$refs.calendar.$on('change', (p) => {
          try {
            const start = this.$moment(p.start.date).week().toString()
            const end = this.$moment(p.end.date).week().toString()
            this.currentWeek = start === end ? `${this.$config.i18n.week} ${start}` : `${this.$config.i18n.weeks} ${start} - ${end}`
          } catch (e) {
            this.currentWeek = ''
          }
        })
      }
    })

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
    async getEvents () {
      const events = await this.$axios.$get('/api/v1/calendars',
        {
          params: { p: [...(this.selectedPlanningsIds || [])].join(',') },
          headers: { 'ignore-statistics': this.$route?.query?.['ignore-statistics'] !== undefined ? 'true' : 'false' }
        })
      this.setEvents(events)
      this.$cookies.set('plannings', this.selectedPlanningsIds.join(','), { maxAge: 2147483646 })
      this.errorMessage = null
    },
    calendarChange (p) {
      this.tmpP = p
    },
    calculateNbHours ({ start, end }) {
      if (!this.events || !this.events.length) {
        this.nbHours = null
        return
      }

      const startMoment = new Date(start).setHours(0, 0, 0, 0)
      const endMoment = new Date(end).setHours(23, 59, 59, 999)

      const eventsSorted = this.events
        .filter(ev => new Date(ev.start) >= startMoment && new Date(ev.end) <= endMoment)
        .sort((a, b) => new Date(a.start) - new Date(b.start))

      if (!eventsSorted.length) {
        this.nbHours = null
        return
      }

      const firstEventTime = eventsSorted[0].start
      const lastEventTime = eventsSorted[eventsSorted.length - 1].end

      // iterate over the minutes of the day and check if there is an event
      let nbMinutes = 0
      for (let i = firstEventTime; i < lastEventTime; i += 60000) {
        if (eventsSorted.some(ev => i >= ev.start && i < ev.end)) nbMinutes++ // add 1 minute if there is an event
      }

      // calculate the number of hours
      this.nbHours = shortFrenchHumanizer(nbMinutes * 60000, { round: true, units: ['h', 'm'], spacer: '', delimiter: '' })
    },
    showCurrentTime (date) {
      try {
        if (!this.$refs.calendar) {
          return false
        }
        if (this.type === 'week') return this.$moment(date).week() === this.$moment(this.$refs.calendar.start).week()
        else if (this.type === 'month') return false
        else return this.dateNow === '' || date === this.dateNow
      } catch (e) {
        // you can never be too careful
        return false
      }
    },
    uniqWith (arr, fn) {
      return arr.filter((element, index) => arr.findIndex(step => fn(element, step)) === index)
    },
    isMergeDuplicates () {
      try {
        return this.$cookies.get('mergeDuplicates', { parseJSON: false }) !== 'false'
      } catch (err) {
        return true
      }
    },
    resetNewPlanning () {
      this.$cookies.remove('plannings')
      this.selectedPlanningsIds = []
      this.$nextTick(() => {
        this.dialogEdt = true
      })
    },
    setEvents (req) {
      req = req || {}
      // Merge planning and remove duplicates events
      const tmpEvents = [].concat.apply([], (req.plannings || []).map(v => v.events).filter(v => v))
      if ((req.plannings || []).length > 1 && this.isMergeDuplicates()) {
        this.events = this.uniqWith(tmpEvents, (a, b) => a.name === b.name && a.start === b.start && a.end === b.end && a.location === b.location && a.description === b.description)
      } else {
        this.events = tmpEvents
      }

      this.status = req.status
      this.plannings = (req.plannings || []).map(v => ({ id: v.id, title: v.title, timestamp: v.timestamp, status: v.status }))

      if (req.timestamp) {
        if (window) window.last_timestamp = req.timestamp
        this.lastTimestamp = req.timestamp
      }
      this.start = false
    },
    goToDay (day) {
      this.type = 'day'
      this.value = this.$refs.calendar.timestampToDate(day)
    },
    updateTime () {
      const timezone = this.localeUtils.oldTZ || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris'

      const utcDate = new Date((new Date()).toLocaleString('en-US', { timeZone: 'UTC' })) // get the current date in UTC
      const tzDate = new Date(utcDate.toLocaleString('en-US', { timeZone: timezone })) // convert it to defined timezone
      this.dateNow = this.$moment(tzDate).format('YYYY-MM-DD')

      // format the current time in the defined timezone
      const timeString = tzDate.toLocaleString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
      })

      if (this.$refs.calendar) {
        this.nowY = this.$refs.calendar.timeToY(timeString) + 'px'
      } else {
        this.nowY = '-10px'
      }
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
      this.$nextTick(() => {
        this.skipOk = true
      })
    },
    async getCustomEventContent (e) {
      const { data } = await this.$axios.get('/api/v1/custom-event-content', { params: { name: (e.name || '').trim() } })
      return '<b>' + e.name + '</b>' + '<br>' + data
    },
    setSelectedEvent (e) {
      this.selectedEvent = { event: e }
      this.$axios.get('/api/v1/custom-event-content', { params: { name: (e.name || '').trim() } }).then((d) => {
        if (d.data?.length && this.selectedEvent) this.$set(this.selectedEvent, 'content', d.data)
      })
    },
    showEvent ({ nativeEvent, event }) {
      this.bottom = true
      this.setSelectedEvent(event)
      nativeEvent.stopPropagation()
    },
    setToday () {
      this.value = ''
    },
    keyboard (event) {
      if (this.dialogSettings || this.dialogEdt || event?.defaultPrevented) return

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
          const audio = new Audio('/sound/security.mp3')
          this.playing = true
          const su = setTimeout(() => {
            this.events.forEach((v) => {
              v.name = 'Never gonna give you up'
              v.location = 'YouTube'
              v.description = 'Rick Astley'
            })
          }, 0)
          const sd = setTimeout(() => {
            this.events.forEach((v) => {
              v.name = 'Never gonna let you down'
              v.location = 'YouTube'
              v.description = 'Rick Astley'
            })
          }, 2260)
          const sa = setTimeout(() => {
            this.events.forEach((v) => {
              v.name = 'Never gonna run around'
              v.location = 'YouTube'
              v.description = 'Rick Astley'
            })
          }, 4440)
          this.events.forEach((v) => {
            v.color = (Math.floor(Math.random() * 2)) === 0 ? '#e28b6f' : '#c3bde7'
          })
          const s = setInterval(() => {
            this.events.forEach((v) => {
              v.color = (Math.floor(Math.random() * 2)) === 0 ? '#e28b6f' : '#c3bde7'
            })
          }, 500)
          audio.play().then(() => {}).catch(() => {})
          setTimeout(() => {
            clearInterval(su)
            clearInterval(sd)
            clearInterval(sa)
            clearInterval(s)
            this.playing = false
            this.$fetch()
          }, 6000)
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
    },
    resetRoute () {
      this.$nextTick(() => {
        try {
          this.$router.replace({ name: 'index', params: { p: '' } }).then(() => {}).catch(() => {})
        } catch (err) {}
      })
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

.hideWeekends .v-calendar-daily .v-calendar-daily__day:nth-child(8) {
  border-right: none !important;
}

.hideWeekends .v-calendar-daily__head .v-calendar-daily_head-day:nth-child(8) {
  border-right: none !important;
}

.hideWeekends .v-calendar-daily .v-calendar-daily__day:nth-child(6) {
  border-right: none !important;
}

.hideWeekends .v-calendar-daily__head .v-calendar-daily_head-day:nth-child(6) {
  border-right: none !important;
}

.hideWeekends .v-calendar-daily__day-container .v-calendar-daily__day:nth-child(8) {
  display: none !important;
}

.hideWeekends .v-calendar-daily__day-container .v-calendar-daily__day:nth-child(7) {
  display: none !important;
}

.hideWeekends .v-calendar-daily__head .v-calendar-daily_head-day:nth-child(7) {
  display: none !important;
}

.hideWeekends .v-calendar-daily__head .v-calendar-daily_head-day:nth-child(8) {
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
.v-current-time.first::before {
  content: '';
  position: absolute;
  background-color: rgba(210, 78, 78, 0.8);
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-top: -5px;
  margin-left: -6.5px;
}

.v-event-timed-container {
  margin-left: 6px!important;
  margin-right: 6px!important;
}

.v-event-timed-container div.v-event-timed {
  overflow: hidden;
}

.v-expansion-panel-content__wrap {
    padding: 0 12px 16px !important;
}

.v-btn:not(.v-btn--round).v-size--small {
  margin: 5px 10px !important;
}

.selected_planning {
  font-weight: bold;
  color: #2196F3 !important;
}

.toolbar_edt .v-toolbar__content {
  padding-left: 5px!important;
}

.tooltip {
  display: block !important;
  z-index: 10000;
}

.tooltip .tooltip-inner {
  background: rgba(35, 35, 35, 0.82);
  color: white;
  font-family: "Roboto", sans-serif;
  font-size: 12px;
  border-radius: 16px;
  padding: 5px 10px 4px;
}

.tooltip .tooltip-arrow {
  width: 0;
  height: 0;
  border-style: solid;
  position: absolute;
  margin: 5px;
  border-color: rgba(35, 35, 35, 0.82);
  z-index: 1;
}

.tooltip[x-placement^="bottom"] {
  margin-top: 5px;
}

.tooltip[x-placement^="bottom"] .tooltip-arrow {
  border-width: 0 5px 5px 5px;
  border-left-color: transparent !important;
  border-right-color: transparent !important;
  border-top-color: transparent !important;
  top: -5px;
  left: calc(50% - 5px);
  margin-top: 0;
  margin-bottom: 0;
}

.tooltip[aria-hidden='true'] {
  visibility: hidden;
  opacity: 0;
  transition: opacity .15s, visibility .15s;
}

.tooltip[aria-hidden='false'] {
  visibility: visible;
  opacity: 1;
  transition: opacity .15s;
}

#interrogation {
  transition: transform 2s, opacity 1.5s;
  margin: 0 auto;
}

#interrogation:hover {
  transform: translateY(-3em);
  opacity: 0;
}
</style>
