import config from '@api/config'
import opsRoutes from '@api/routes/ops'
import planningsRoutes from '@api/routes/plannings'
import { defaultLogger as logger } from '@api/utils/logger'
import { cors } from '@elysiajs/cors'
import { openapi } from '@elysiajs/openapi'
import { Elysia, t } from 'elysia'

logger.info(`Authentication is ${config.authEnabled ? 'enabled' : 'disabled'}`)

// Only import auth module when auth is enabled (avoids BetterAuth initialization otherwise)
const auth = config.authEnabled ? (await import('@api/utils/auth')).auth : null
const authHtml = config.authEnabled ? (await import('./utils/auth-html')).default : null

const api = new Elysia({
  prefix: '/api',
})
  .onRequest(async ({ request }) => {
    console.log(`[${new Date().toISOString()}] ${request.method} ${request.url} ${request.headers.get('origin') || ''}`)
  })
  .onError(({ error, code, set }) => {
    const isNotFound = code === 'NOT_FOUND'
    if (!config.isProduction && !isNotFound) console.error(error)

    if (isNotFound) set.status = 404
    else if (code === 'INTERNAL_SERVER_ERROR') set.status = 500
    else if (code === 'INVALID_COOKIE_SIGNATURE') set.status = 400
    else if (code === 'INVALID_FILE_TYPE') set.status = 415
    else if (code === 'PARSE') set.status = 400
    else if (code === 'UNKNOWN') set.status = 500
    else set.status = 400

    return Response.json({ error, message: isNotFound ? 'Route not found' : 'Internal server error' })
  })
  .use(
    openapi({
      documentation: {
        info: {
          title: 'PlanningSup API',
          description: 'University calendar API - ICS to events conversion with offline support and auth preferences sync',
          version: '3.0.0',
        },
        tags: [
          { name: 'Plannings', description: 'Planning and events endpoints' },
          { name: 'Operations', description: 'Operational health and monitoring endpoints (requires x-ops-token)' },
          { name: 'Auth', description: 'Authentication endpoints (BetterAuth)' },
          { name: 'Health', description: 'Health check endpoints' },
        ],
        components: {
          securitySchemes: {
            opsToken: {
              type: 'apiKey',
              in: 'header',
              name: 'x-ops-token',
              description: 'Operations token for admin endpoints',
            },
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
              description: 'Bearer token for authenticated endpoints',
            },
          },
        },
      },
    }),
  )
  .use(
    cors({
      origin: config.trustedOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  )
  .get('/ping', () => 'pong' as const, {
    response: t.Literal('pong'),
    detail: {
      summary: 'Health check',
      description: 'Simple ping endpoint to verify API is running',
      tags: ['Health'],
    },
  })
  .use(opsRoutes)
  .use(planningsRoutes)

// Mount custom auth HTML routes (e.g., /api/auth/auto-redirect/:provider for Tauri/extension)
if (authHtml) {
  api.use(authHtml)
}

// Mount BetterAuth using explicit .get() and .post() handlers
// Note: Elysia's .mount() doesn't work correctly for GET requests (likely a bug),
// so we use separate handlers that forward the raw request to BetterAuth
if (auth) {
  logger.info('Mounting BetterAuth handler at /auth/*')
  api.get('/auth/*', ({ request }) => auth.handler(request))
  api.post('/auth/*', ({ request }) => auth.handler(request))
}

// Fallback for /api/* routes that weren't matched above
api.all('*', ({ set }) => {
  set.status = 404
  return Response.json({ error: 'NOT_FOUND', message: 'Route not found' })
}, {
  detail: { hide: true },
})

export type App = typeof api
export default api
