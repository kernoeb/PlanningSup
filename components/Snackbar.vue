<script>
export default {
  name: 'Snackbar',
  data () {
    return {
      snackbar: false
    }
  },
  mounted () {
    if (localStorage.getItem('show-snackbar') == null || localStorage.getItem('show-snackbar') === 'true') {
      this.snackbar = true
    }
  },
  methods: {
    close () {
      this.snackbar = false
      localStorage.setItem('show-snackbar', 'false')

      try {
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
    app
    timeout="-1"
  >
    <b style="font-size: 15px;">Hello tout le monde !</b><br><br>Si vous souhaitez faire un petit <b>don</b> pour financer le serveur, le nom de domaine et, ou les futures fonctionnalités, c'est par ici :
    <br><br>
    <v-btn
      color="#00457C"
      rounded
      href="https://www.paypal.me/kernoeb"
      target="_blank"
      style="margin-left: 0!important;"
      @click="close()"
    >
      <icons-paypal
        class="mr-1"
        style="width: 15px; height: 15px; fill: currentColor;"
      />paypal.me/kernoeb
    </v-btn><br><br>Merci ! 🤍
    <template #action="{ attrs }">
      <v-btn
        color="red"
        text
        v-bind="attrs"
        @click="close()"
      >
        Bien tenté, mais non
      </v-btn>
    </template>
  </v-snackbar>
</template>

<style scoped>

</style>
