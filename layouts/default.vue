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
      <v-tooltip left>
        <template #activator="{ on, attrs }">
          <v-icon small v-bind="attrs" v-on="on">
            {{ mdiCalendar }}
          </v-icon>
        </template>
        {{ version }}
      </v-tooltip>
      {{ $config.name }} <span v-if="development" class="ml-1" style="color:orange;">Dév</span><span v-else class="ml-1">{{ version }}</span>
      <v-spacer />
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
      <span>Noéwen (<a :style="$vuetify.theme.dark ? 'color: white' : 'color: black'" href="https://twitter.com/kernoeb">@kernoeb</a>) | {{ new Date().getFullYear() }}</span>
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
            href="https://github.com/kernoeb/planningsup"
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
import { mdiCalendar, mdiApps, mdiGithub, mdiTwitter } from '@mdi/js'
const { version } = require('../package.json')

export default {
  data () {
    return {
      mdiGithub,
      mdiCalendar,
      mdiApps,
      mdiTwitter,

      connected: true,
      mounted: false,
      time: '',
      timer: 0,
      drawer: false,
      title: 'PlanningSup'
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
  computed: {
    version () {
      return version || ''
    },
    development () {
      return process.env.NODE_ENV !== 'production'
    }
  },
  mounted () {
    this.mounted = true

    this.$watch('$vuetify.theme.dark', () => {
      if (document && document.querySelector('body')) document.querySelector('body').className = this.$vuetify.theme.dark ? '' : 'global_light'
    }, { immediate: true })

    if (!navigator.onLine) {
      this.connected = false
    }
    window.addEventListener('offline', this.setConnectedOff)
    window.addEventListener('online', this.setConnectedOn)
  },
  created () {
    this.time = this.getTime()
    this.timer = setInterval(() => {
      this.time = this.getTime()
    }, 1000)
  },
  beforeDestroy () {
    clearInterval(this.timer)

    window.removeEventListener('offline', this.setConnectedOff)
    window.removeEventListener('online', this.setConnectedOn)
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

/** Scrollbar **/
::-webkit-scrollbar-thumb {
  background: #4b4b4b;
}
::-webkit-scrollbar-thumb:hover {
  background: #666666;
}
::-webkit-scrollbar-track {
  background: #1E1E1E;
  box-shadow: inset 0 0 0 0 #F0F0F0;
}
body {
  background-color: #1E1E1E!important;
}
body.global_light::-webkit-scrollbar-thumb, body.global_light .v-dialog::-webkit-scrollbar-thumb {
  background: #BDBDBD;
}
body.global_light::-webkit-scrollbar-thumb:hover, body.global_light .v-dialog::-webkit-scrollbar-thumb:hover {
  background: #cecece;
}
body.global_light::-webkit-scrollbar-track, body.global_light .v-dialog::-webkit-scrollbar-track {
  background: #fff;
  box-shadow: inset 0 0 0 0 #F0F0F0;
}
body.global_light {
  background-color: #fff!important;
}
::-webkit-scrollbar {
  width: 7px;
}
::-webkit-scrollbar-thumb {
  border-radius: 30px;
}
::-webkit-scrollbar-track {
  border-radius: 30px;
}
</style>
