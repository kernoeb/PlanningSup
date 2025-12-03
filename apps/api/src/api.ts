import type { Context } from 'elysia'
import config from '@api/config'
import planningsRoutes from '@api/routes/plannings'
import { defaultLogger as logger } from '@api/utils/logger'
import { cors } from '@elysiajs/cors'
import { openapi } from '@elysiajs/openapi'
import { Elysia } from 'elysia'

const BETTER_AUTH_ACCEPT_METHODS = ['POST', 'GET']

logger.info(`Authentication is ${config.authEnabled ? 'enabled' : 'disabled'}`)

// Only import auth module when auth is enabled (avoids BetterAuth initialization otherwise)
const auth = config.authEnabled ? (await import('@api/utils/auth')).auth : null
const authHtml = config.authEnabled ? (await import('./utils/auth-html')).default : null

async function betterAuthView(context: Context) {
  // auth is guaranteed to be non-null here because this function
  // is only registered as a route handler when config.authEnabled is true
  if (BETTER_AUTH_ACCEPT_METHODS.includes(context.request.method)) {
    return auth!.handler(context.request)
  } else {
    context.set.status = 405
  }
}

// Create a separate Elysia instance for auth routes without prefix
// This ensures BetterAuth receives requests at the correct paths
const authApi = new Elysia()

if (config.authEnabled && auth && authHtml) {
  // Mount authHtml routes (e.g., /api/auth/auto-redirect/:provider)
  authApi.use(authHtml)
  // Mount BetterAuth handler for all /api/auth/* routes
  authApi.all('/api/auth/*', betterAuthView)
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

// Fallback for /api/* routes
api.all('*', ({ set }) => {
  set.status = 404
  return Response.json({ error: 'NOT_FOUND', message: 'Route not found' })
})

// Export both the prefixed API and the auth API to be mounted separately
export { authApi }
export type App = typeof api
export default api
