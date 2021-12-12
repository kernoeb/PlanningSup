<template>
  <v-expansion-panels accordion focusable>
    <v-expansion-panel>
      <v-expansion-panel-header>Le planning n'est pas à l'heure ! :(</v-expansion-panel-header>
      <v-expansion-panel-content>
        <small>Ce n'est probablement pas la faute du planning <i>(toujours la faute des autres)</i>, mais plutôt du navigateur ou de l'ordinateur&nbsp;(<code>{{ new Date().toLocaleString() }}</code>)</small>
      </v-expansion-panel-content>
    </v-expansion-panel>
    <v-expansion-panel>
      <v-expansion-panel-header>Je veux rajouter mon planning.</v-expansion-panel-header>
      <v-expansion-panel-content>
        <small>N'hésite pas à faire une pull request sur <b>GitHub</b>, ou à me contacter, avec les informations de contact affichées ci-dessous !</small>
      </v-expansion-panel-content>
    </v-expansion-panel>
    <v-expansion-panel>
      <v-expansion-panel-header>Faire un don</v-expansion-panel-header>
      <v-expansion-panel-content>
        <div class="pl-1 pr-1 pt-3">
          PayPal :&nbsp;<a target="_blank" href="https://paypal.me/kernoeb">https://paypal.me/kernoeb</a>
        </div>
      </v-expansion-panel-content>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script>
export default {
  name: 'HelpInfo'
}
</script>

<style scoped>

</style>
