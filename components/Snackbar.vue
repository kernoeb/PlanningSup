<script>
export default {
  name: 'Snackbar',
  data () {
    return {
      snackbar: false,
      storageKey: 'show-snackbar-2024'
    }
  },
  mounted () {
    if (window.location.hostname !== 'planningsup.app' && window.location.hostname !== 'localhost') {
      console.log('Snackbar disabled because we are not on planningsup.app', window.location.hostname)
      return
    }

    // Remove old show-snackbar from localStorage to show the snackbar again
    try {
      localStorage.removeItem('show-snackbar')
    } catch (err) {}

    // Remove keys starting with /show-snackbar-
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key.startsWith('show-snackbar-') && key !== this.storageKey) {
          console.log('Remove old show-snackbar key', key)
          localStorage.removeItem(key)
        }
      }
    } catch (err) {}

    if (localStorage.getItem(this.storageKey) == null || localStorage.getItem(this.storageKey) === 'true') {
      this.snackbar = true
    }
  },
  methods: {
    open () {
      this.snackbar = false
      localStorage.setItem(this.storageKey, 'false')

      window.open('https://paypal.me/kernoeb', '_blank')

      try {
        console.log('Track donation-click')
        this.$plausible.trackEvent('donation-click')
      } catch (err) {}
    },
    close () {
      this.snackbar = false
      localStorage.setItem(this.storageKey, 'false')

      try {
        console.log('Track donation-close')
        this.$plausible.trackEvent('donation-close')
      } catch (err) {}
    }
  }
}
</script>

<template>
  <v-snackbar
    v-model="snackbar"
    vertical
    max-width="280"
    app
    timeout="-1"
  >
    <div class="mb-1">
      <b style="font-size: 15px;">Hello !</b>
    </div>
    <div class="mb-1">
      PlanningSup est un projet open-source, gratuit et <b>sans publicité</b>. Si vous souhaitez soutenir le projet, vous pouvez faire un don via PayPal :)
    </div>
    <v-btn
      color="#00457C"
      rounded
      small
      style="margin-left: 0!important;"
      @click="open()"
    >
      <icons-paypal
        class="mr-1"
        style="width: 15px; height: 15px; fill: currentColor;"
      />paypal.me/kernoeb
    </v-btn>
    <template #action="{ attrs }">
      <v-btn
        color="red"
        text
        v-bind="attrs"
        @click="close()"
      >
        Bonsoir non
      </v-btn>
    </template>
  </v-snackbar>
</template>

<style scoped>

</style>
