<template>
  <v-app>
    <v-system-bar
      height="30"
    >
      <v-icon>mdi-calendar</v-icon>
      Planning IUT
      <v-spacer />
      <v-icon>mdi-school</v-icon>
      <span>{{ time }}</span>
    </v-system-bar>
    <v-main>
      <v-container>
        <nuxt />
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
