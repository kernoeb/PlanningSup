const { Router } = require('express')
const router = Router()

const { encrypt, decrypt } = require('../util/encryption')

const rateLimit = require('express-rate-limit')
const RATE_LIMIT_MSG = 'Trop de requêtes, veuillez réessayer dans une heure. On se calme, on se calme.'

const globalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'production' ? 3 : 1000, // limit each IP to 3 requests per hour
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers,
  message: RATE_LIMIT_MSG
})

const putLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 70, // limit each IP to 100 requests per hour
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers,
  message: RATE_LIMIT_MSG
})

// Baguette, baguette, baguette
const bip39 = require('bip39')
bip39.setDefaultWordlist('french')

const logger = require('../util/signale')

const { Sync, schema: syncSchema } = require('../models/sync')

/**
 * Get hex from mnemonic
 * @param mnemonic
 * @returns {Promise<string>}
 */
const getHexFromMnemonic = async (mnemonic) => {
  return (await bip39.mnemonicToSeed(mnemonic)).toString('hex')
}

/**
 * Check if mnemonic is valid
 * @param mnemonic
 * @returns {boolean}
 */
const isValidMnemonic = (mnemonic) => {
  return bip39.validateMnemonic(mnemonic) && mnemonic.trim().split(/\s+/g).length === 12
}

/**
 * Convert to SHA512
 * @param hex
 * @returns {string}
 */
const toSHA512 = (hex) => {
  return require('crypto').createHash('sha512').update(hex).digest('hex')
}

const RET_TEXT = {
  success: 'Voici votre mnémonique, il est important de le garder secret. Il vous servira à synchroniser votre compte.',
  loginSuccess: 'Vous êtes maintenant connecté.',
  error: 'Erreur lors de la génération du mnémonique. Veuillez réessayer plus tard.',
  saveError: 'Erreur lors de la sauvegarde.',
  invalid: 'Votre mnémonique est invalide.',
  missingHash: 'Vous devez fournir un hash en cookie.',
  missingMnemonic: 'Vous devez fournir un mnémonique en body.',
  nameMissing: 'Vous n\'avez pas entré votre nom.',
  unknownUser: 'Utilisateur inconnu.'
}

// List of things we want to return
const PROJECTION = Object.keys(syncSchema).filter(key => syncSchema[key]?.options?.canProject).reduce((acc, key) => {
  acc[key] = 1
  return acc
}, {})

// Clean object
// Ensure that we never return sensitive or unnecessary data
const cleanObj = (obj) => {
  const newObj = JSON.parse(JSON.stringify(obj))
  delete newObj.hash // never return the hash
  delete newObj.__v
  delete newObj._id
  return newObj
}

/**
 * POST /sync/generate
 * Well, write here I'm just generating a new mnemonic for the user
 * Don't try to bruteforce, it's useless
 * And btw, it's not Bitcoin, it's a planning tool, please be kind :)
 */
router.post('/generate', globalLimiter, async (req, res) => {
  const mnemonic = bip39.generateMnemonic()
  let seed = await getHexFromMnemonic(mnemonic)

  let count = 0
  while (!seed && !isValidMnemonic(mnemonic) && await Sync.findOne({ seed })) {
    // try again, maybe it's a bad mnemonic, or a bad seed, or a seed already used
    if (count > 10) { // very unlikely
      return res.status(500).json({ error: RET_TEXT.error })
    }
    const mnemonic = bip39.generateMnemonic()
    seed = await getHexFromMnemonic(mnemonic)
    count++
  }

  const hash = toSHA512(seed)

  try {
    const sync = new Sync({ hash })
    await sync.save()
  } catch (error) {
    logger.error(new Date().toISOString(), error?.message ?? error)
    return res.status(400).json({
      error: RET_TEXT.saveError
    })
  }

  // set the cookie
  res.cookie('hash', hash, {
    maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
    httpOnly: true
  })

  res.json({
    mnemonic,
    bodyText: RET_TEXT.success
  })
})

/**
 * POST /sync/login
 * Here we log in the user, we check if the user exists, if the mnemonic and the hash are correct
 * If everything is ok, we set the cookie
 */
router.post('/login', globalLimiter, async (req, res) => {
  /*
  // is this needed?
  if (req.cookies?.hash?.length) {
    logger.info('User is already logged in, deleting cookie')
    res.clearCookie('hash')
  } */

  const { mnemonic } = req.body

  if (!mnemonic) return res.status(400).json({ error: RET_TEXT.missingMnemonic })
  if (!isValidMnemonic(mnemonic)) return res.status(400).json({ error: RET_TEXT.invalid })

  const seed = await getHexFromMnemonic(mnemonic)
  const hash = toSHA512(seed)

  const sync = await Sync.findOne({ hash }, PROJECTION)
  if (!sync) return res.status(400).json({ error: RET_TEXT.unknownUser })

  // set the cookie
  res.cookie('hash', hash, {
    maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
    httpOnly: true
  })

  res.status(200).json({
    bodyText: RET_TEXT.loginSuccess
  })
})

/**
 * GET /sync/
 * Here we check if the user is logged in and if the hash is correct
 * If everything is ok, we return the user's data
 */
router.get('/', async (req, res) => {
  const { hash } = req.cookies // get the hash from the cookie
  if (!hash) return res.status(400).json({ error: RET_TEXT.missingHash })

  const sync = await Sync.findOne({ hash }, PROJECTION, { lean: true })
  if (!sync) return res.status(400).json({ error: RET_TEXT.unknownUser })

  // Update the cookie
  res.cookie('hash', hash, {
    maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
    httpOnly: true
  })

  if (sync.favorites?.length) {
    sync.favorites = sync.favorites.map(decrypt)
  }

  res.json({
    data: cleanObj(sync),
    serverTime: new Date()
  })
})

router.put('/', putLimiter, async (req, res) => {
  const { hash } = req.cookies // get the hash from the cookie
  if (!hash) return res.status(400).json({ error: RET_TEXT.missingHash })
  if (!await Sync.findOne({ hash })) return res.status(400).json({ error: RET_TEXT.unknownUser })

  const body = cleanObj(req.body) // get the body from the request, and clean it

  // Remove duplicates from the list
  if (body.planningList && Array.isArray(body.planningList) && body.planningList.length > 0) {
    body.planningList = [...new Set(body.planningList)]
  }

  if (body.favorites?.length) {
    body.favorites = body.favorites.map(encrypt)
  }

  // update the user's data
  try {
    const sync = await Sync.findOneAndUpdate({ hash },
      {
        // Unset null values
        $unset: Object.keys(body).reduce((acc, key) => {
          if (body[key] === null) acc[key] = ''
          return acc
        }, {}),
        // Set the new values
        $set: Object.keys(body).reduce((acc, key) => {
          if (body[key] !== null) acc[key] = body[key]
          return acc
        }, {})
      },
      { new: true, runValidators: true, projection: PROJECTION, omitUndefined: true, lean: true }
    )

    if (sync.favorites?.length) {
      sync.favorites = sync.favorites.map(decrypt)
    }

    return res.json({
      data: cleanObj(sync),
      serverTime: new Date()
    })
  } catch (error) {
    logger.error(new Date().toString(), error?.message ?? error)
    return res.status(400).json({
      error: RET_TEXT.saveError,
      errorMessage: error.message
    })
  }
})

module.exports = router
