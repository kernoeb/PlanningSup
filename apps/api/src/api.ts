import type { Context } from 'elysia'
import config from '@api/config'
import planningsRoutes from '@api/routes/plannings'
import { auth } from '@api/utils/auth'
import { defaultLogger as logger } from '@api/utils/logger'
import { cors } from '@elysiajs/cors'
import { openapi } from '@elysiajs/openapi'
import { Elysia } from 'elysia'
import authHtml from './utils/auth-html'

const BETTER_AUTH_ACCEPT_METHODS = ['POST', 'GET']

logger.info(`Authentication is ${config.authEnabled ? 'enabled' : 'disabled'}`)

async function betterAuthView(context: Context) {
  if (BETTER_AUTH_ACCEPT_METHODS.includes(context.request.method)) {
    return auth.handler(context.request)
  } else {
    context.status(405)
  }
}

const api = new Elysia({
  prefix: '/api',
})
  .onRequest(async ({ request }) => {
    console.log(`[${new Date().toISOString()}] ${request.method} ${request.url} ${request.headers.get('origin') || ''}`)
  })
  .onError(({ error, code, set }) => {
    const isNotFound = code === 'NOT_FOUND'
    if (import.meta.env.NODE_ENV !== 'production' && !isNotFound) console.error(error)

    if (isNotFound) set.status = 404
    else if (code === 'INTERNAL_SERVER_ERROR') set.status = 500
    else if (code === 'INVALID_COOKIE_SIGNATURE') set.status = 400
    else if (code === 'INVALID_FILE_TYPE') set.status = 415
    else if (code === 'PARSE') set.status = 400
    else if (code === 'UNKNOWN') set.status = 500
    else if (code === 'VALIDATION') set.status = 400
    else set.status = 400

    return Response.json({ error, message: isNotFound ? 'Route not found' : 'Internal server error' })
  })
  .use(openapi())
  .use(
    cors({
      origin: config.trustedOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  )
  .get('/ping', () => 'pong')
  .use(planningsRoutes)

if (config.authEnabled) {
  api.use(authHtml)
  api.all('/auth/*', betterAuthView)
}

// Fallback
api.all('*', ({ status }) => status(404))

export type App = typeof api
export default api
