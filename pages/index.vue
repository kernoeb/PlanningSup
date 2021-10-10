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
        <v-tooltip bottom>
          <template #activator="{ on, attrs }">
            <transition name="fade" mode="out-in">
              <div v-if="selectedPlanningsTitles && selectedPlanningsTitles.length === 1" key="one_planning" style="font-size: 10px" class="text-truncate">
                {{ selectedPlanningsTitles[0].title }}
              </div>
              <div
                v-else-if="selectedPlanningsTitles && selectedPlanningsTitles.length > 1"
                key="multiple_plannings"
                style="font-size: 10px; cursor: pointer;"
                class="text-truncate"
                v-bind="attrs"
                v-on="on"
              >
                {{ selectedPlanningsTitles.length + ' ' + $config.i18n.selectedPlannings }}
              </div>
              <div v-else key="no_current_planning" style="font-size: 10px" class="text-truncate">
                ...
              </div>
            </transition>
          </template>
          <div v-for="(p, i) in (selectedPlanningsTitles || []).filter(v => v && v.title)" :key="`selectedPlanning_${i}`" style="font-size: 12px;">
            {{ p.title }}
          </div>
        </v-tooltip>
      </div>
      <crous v-if="selectedPlanningsTitles.some(v => (v.title || '').toUpperCase().includes('VANNES'))" />
    </div>
    <transition name="fade">
      <error-alert v-if="status !== 'on' && status !== 'reset'" :timestamp="timestamp" :status="status" />
    </transition>
    <bottom :selected-event="selectedEvent" :bottom="bottom" @change="bottom = $event" @close="bottom = false" />
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
            <v-toolbar
              class="toolbar_edt"
              flat
            >
              <v-card-title class="headline">
                <v-icon class="mr-3">
                  {{ mdiCalendar }}
                </v-icon>
                <div>
                  <div style="font-size: 15px; height: 20px;">
                    {{ $config.i18n.chooseEdt }}
                  </div>
                  <div style="font-size: 10px;">
                    {{ (selectedPlannings && selectedPlannings.length) || 0 }} sélectionnés
                  </div>
                </div>
              </v-card-title>
              <v-spacer />
              <v-btn
                icon
                @click="dialogEdt = false"
              >
                <v-icon>{{ mdiClose }}</v-icon>
              </v-btn>
            </v-toolbar>

            <v-divider />

            <v-text-field
              v-model.trim="searchCalendar"
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
            <v-tooltip v-if="selectedPlannings && selectedPlannings.length" right color="blue">
              <template #activator="{ on, attrs }">
                <v-btn text small color="blue" v-bind="attrs" v-on="on">
                  {{ $config.i18n.selection }}
                </v-btn>
              </template>
              <div v-if="selectedPlannings">
                <div v-for="(p, i) in (selectedPlanningsTitles || []).filter(v => v && v.title)" :key="`selectedPlanning_${i}`">
                  {{ p.title }}
                </div>
              </div>
            </v-tooltip>
            <select-planning v-if="selectedPlannings" :search-calendar="searchCalendar" :selected-plannings="selectedPlannings" @selected-plannings="selectedPlannings = $event" />
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
        <settings
          :blocklist-select="blocklistSelect"
          :dialog-settings="dialogSettings"
          :settings="settings"
          @fetch="$fetch()"
          @change_dialog="dialogSettings = $event"
          @change_settings="settings = $event"
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
import { mdiMinusBox, mdiTwitter, mdiClose, mdiMail, mdiChevronLeft, mdiChevronDown, mdiFormatListBulleted, mdiCalendar, mdiCalendarToday, mdiCogOutline, mdiChevronRight, mdiSchool, mdiWifiOff, mdiMenuDown, mdiCheckboxBlankOutline, mdiCheckboxMarked } from '@mdi/js'
import Bottom from '@/components/Bottom'
import ErrorAlert from '@/components/ErrorAlert'

export default {
  components: {
    Crous: () => import('@/components/Crous'),
    Settings: () => import('@/components/Settings'),
    Bottom,
    ErrorAlert,
    SelectPlanning: () => import('@/components/SelectPlanning')
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
      mdiMinusBox,

      bottom: false,
      selectedEvent: null,
      loading: true,
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
      mounted: false,
      start: true,
      currentWeek: '',
      lastTimeFetch: 0,
      nowY: '-10px',
      width: 0,
      doublePress: false,
      playing: false,
      searchCalendar: '',
      selectedPlannings: null,
      selectedPlanningsTitles: [],
      firstOK: false
    }
  },
  fetchOnServer: false,
  async fetch () {
    this.loading = true
    const apiCalendar = this.$config.apiCalendar
    try {
      // Deprecated / Planning v1 migration
      if (this.$route.query && this.$route.query.u && this.$route.query.s && this.$route.query.y && this.$route.query.g) {
        try {
          await this.$router.replace({
            name: 'index',
            query: { p: Buffer.from(JSON.stringify([`${this.$route.query.u}.${this.$route.query.s}.${this.$route.query.y}.${this.$route.query.g}`]), 'binary').toString('base64') }
          })
        } catch (err) {
        }
      } else if (this.$cookies.get('edt')) {
        try {
          const edt = JSON.parse(Buffer.from(decodeURIComponent(this.$cookies.get('edt')), 'base64').toString())
          if (edt.u && edt.s && edt.y && edt.g) {
            await this.$router.replace({
              name: 'index',
              query: { p: Buffer.from(JSON.stringify([`${edt.u}.${edt.s}.${edt.y}.${edt.g}`]), 'binary').toString('base64') }
            })
            this.$cookies.remove('edt')
          }
        } catch (err) {
        }
      }

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
    titleCss () {
      return this.$vuetify.breakpoint.lgAndDown ? 'ml-4 mr-4 mb-3' : 'ma-4'
    }
  },
  watch: {
    selectedPlannings: {
      handler (newVal, oldVal) {
        if (this.selectedPlannings && this.firstOK && (JSON.stringify(newVal) !== JSON.stringify(oldVal))) {
          this.$router.push({
            name: 'index',
            query: { p: this.selectedPlannings.length ? Buffer.from(JSON.stringify(this.selectedPlannings), 'binary').toString('base64') : 'reset' }
          })
        }
        this.firstOK = true
      }
    },
    '$route.query': '$fetch',
    '$vuetify.theme.dark' () {
      this.$cookies.set('theme', this.$vuetify.theme.dark ? 'true' : 'false', { maxAge: 2147483646 })
    }
  },
  created () {
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
    reset () {
      this.$cookies.remove('plannings')
      this.selectedPlannings = []
      this.events = []
      this.searchCalendar = ''
    },
    setEvents (events) {
      this.status = events.status
      this.events = [].concat.apply([], (events.plannings || []).map(v => v.events).filter(v => v))
      this.selectedPlannings = (events.plannings || []).map(v => v.id)
      this.selectedPlanningsTitles = (events.plannings || []).map(v => ({ id: v.id, title: v.title }))
      if (events.timestamp) {
        this.timestamp = events.timestamp
        if (window) { window.last_timestamp = this.timestamp }
      }
      this.start = false
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
    showEvent ({ nativeEvent, event }) {
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
</style>
