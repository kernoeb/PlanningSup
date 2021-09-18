import colors from 'vuetify/es5/util/colors'
import fr from 'vuetify/es5/locale/fr'
import minifyTheme from 'minify-css-string'
const { NODE_ENV = 'production' } = process.env
const isDev = NODE_ENV === 'development'

const PLAUSIBLE_URL = 'plausible.noewen.com'
const DESCRIPTION = 'Un planning universitaire moderne réalisé par @kernoeb'
const TITLE = 'PlanningSup'
const META_TITLE = `${TITLE} | Calendrier universitaire`
const URL = 'https://planningsup.app'
const BANNER = `${URL}/banner.png`

export default {
  telemetry: false,
  ssr: true,
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

  // Global CSS (https://go.nuxtjs.dev/config-css)
  css: [
  ],

  // Plugins to run before rendering page (https://go.nuxtjs.dev/config-plugins)
  plugins: [
    // https://github.com/moritzsternemann/vue-plausible
    { src: '~/plugins/vue-plausible.js', mode: 'client' }
  ],

  // Auto import components (https://go.nuxtjs.dev/config-components)
  components: true,

  /*
  ** Server Middleware
  */
  serverMiddleware: [
    { path: '/api', handler: '~/server/api' }
    // { path: '/server', handler: '~/server/util/worker' }
  ],

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
    'cookie-universal-nuxt',
    '@nuxtjs/axios',
    // https://go.nuxtjs.dev/pwa
    '@nuxtjs/pwa',
    '@nuxtjs/component-cache',
    'nuxt-json-config',
    [
      '@dansmaculotte/nuxt-security',
      {
        hsts: {
          maxAge: 15552000,
          includeSubDomains: true,
          preload: true
        },
        referrer: 'same-origin',
        additionalHeaders: true
      }
    ]
  ],

  render: {
    csp: {
      hashAlgorithm: 'sha256',
      policies: {
        'default-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
        'font-src': ['fonts.googleapis.com', 'fonts.gstatic.com'],
        'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        'connect-src': ["'self'", PLAUSIBLE_URL]
      }
    }
  },

  pwa: {
    meta: {
      title: TITLE,
      author: 'kernoeb',
      description: DESCRIPTION,
      lang: 'fr',
      ogSiteName: TITLE,
      ogTitle: TITLE,
      ogDescription: DESCRIPTION
    },
    manifest: {
      name: TITLE,
      short_name: TITLE,
      description: DESCRIPTION,
      lang: 'fr',
      display: 'standalone'
    },
    workbox: {
      cleanupOutdatedCaches: true
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
    defaultAssets: false,
    customVariables: ['~/assets/variables.scss'],
    treeShake: true,
    theme: {
      dark: true,
      options: { minifyTheme },
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
    babel: {
      plugins: [
        ['@babel/plugin-proposal-private-methods', { loose: true }]
      ]
    },
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
