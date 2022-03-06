const crypto = require('crypto')
const logger = require('./signale')

if (!process.env.ENCRYPTION_KEY && process.env.NODE_ENV !== 'production') {
  logger.warn('ENCRYPTION_KEY is not set')
  process.exit(1)
}

const encryptionKey = process.env.ENCRYPTION_KEY
const algorithm = 'aes-256-ctr'

const encrypt = (text) => {
  const iv = crypto.randomBytes(16)

  const cipher = crypto.createCipheriv(algorithm, encryptionKey, iv)
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()])

  return {
    iv: iv.toString('hex'),
    content: encrypted.toString('hex')
  }
}

const decrypt = (obj) => {
  const decipher = crypto.createDecipheriv(algorithm, encryptionKey, Buffer.from(obj.iv, 'hex'))
  const decrypted = Buffer.concat([decipher.update(Buffer.from(obj.content, 'hex')), decipher.final()])
  return decrypted.toString()
}

module.exports = {
  encrypt,
  decrypt
}
