const { Agent } = require('undici')

async function fetchWithTimeout (resource, options = {}) {
  const { timeout = parseInt(process.env.CURL_TIMEOUT) || 5000 } = options

  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)

  const response = await fetch(resource, {
    ...options,
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
    return { data: await b.text(), headers: b.headers, status: b.status }
  },
  fetchWithTimeout
}
