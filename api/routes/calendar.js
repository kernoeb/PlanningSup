import fetch from 'node-fetch'
const { Router } = require('express')

const router = Router()

// Test route
router.use('/getCalendar', async (req, res) => {
  const response = await fetch('https://planning.univ-ubs.fr/jsp/custom/modules/plannings/anonymous_cal.jsp?data=8241fc3873200214ea232fa64e22a85ce0fa50826f0818af4a82a8fde6ce3f14906f45af276f59ae8fac93f781e86152d0472efb473cb41fbcd12dfcc8a8c0e5c2973627c2eb073b745dafb5ad25500c8d3f4109b6629391')
  const body = await response.text()
  res.end(body)
})

module.exports = router
