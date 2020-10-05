<template>
  <v-app>
    <v-system-bar
      height="30"
    >
      <transition name="fade">
        <div v-if="!connected" style="position: absolute; left: 50%;">
          <div style="color: grey; position: relative; left: -50%; font-size: 10px">
            Hors connexion
          </div>
        </div>
      </transition>
      <v-icon>mdi-calendar</v-icon>
      Planning IUT
      <v-spacer />
      <v-icon>mdi-school</v-icon>
      <span>{{ time }}</span>
    </v-system-bar>
    <v-main>
      <v-container>
        <nuxt keep-alive />
      </v-container>
    </v-main>
    <v-footer
      :absolute="!fixed"
      app
    >
      <span><a href="https://twitter.com/kop_of_tea">@kernoeb</a> | {{ new Date().getFullYear() }}</span>
    </v-footer>
  </v-app>
</template>

<script>
export default {
  data () {
    return {
      connected: true,
      mounted: false,
      time: '',
      drawer: false,
      fixed: false,
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

    window.addEventListener('offline', () => {
      this.connected = false
    })

    window.addEventListener('online', () => {
      this.connected = true
    })
  },
  created () {
    this.time = this.getTime()
    setInterval(() => {
      this.time = this.getTime()
    }, 1000)
  },
  methods: {
    getTime () {
      const tmp = new Date()
      return (tmp.getHours() < 10 ? '0' : '') + tmp.getHours() + ':' + (tmp.getMinutes() < 10 ? '0' : '') + tmp.getMinutes() + ':' + (tmp.getSeconds() < 10 ? '0' : '') + tmp.getSeconds()
    }
  }
}
</script>

<style>
.fade-enter-active, .fade-leave-active {
  transition: opacity 1s;
}
.fade-enter, .fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
  opacity: 0;
}
</style>
