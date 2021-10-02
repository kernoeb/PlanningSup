const http = require('http')
const https = require('https')
const axios = require('axios')
const config = require('config')
const logger = require('./signale')

const MAX_REQUESTS_COUNT = 20
const INTERVAL_MS = 20
let PENDING_REQUESTS = 0
const DURATION = config.get('duration') || 5000

logger.log('Axios instantiated')

const instance = axios.create({
  timeout: DURATION,
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true })
})

instance.interceptors.request.use(function (config) {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (PENDING_REQUESTS < MAX_REQUESTS_COUNT) {
        PENDING_REQUESTS++
        clearInterval(interval)
        resolve(config)
      }
    }, INTERVAL_MS)
  })
})

/**
 * Axios Response Interceptor
 */
instance.interceptors.response.use(function (response) {
  PENDING_REQUESTS = Math.max(0, PENDING_REQUESTS - 1)
  return Promise.resolve(response)
}, function (error) {
  PENDING_REQUESTS = Math.max(0, PENDING_REQUESTS - 1)
  return Promise.reject(error)
})

module.exports = instance
