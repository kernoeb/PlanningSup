import path from 'path'
import planningsRoutes from '@api/routes/plannings'
import { auth } from '@api/utils/auth'
import { openapi } from '@elysiajs/openapi'
import staticPlugin from '@elysiajs/static'
import { webLocation } from '@web/expose'
import { Elysia } from 'elysia'

const FRONTEND_DIST_PATH = Bun.env.WEB_DIST_LOCATION || path.join(webLocation)

const betterAuth = new Elysia({ name: 'better-auth' })
  .mount(auth.handler)
  .macro({
    auth: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({
          headers,
        })

        if (!session) return status(401)

        return {
          user: session.user,
          session: session.session,
        }
      },
    },
  })

const app = new Elysia()
  .onError(({ error, code }) => {
    const isNotFound = code === 'NOT_FOUND'
    if (import.meta.env.NODE_ENV !== 'production' && !isNotFound) console.error(error)
    return { error, message: isNotFound ? 'Route not found' : 'Internal server error' }
  })
  .use(openapi())
  /* .use( // disable CORS temporarily
    cors({
      origin: 'http://localhost:4444',
      allowedHeaders: ['Content-Type', 'Authorization'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      exposeHeaders: ['Content-Length'],
      maxAge: 600,
      credentials: true,
    }),
  ) */

  .use(new Elysia({ prefix: '/api' })
    .use(betterAuth)
    .use(planningsRoutes),
  )

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
