import path from 'path'
import process from 'process'
import app from '@api/api'
import config from '@api/config'
import { client, db } from '@api/db'
import { init as initDb } from '@api/db/init'
import { jobs } from '@api/jobs'
import { defaultLogger as logger } from '@api/utils/logger'
import staticPlugin from '@elysiajs/static'
import { webLocation } from '@web/expose'

console.log('Starting server...')

// Properly handle shutdown
function onExit() {
  logger.info('Shutting down server...')
  client.end()
  logger.info('Database connection closed.')
  process.exit(0)
}

process.on('SIGINT', onExit)
process.on('SIGTERM', onExit)

await initDb(db).then(() => {
  jobs.start(db)
})

app.listen(config.port, () => {
  logger.info(`Server started on http://localhost:${config.port}`)
})

if (import.meta.env.NODE_ENV === 'production') {
  const FRONTEND_DIST_PATH = config.webDistLocation || path.join(webLocation)
  logger.info(`Frontend static files will be served from: ${FRONTEND_DIST_PATH}`)

  app.use(staticPlugin({
    assets: FRONTEND_DIST_PATH,
    indexHTML: true,
    alwaysStatic: true,
    prefix: '/',
  }))
}
