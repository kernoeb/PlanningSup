const { curly } = require('node-libcurl')

// Always follow redirects and ignore certificate errors
const OPTIONS = { SSL_VERIFYHOST: 0, SSL_VERIFYPEER: 0, followLocation: 1, timeoutMs: parseInt(process.env.CURL_TIMEOUT) || 5000 }

module.exports = {
  async get (url) {
    return await curly.get(url, OPTIONS)
  }
}
