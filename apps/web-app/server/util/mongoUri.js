const DEFAULT_HOST = 'localhost:27017'

function buildMongoUri (options = {}) {
  const { directConnection = false } = options

  const host = process.env.MONGODB_URL || DEFAULT_HOST
  const username = process.env.MONGODB_USERNAME || process.env.MONGODB_USER
  const password = process.env.MONGODB_PASSWORD
  const authSource = process.env.MONGODB_AUTH_SOURCE

  const credentials = username
    ? `${encodeURIComponent(username)}${password ? ':' + encodeURIComponent(password) : ''}@`
    : ''

  const searchParams = new URLSearchParams()

  if (directConnection) searchParams.set('directConnection', 'true')
  if (authSource) searchParams.set('authSource', authSource)

  const query = searchParams.toString()

  return `mongodb://${credentials}${host}/planningsup${query ? `?${query}` : ''}`
}

function describeMongoTarget () {
  const host = process.env.MONGODB_URL || DEFAULT_HOST
  const username = process.env.MONGODB_USERNAME || process.env.MONGODB_USER

  if (!username) return host
  return `${username}@${host}`
}

module.exports = { buildMongoUri, describeMongoTarget }
