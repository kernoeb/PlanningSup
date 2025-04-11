<template>
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
          <v-btn
            style="text-transform: none"
            href="https://planningsup.app"
            outlined
          >
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
</template>

<script>
export default {
  name: 'DialogNewPlanning',
  data () {
    return {
      modelBadUrl: false
    }
  },
  mounted () {
    setTimeout(() => {
      if (document.domain === 'planningiut.herokuapp.com' || document.domain === 'planning.noewen.com') {
        this.modelBadUrl = true
      }
    }, 10)
  }
}
</script>

<style scoped>

</style>
