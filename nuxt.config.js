const { NODE_ENV = 'production' } = process.env
const isDev = NODE_ENV === 'development'

const TITLE = process.env.DEPLOY_TITLE || 'PlanningSup'
const DESCRIPTION = process.env.DEPLOY_DESCRIPTION || 'Un planning universitaire moderne réalisé par @kernoeb'
const KEYWORDS = process.env.DEPLOY_KEYWORDS || ['planning', 'planningedt', 'planninguniv', 'edt', 'emploi du temps', 'université', 'calendrier', 'universitaire', 'planningiut', 'planningiut.fr', 'edtuniv', 'planningapp', 'app planning', 'site planning', 'planning sup', 'planning iut', 'dut informatique', 'dut', 'iutvannes', 'iut de vannes', 'iut vannes'].join(',')
const PLAUSIBLE_DOMAIN = process.env.DEPLOY_PLAUSIBLE_DOMAIN || 'plausible.noewen.com'
const META_TITLE = process.env.DEPLOY_META_TITLE || `${TITLE} | Calendrier universitaire`
const DOMAIN = process.env.DEPLOY_DOMAIN || 'planningsup.app'
const URL = `https://${DOMAIN}`
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
      { name: 'keywords', content: KEYWORDS },
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
    { src: '~/plugins/v-tooltip.js', mode: 'client' }
  ],

  // Auto import components (https://go.nuxtjs.dev/config-components)
  components: true,

  /*
  ** Server Middleware
  */
  serverMiddleware: [
    { path: '/api/v1', handler: '~/server/' }
  ],

  // Modules for dev and build (recommended) (https://go.nuxtjs.dev/config-modules)
  buildModules: [
    // https://go.nuxtjs.dev/vuetify
    '@nuxtjs/vuetify',
    // https://github.com/nuxt-community/moment-module
    '@nuxtjs/moment',
    ['@nuxtjs/google-fonts', {
      display: 'swap',
      families: {
        Roboto: [100, 300, 400, 500, 700, 900]
      }
    }],
    // https://github.com/moritzsternemann/vue-plausible
    'vue-plausible'
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
        'font-src': ["'self'", 'fonts.googleapis.com', 'fonts.gstatic.com'],
        'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        'connect-src': ["'self'", PLAUSIBLE_DOMAIN]
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
      display: 'standalone',
      background_color: '#000000'
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

  plausible: { // Use as fallback if no runtime config is available at runtime
    domain: DOMAIN,
    enableAutoPageviews: true,
    enableAutoOutboundTracking: true
  },
  publicRuntimeConfig: {
    plausible: {
      domain: DOMAIN,
      apiHost: 'https://' + PLAUSIBLE_DOMAIN,
      enableAutoPageviews: true,
      enableAutoOutboundTracking: true
    },
    name: TITLE,
    hideWeekends: process.env.HIDE_WEEKENDS !== 'false',
    defaultPlanning: process.env.DEFAULT_PLANNING_ID || 'iutdevannes.butdutinfo.1ereannee.gr1a.gr1a1',
    i18n: {
      week: 'Semaine',
      weeks: 'Semaines',
      day: 'Jour',
      month: 'Mois',
      today: "Aujourd'hui",
      error1: 'Bon y a eu un soucis.',
      error2: 'Revient plus tard bg.',
      chooseEdt: 'Plannings',
      changeEdt: "Changer d'EDT",
      changeTheme: 'Changer le thème',
      offline: 'Hors connexion',
      donate: 'Faire un don',
      projectPage: 'Code source',
      settings: 'Paramètres',
      lightThemeMsg: 'Activer le thème clair',
      lightThemeDesc: 'Idéal pour perdre la vue',
      blocklist: 'Liste noire',
      blocklistDesc: 'Cache les cours contenant le(s) mot(s)',
      ui: 'Interface',
      error_db: "Le serveur de l'université choisie est indisponible (ou en galère), voici une version sauvegardée datant du ",
      error_db_only: 'Planning temporairement indisponible',
      error_db_one: 'Au moins un planning temporairement indisponible',
      error_saved: 'version sauvegardée du',
      error_saved2: 'version sauvegardée',
      error_db2: "Le serveur de l'université choisie est indisponible (ou en galère), voici une version sauvegardée.",
      error_db_all: "Oups, aucun planning n'est disponible, désolé !",
      close: 'Fermer',
      distance: 'DISTANCIEL',
      mode: 'Mode',
      contact: 'Me contacter',
      multiplePlannings: 'Multiples plannings',
      reset: 'Tout désélectionner',
      selection: 'Sélection',
      searchPlanning: 'Rechercher un planning',
      selectedPlannings: 'plannings sélectionnés',
      colors: 'Couleurs des cours',
      others: 'Autres',
      amphi: 'Amphis',
      types: {
        td: 'Travaux dirigés',
        tp: 'Travaux pratiques',
        amphi: 'Amphithéâtre',
        other: 'Les cours random'
      }
    }
  },

  // Vuetify module configuration (https://go.nuxtjs.dev/config-vuetify)
  vuetify: {
    treeShake: true,
    defaultAssets: false,
    customVariables: ['~/assets/variables.scss'],
    optionsPath: './vuetify.options.js'
  },

  modern: NODE_ENV === 'production',

  // Build Configuration (https://go.nuxtjs.dev/config-build)
  build: {
    transpile: [
      /^axios/
    ],
    loaders: {
      css: {
        modules: false
      }
    },
    extractCSS: true,
    postcss: {
      postcssOptions:
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
                      /progress-circular/,
                      /col-*/, // enable if using v-col for layout,
                      /swatches/,
                      /[a-z]+--text/
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
}
