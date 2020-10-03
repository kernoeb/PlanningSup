<template>
  <div v-show="mounted">
    <div style="width: 150px" class="ma-4 title_month">
      <span v-if="$refs.calendar">{{ $refs.calendar.title }}</span>
      <span v-else-if="$vuetify.breakpoint.mobile">{{ $moment().format('MMMM') }}</span>
      <span v-else>{{ $moment().format('MMMM YYYY') }}</span>
    </div>
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
        color="#fafafa"
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
    <v-sheet v-if="events.length && !$fetchState.pending" height="700">
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

export default {
  async fetch () {
    const data = await this.$axios.$get('https://planning.univ-ubs.fr/jsp/custom/modules/plannings/anonymous_cal.jsp?data=8241fc38732002141cce681f91850c4ae0fa50826f0818af4a82a8fde6ce3f14906f45af276f59ae8fac93f781e861523ad5e42393de7942e6094ed65ada68fdc2973627c2eb073b336b55dc3e3bf3a48d3f4109b6629391')
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
  },
  data: () => ({
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
    weekday: [1, 2, 3, 4, 5],
    value: '',
    events: [],
    mounted: false
  }),
  beforeDestroy () {
    if (typeof window === 'undefined') { return }

    window.removeEventListener('resize', this.onResize, { passive: true })
  },
  mounted () {
    this.mounted = true
    this.onResize()

    window.addEventListener('resize', this.onResize, { passive: true })
  },
  activated () {
    // Call fetch again if last fetch more than 30 sec ago
    if (this.$fetchState.timestamp <= Date.now() - 30000) {
      this.$fetch()
    }
  },
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
  border-right: none!important;
  border-bottom: none!important;
}

.v-calendar-daily__scroll-area {
  overflow: hidden!important;
}
</style>
