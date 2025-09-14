import type { Context } from 'elysia'
import path from 'path'
import planningsRoutes from '@api/routes/plannings'
import { auth } from '@api/utils/auth'
import { defaultLogger as logger } from '@api/utils/logger'
import { openapi } from '@elysiajs/openapi'
import staticPlugin from '@elysiajs/static'
import { webLocation } from '@web/expose'
import { Elysia } from 'elysia'

const FRONTEND_DIST_PATH = Bun.env.WEB_DIST_LOCATION || path.join(webLocation)
const BETTER_AUTH_ACCEPT_METHODS = ['POST', 'GET']
const ENABLE_AUTH = String(Bun.env.ENABLE_AUTH ?? 'false').toLowerCase() === 'true'
const RUNTIME_CONFIG = { authEnabled: ENABLE_AUTH }

logger.info(`Frontend static files will be served from: ${FRONTEND_DIST_PATH}`)
logger.info(`Authentication is ${ENABLE_AUTH ? 'enabled' : 'disabled'}`)

function betterAuthView(context: Context) {
  if (BETTER_AUTH_ACCEPT_METHODS.includes(context.request.method)) {
    return auth.handler(context.request)
  } else {
    context.status(405)
  }
}

const app = new Elysia()
  .onError(({ error, code }) => {
    const isNotFound = code === 'NOT_FOUND'
    if (import.meta.env.NODE_ENV !== 'production' && !isNotFound) console.error(error)
    return { error, message: isNotFound ? 'Route not found' : 'Internal server error' }
  })
  .use(openapi())
  // /api/auth/* routes will be mounted conditionally below when ENABLE_AUTH is true
  .use(new Elysia({ prefix: '/api' })
    .get('/ping', () => 'pong')
    .use(planningsRoutes),
  )

if (ENABLE_AUTH) {
  app.all('/api/auth/*', betterAuthView)
}

app.get('/config.js', ({ set }) => {
  const body = `globalThis.__APP_CONFIG__ = ${JSON.stringify(RUNTIME_CONFIG)};`
  set.headers = {
    'Content-Type': 'application/javascript; charset=utf-8',
    'Cache-Control': 'no-store',
  }
  return body
})

if (import.meta.env.NODE_ENV === 'production') {
  app.use(staticPlugin({
    assets: FRONTEND_DIST_PATH,
    indexHTML: true,
    alwaysStatic: true,
    prefix: '/',
  }))
}

export type App = typeof app
export default app
