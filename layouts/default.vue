<template>
  <v-app>
    <v-system-bar
      height="30"
    >
      <transition name="fade">
        <div v-if="!connected" style="position: absolute; left: 50%;">
          <div style="color: grey; position: relative; left: -50%; font-size: 10px">
            {{ $config.i18n.offline }}
          </div>
        </div>
      </transition>
      <v-icon small>
        {{ mdiCalendar }}
      </v-icon>
      {{ $config.name }}
      <v-spacer />
      <v-icon small>
        {{ mdiSchool }}
      </v-icon>
      <span>{{ time }}</span>
    </v-system-bar>
    <v-main>
      <v-container fluid>
        <nuxt keep-alive />
      </v-container>
    </v-main>
    <v-footer
      absolute
      app
    >
      <span>Noéwen (<a
        :style="$vuetify.theme.dark ? 'color: white' : 'color: black'"
        href="https://twitter.com/kernoeb"
      >@kernoeb</a>) | {{ new Date().getFullYear() }}</span>
      <v-spacer />
      <v-tooltip top>
        <template #activator="{ on, attrs }">
          <a
            v-bind="attrs"
            href="https://twitter.com/kernoeb"
            rel="noopener noreferrer"
            style="display: block; margin-top: 8px;"
            target="_blank"
            v-on="on"
          >
            <v-icon class="mr-3 mt-n3">{{ mdiTwitter }}</v-icon>
          </a>
        </template>
        <span>Twitter</span>
      </v-tooltip>
      <v-tooltip top>
        <template #activator="{ on, attrs }">
          <a
            v-bind="attrs"
            href="https://github.com/kernoeb/planningiut"
            rel="noopener noreferrer"
            style="display: block; margin-top: 8px;"
            target="_blank"
            v-on="on"
          >
            <v-icon class="mt-n3">{{ mdiGithub }}</v-icon>
          </a>
        </template>
        <span>{{ $config.i18n.projectPage }}</span>
      </v-tooltip>
    </v-footer>
  </v-app>
</template>

<script>
import { mdiCalendar, mdiSchool, mdiApps, mdiGithub, mdiTwitter } from '@mdi/js'

export default {
  data () {
    return {
      mdiGithub,
      mdiCalendar,
      mdiSchool,
      mdiApps,
      mdiTwitter,

      connected: true,
      mounted: false,
      time: '',
      timer: 0,
      drawer: false,
      title: 'Planning IUT'
    }
  },
  head () {
    return {
      meta: [
        {
          name: 'theme-color',
          content: this.$vuetify.theme.dark ? '#121212' : '#FFFFFF'
        },
        {
          name: 'apple-mobile-web-app-status-bar-style',
          content: this.$vuetify.theme.dark ? '#121212' : '#FFFFFF'
        }
      ]
    }
  },
  mounted () {
    this.mounted = true

    if (!navigator.onLine) {
      this.connected = false
    }
    window.addEventListener('offline', this.setConnectedOn)
    window.addEventListener('online', this.setConnectedOff)
  },
  created () {
    this.time = this.getTime()
    this.timer = setInterval(() => {
      this.time = this.getTime()
    }, 1000)
  },
  beforeDestroy () {
    clearInterval(this.timer)

    window.removeEventListener('offline', this.setConnectedOn)
    window.removeEventListener('online', this.setConnectedOff)
  },
  methods: {
    getTime () {
      const tmp = new Date()
      return (tmp.getHours() < 10 ? '0' : '') + tmp.getHours() + ':' + (tmp.getMinutes() < 10 ? '0' : '') + tmp.getMinutes() + ':' + (tmp.getSeconds() < 10 ? '0' : '') + tmp.getSeconds()
    },
    setConnectedOn () {
      this.connected = true
    },
    setConnectedOff () {
      this.connected = false
    }
  }
}
</script>

<style>
.fade-enter-active, .fade-leave-active {
  transition: opacity 1s;
}

.fade-enter, .fade-leave-to {
  opacity: 0;
}

html {
  overflow-y: auto
}
</style>
