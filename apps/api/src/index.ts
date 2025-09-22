import path from 'path'
import process from 'process'
import api from '@api/api'
import config from '@api/config'
import { client, db } from '@api/db'
import { init as initDb } from '@api/db/init'
import { jobs } from '@api/jobs'
import { defaultLogger as logger } from '@api/utils/logger'
import staticPlugin from '@elysiajs/static'
import { webLocation } from '@web/expose'
import { Elysia } from 'elysia'

const FRONTEND_DIST_PATH = config.webDistLocation || path.join(webLocation)

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

const RUNTIME_CONFIG = { authEnabled: config.enableAuth }

export const app = new Elysia()
  .use(api)
  .get('/config.js', ({ set }) => {
    const body = `globalThis.__APP_CONFIG__ = ${JSON.stringify(RUNTIME_CONFIG)};`
    set.headers = {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
    }
    return body
  })

if (import.meta.env.NODE_ENV === 'production') {
  logger.info(`Frontend static files will be served from: ${FRONTEND_DIST_PATH}`)
  app.use(staticPlugin({ prefix: '/', assets: FRONTEND_DIST_PATH, alwaysStatic: true, indexHTML: false }))
}

app.onError(({ code }) => {
  if (import.meta.env.NODE_ENV === 'production' && code === 'NOT_FOUND') {
    return new Response(Bun.file(path.join(FRONTEND_DIST_PATH, 'index.html')), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
})

app.listen(config.port, () => {
  logger.info(`Server started on http://localhost:${config.port}`)
})
