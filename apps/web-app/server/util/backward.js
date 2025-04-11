const { allCalendarIds, idSeparator, planningsPerFullId } = require('./plannings')

/**
 * Middleware to fix cookie IDs
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
module.exports.cookieBackwardMiddleware = (req, res, next) => {
  if (!req.cookies) {
    return next()
  }

  // Check if the cookie is already fixed
  if (req.cookies['plannings-cookie-v2']) {
    return next()
  }

  // Cookie fixer
  if (req.cookies.plannings) {
    try {
      let hasChanged = false
      const plannings = [...new Set(req.cookies.plannings.split(','))]
      for (let i = 0; i < plannings.length; i++) {
        const planning = plannings[i]
        const splittedPlanning = planning.split(idSeparator)
        const [id] = splittedPlanning
        if (!allCalendarIds.includes(id)) {
          // Find an ID that is equal if removing all special characters and lowercased
          const fixerFn = (id) => id.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
          const cleanedId = fixerFn(id)
          const bestMatch = allCalendarIds.find(calendarId => fixerFn(calendarId) === cleanedId)
          if (!bestMatch) {
            // Handle the case where the cleaned ID is not found
            console.log(`Planning ID ${id} not found`)
            res.clearCookie('plannings')
          } else {
            const fixedPartId = planning.replace(id, bestMatch)

            if (!planningsPerFullId[fixedPartId]) {
              console.log(`Planning ${fixedPartId} not found`)
              res.clearCookie('plannings')
            } else {
              console.log(`Adding ${fixedPartId} to planningsPerFullId`)
            }

            plannings[i] = fixedPartId
            hasChanged = true
          }
        }
      }

      if (hasChanged) {
        const newJoin = plannings.join(',')
        console.log('Updating plannings cookie from', req.cookies.plannings, 'to', newJoin)
        req.__fixedCookie = newJoin
        res.cookie('plannings', newJoin, { maxAge: 34560000000 })
      }

      res.cookie('plannings-cookie-v2', 'true', { maxAge: 34560000000 })
    } catch (err) {
      console.error(err)
    }
  }
  next()
}
