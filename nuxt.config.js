import colors from 'vuetify/es5/util/colors'
import fr from 'vuetify/es5/locale/fr'
const { NODE_ENV = 'production' } = process.env
const isDev = NODE_ENV === 'development'

export default {
  telemetry: false,
  ssr: true,
  // Global page headers (https://go.nuxtjs.dev/config-head)
  head: {
    htmlAttrs: {
      lang: 'fr'
    },
    titleTemplate: 'PlanningIUT',
    title: 'PlanningIUT',
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'description', name: 'description', content: 'Un planning universitaire sympathique réalisé par @kernoeb' }
    ],
    link: [
      { rel: 'icon', type: 'image/x-icon', href: '/icon.png' }
    ]
  },

  // Global CSS (https://go.nuxtjs.dev/config-css)
  css: [
  ],

  // Plugins to run before rendering page (https://go.nuxtjs.dev/config-plugins)
  plugins: [],

  // Auto import components (https://go.nuxtjs.dev/config-components)
  components: true,

  /*
  ** Server Middleware
  */
  serverMiddleware: [
    { path: '/api', handler: '~/server/api' },
    { path: '/server', handler: '~/server/worker' }
  ],

  // Modules for dev and build (recommended) (https://go.nuxtjs.dev/config-modules)
  buildModules: [
    // https://go.nuxtjs.dev/eslint
    '@nuxtjs/eslint-module',
    // https://go.nuxtjs.dev/vuetify
    '@nuxtjs/vuetify',
    // https://github.com/nuxt-community/moment-module
    '@nuxtjs/moment'
  ],

  // Modules (https://go.nuxtjs.dev/config-modules)
  modules: [
    'cookie-universal-nuxt',
    '@nuxtjs/axios',
    // https://go.nuxtjs.dev/pwa
    '@nuxtjs/pwa',
    '@nuxtjs/component-cache',
    'nuxt-json-config',
    // https://github.com/moritzsternemann/vue-plausible
    'vue-plausible'
  ],

  plausible: {
    apiHost: 'https://plausible.noewen.com'
  },

  pwa: {
    workbox: {
      enabled: false,
      cleanupOutdatedCaches: true,
      cacheAssets: false
    }
  },

  moment: {
    defaultLocale: 'fr',
    locales: ['fr']
  },

  axios: {
    proxy: true
  },

  // Vuetify module configuration (https://go.nuxtjs.dev/config-vuetify)
  vuetify: {
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
  },

  // Build Configuration (https://go.nuxtjs.dev/config-build)
  build: {
    extractCSS: true,

    postcss:
      {
        // disable postcss plugins in development
        plugins: isDev
          ? {}
          : {
              '@fullhuman/postcss-purgecss': {
                content: [
                  'components/**/*.vue',
                  'layouts/**/*.vue',
                  'pages/**/*.vue',
                  'plugins/**/*.js',
                  'node_modules/vuetify/src/**/*.ts'
                ],
                styleExtensions: ['.css'],
                safelist: {
                  standard: [
                    'body',
                    'html',
                    'nuxt-progress',
                    /col-*/ // enable if using v-col for layout
                  ],
                  deep: [
                    /page-enter/,
                    /page-leave/,
                    /transition/
                  ]
                }

              },
              'css-byebye': {
                rulesToRemove: [
                  /.*\.v-application--is-rtl.*/
                ]
              }
            }
      }
  }
}
