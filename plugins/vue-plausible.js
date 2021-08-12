import Vue from 'vue'
import { VuePlausible } from 'vue-plausible'

const PLAUSIBLE_URL = 'plausible.noewen.com'

Vue.use(VuePlausible, {
  apiHost: 'https://' + PLAUSIBLE_URL
})

Vue.$plausible.enableAutoPageviews()
