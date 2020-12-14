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
      <v-icon>mdi-calendar</v-icon>
      {{ $config.name }}
      <v-spacer />
      <v-icon>mdi-school</v-icon>
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
        href="https://twitter.com/kop_of_tea"
      >@kernoeb</a>) | {{ new Date().getFullYear() }}</span>
      <v-spacer />
      <v-tooltip top>
        <template #activator="{ on, attrs }">
          <a
            v-bind="attrs"
            href="https://brave.com/ker880"
            rel="noopener noreferrer"
            style="display: block; margin-top: 8px;"
            target="_blank"
            v-on="on"
          >
            <brave-icon :style="$vuetify.theme.dark ? 'fill: whitesmoke' : 'fill: black'" class="mr-4" size="18" />
          </a>
        </template>
        <span>{{ $config.i18n.braveReferral }}</span>
      </v-tooltip>
      <v-tooltip top>
        <template #activator="{ on, attrs }">
          <a
            v-bind="attrs"
            href="https://paypal.me/kernoeb"
            rel="noopener noreferrer"
            style="display: block; margin-top: 8px;"
            target="_blank"
            v-on="on"
          >
            <pay-pal-icon :style="$vuetify.theme.dark ? 'fill: whitesmoke' : 'fill: black'" class="mr-4" size="18" />
          </a>
        </template>
        <span>{{ $config.i18n.donate }}</span>
      </v-tooltip>
      <v-tooltip top>
        <template #activator="{ on, attrs }">
          <a
            v-bind="attrs"
            href="https://twitter.com/kop_of_tea"
            rel="noopener noreferrer"
            style="display: block; margin-top: 8px;"
            target="_blank"
            v-on="on"
          >
            <twitter-icon :style="$vuetify.theme.dark ? 'fill: whitesmoke' : 'fill: black'" class="mr-4" size="18" />
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
            <git-hub-icon :style="$vuetify.theme.dark ? 'fill: whitesmoke' : 'fill: black'" size="18" />
          </a>
        </template>
        <span>{{ $config.i18n.projectPage }}</span>
      </v-tooltip>
    </v-footer>
  </v-app>
</template>

<script>
import { BraveIcon, GitHubIcon, PayPalIcon, TwitterIcon } from 'vue-simple-icons'

export default {
  components: {
    TwitterIcon,
    PayPalIcon,
    BraveIcon,
    GitHubIcon
  },
  data () {
    return {
      connected: true,
      mounted: false,
      time: '',
      timer: 0,
      drawer: false,
      items: [
        {
          icon: 'mdi-apps',
          title: 'Welcome',
          to: '/'
        }
      ],
      title: 'Planning IUT'
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
</style>
