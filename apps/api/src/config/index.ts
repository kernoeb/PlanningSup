import { env } from './env'

const { NODE_ENV } = Bun.env

function getConfig() {
  return {
    // Http Server
    port: env('PORT', { default: 20000 }),
    webDistLocation: env('WEB_DIST_LOCATION'),

    // Jobs
    jobs: {
      runJobs: env('RUN_JOBS', { default: true }),
      allowedJobs: env('ALLOWED_JOBS'),
      delayBetweenJobs: env('DELAY_BETWEEN_JOBS'), // in ms
      quietHours: env('JOBS_QUIET_HOURS', { default: '21:00–06:00' }),
      quietHoursTimezone: env('JOBS_QUIET_HOURS_TIMEZONE', { default: 'Europe/Paris' }),
    },

    // Database
    databaseUrl: env('DATABASE_URL'),
    noMigrateDatabase: env('NO_MIGRATE_DATABASE', { default: false }),

    // Better-Auth
    authEnabled: env('AUTH_ENABLED', { default: false }),
    trustedOrigins: env('TRUSTED_ORIGINS')?.split(',').map(s => s.trim()),

    auth: {
      discord: {
        clientId: env('DISCORD_CLIENT_ID'),
        clientSecret: env('DISCORD_CLIENT_SECRET'),
      },
      github: {
        clientId: env('GITHUB_CLIENT_ID'),
        clientSecret: env('GITHUB_CLIENT_SECRET'),
      },
    },

    // Utils
    curlTimeout: env('CURL_TIMEOUT', { default: 5000 }), // in ms

    // Extension
    chromeExtensionId: env('CHROME_EXTENSION_ID'),
    firefoxExtensionId: env('FIREFOX_EXTENSION_ID'),
  }
}

const config = getConfig()

if (config.chromeExtensionId && !/^[a-z]{32}$/.test(config.chromeExtensionId)) throw new Error('Invalid CHROME_EXTENSION_ID format')
if (config.firefoxExtensionId && !/^[a-z0-9-]+$/.test(config.firefoxExtensionId)) throw new Error('Invalid FIREFOX_EXTENSION_ID format')

if (NODE_ENV === 'production') {
  // if (STRICT_MODE && config.globalAPIKey === DEFAULT_GLOBAL_API_KEY) {
  //   throw new Error('GLOBAL_API_KEY must be set in production')
  // }
}

export default config
