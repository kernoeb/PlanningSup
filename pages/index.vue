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
          <div class="mt-4 font-weight-bold">
            {{ selectedEvent.name }}
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
              label="Rechercher un planning"
              filled
              clearable
              :clear-icon="mdiClose"
              hide-details
              dense
            />
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
        <v-dialog
          v-model="dialogSettings"
          width="500"
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
            <v-card-title class="headline">
              <v-icon class="mr-2">
                {{ mdiCogOutline }}
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
                  <v-checkbox v-model="checkedTheme" :off-icon="mdiCheckboxBlankOutline" :on-icon="mdiCheckboxMarked" :indeterminate-icon="mdiCheckboxBlankOutline" />
                </v-list-item-action>

                <v-list-item-content @click="$vuetify.theme.dark = !$vuetify.theme.dark">
                  <v-list-item-title>{{ $config.i18n.lightThemeMsg }}</v-list-item-title>
                  <v-list-item-subtitle>{{ $config.i18n.lightThemeDesc }}</v-list-item-subtitle>
                </v-list-item-content>
              </v-list-item>
              <v-list-item>
                <v-list-item-action>
                  <v-checkbox v-model="colorMode" :off-icon="mdiCheckboxBlankOutline" :on-icon="mdiCheckboxMarked" :indeterminate-icon="mdiCheckboxBlankOutline" />
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
                  :append-icon="mdiMenuDown"
                  @change="$cookies.set('blocklist', JSON.stringify(blocklistSelect), { maxAge: 2147483646 }); $fetch()"
                >
                  <template #item="{ item, on, attrs }">
                    <v-list-item v-bind="attrs" v-on="on">
                      <v-list-item-action>
                        <v-checkbox :input-value="attrs.inputValue" :off-icon="mdiCheckboxBlankOutline" :on-icon="mdiCheckboxMarked" :indeterminate-icon="mdiCheckboxBlankOutline" />
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
                    </v-icon>Twitter : <a target="_blank" href="https://twitter.com/kernoeb">@kernoeb</a>
                  </div>
                  <div>
                    <v-icon class="mr-2 mt-n1" size="15">
                      {{ mdiMail }}
                    </v-icon>Mail : <a target="_blank" href="mailto:kernoeb@protonmail.com">kernoeb@protonmail.com</a>
                  </div>
                </div>
              </v-list-item>
              <v-list-item inactive>
                <div><small><b>Donateurs :</b> W00dy 🙏</small></div>
              </v-list-item>
            </v-list-item-group>
          </v-card>
        </v-dialog>
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
                {{ !event.distance ? event.location : '' }}{{
                  ((event.location && !event.distance) && event.description) ? ' | ' : ''
                }}{{ event.description }}
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
    <v-dialog
      v-model="modelBadUrl"
      :overlay-color="$vuetify.theme.dark ? 'white' : 'black'"
      persistent
      max-width="500"
    >
      <v-card>
        <v-card-title class="text-h5">
          Nouveau !
        </v-card-title>
        <v-card-text>
          <div style="font-size: 17px;">
            Le planning devient <b>PlanningSup</b> !
            <br>
            et change de nom de domaine :
            <br>
            <br>
            <v-btn style="text-transform: none" href="https://planningsup.app" outlined>
              PlanningSup.app
            </v-btn>
            <br><br>
            C'est clairement plus simple à retenir et ça permet à d'autres écoles de venir ici <small>(pas que des IUTs)</small> :)
            <br>
            <small>(oublie pas d'ajouter en favoris)</small>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="grey"
            text
            @click="modelBadUrl = false"
          >
            Je m'en fiche
          </v-btn>
          <v-btn
            color="green darken-1"
            text
            href="https://planningsup.app"
          >
            C'est parti !
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
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
import crous from '@/components/crous'
import SelectPlanning from '@/components/SelectPlanning'

export default {
  components: {
    crous,
    SelectPlanning
  },
  middleware: 'vuetify-theme',
  data () {
    return {
      modelBadUrl: false,

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

      if (document.domain === 'planningiut.herokuapp.com' || document.domain === 'planning.noewen.com') {
        this.modelBadUrl = true
      }
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
    setEvents (events) {
      this.status = events.status
      this.events = [].concat.apply([], events.plannings.map(v => v.events))
      this.setPlannings(events.plannings.map(v => v.id))
      this.currentUniv = events.plannings?.length > 1 ? (events.plannings.length + ' plannings sélectionnés') : events.plannings[0].title
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
