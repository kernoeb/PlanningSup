import colors from 'vuetify/es5/util/colors'
import fr from 'vuetify/es5/locale/fr'

const DESCRIPTION = 'Un planning universitaire moderne réalisé par @kernoeb'
const TITLE = 'PlanningSup'
const META_TITLE = `${TITLE} | Calendrier universitaire`
const DOMAIN = 'planningsup.app'
const URL = 'https://' + DOMAIN
const BANNER = `${URL}/banner.png`

export default {
  telemetry: false,
  ssr: true,
  target: 'static',
  // Global page headers (https://go.nuxtjs.dev/config-head)
  head: {
    htmlAttrs: {
      lang: 'fr'
    },
    title: TITLE,
    meta: [
      { charset: 'utf-8' },
      { hid: 'apple-mobile-web-app-title', name: 'apple-mobile-web-app-title', content: TITLE },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'description', name: 'description', content: DESCRIPTION },
      { name: 'keywords', content: 'planning,planningedt,planninguniv,edt,emploi du temps,université,calendrier,universitaire,planningiut,planningiut.fr,edtuniv,planningapp,app planning,site planning,planning sup,planning iut,dut informatique,dut,iutvannes,iut de vannes,iut vannes' },
      { name: 'author', content: 'kernoeb' },
      { name: 'language', content: 'French' },
      { name: 'robots', content: 'index,follow' },
      { name: 'category', content: 'internet' },
      { hid: 'title', name: 'title', content: META_TITLE },

      // Facebook
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: URL + '/' },
      { hid: 'og:title', property: 'og:title', content: META_TITLE },
      { hid: 'og:description', property: 'og:description', content: DESCRIPTION },
      { property: 'og:image', content: BANNER },

      // Twitter
      { property: 'twitter:card', content: 'summary_large_image' },
      { property: 'twitter:url', content: URL + '/' },
      { hid: 'twitter:title', property: 'twitter:title', content: META_TITLE },
      { hid: 'twitter:description', property: 'twitter:description', content: DESCRIPTION },
      { property: 'twitter:image', content: BANNER }
    ],
    link: [
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
    ]
  },

  // Plugins to run before rendering page (https://go.nuxtjs.dev/config-plugins)
  plugins: [
    { src: '~/plugins/v-tooltip.js', mode: 'client' }
  ],

  // Auto import components (https://go.nuxtjs.dev/config-components)
  components: true,

  // Modules for dev and build (recommended) (https://go.nuxtjs.dev/config-modules)
  buildModules: [
    // https://go.nuxtjs.dev/eslint
    '@nuxtjs/eslint-module',
    // https://go.nuxtjs.dev/vuetify
    '@nuxtjs/vuetify',
    // https://github.com/nuxt-community/moment-module
    '@nuxtjs/moment',
    ['@nuxtjs/google-fonts', {
      display: 'swap',
      families: {
        Roboto: [100, 300, 400, 500, 700, 900]
      }
    }]
  ],

  // Modules (https://go.nuxtjs.dev/config-modules)
  modules: [
    // https://www.npmjs.com/package/cookie-universal-nuxt
    'cookie-universal-nuxt',
    // https://axios.nuxtjs.org/
    '@nuxtjs/axios',
    // https://go.nuxtjs.dev/pwa
    '@nuxtjs/pwa',
    // https://www.npmjs.com/package/@nuxtjs/component-cache
    '@nuxtjs/component-cache',
    // https://saintplay.github.io/vue-swatches/
    'vue-swatches/nuxt',
    // https://github.com/Djancyp/nuxt-config#readme
    'nuxt-json-config'
  ],

  moment: {
    defaultLocale: 'fr',
    locales: ['fr']
  },

  axios: {
    proxy: true,
    baseURL: process.env.BASE_URL
  },

  publicRuntimeConfig: {
    axios: {
      browserBaseURL: process.env.BASE_URL
    }
  },

  privateRuntimeConfig: {
    axios: {
      baseURL: process.env.BASE_URL
    }
  },

  // Vuetify module configuration (https://go.nuxtjs.dev/config-vuetify)
  vuetify: {
    defaultAssets: false,
    customVariables: ['~/assets/variables.scss'],
    treeShake: true,
    theme: {
      dark: true,
      lang: {
        locales: { fr },
        current: 'fr'
      },
      themes: {
        dark: {
          primary: colors.blue.darken2,
          accent: colors.grey.darken3,
          secondary: colors.amber.darken3,
          info: colors.teal.lighten1,
          warning: colors.amber.base,
          error: colors.deepOrange.accent4,
          success: colors.green.accent3
        }
      }
    }
  }
}
