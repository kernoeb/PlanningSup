const { Agent, request } = require('undici')

const USER_AGENT = 'Mozilla/5.0'

async function fetchWithTimeout (url, options = {}) {
  const { timeout = parseInt(process.env.CURL_TIMEOUT) || 5000 } = options

  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)

  const response = await request(url, {
    ...options,
    headers: {
      'User-Agent': USER_AGENT
    },
    dispatcher: new Agent({
      connect: {
        rejectUnauthorized: false
      }
    }),
    signal: controller.signal
  })
  clearTimeout(id)

  return response
}

module.exports = {
  async get (url) {
    const b = await fetchWithTimeout(url)
    return { data: await b.body.text(), headers: b.headers, status: b.statusCode }
  },
  fetchWithTimeout
}
