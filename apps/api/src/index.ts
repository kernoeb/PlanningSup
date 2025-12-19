import fs from 'fs'
import path from 'path'
import process from 'process'
import api from '@api/api'
import config from '@api/config'
import { client, db } from '@api/db'
import { init as initDb } from '@api/db/init'
import { jobs } from '@api/jobs'
import { defaultLogger as logger } from '@api/utils/logger'
import { renderRobotsTxt, renderSitemapXml, rewriteIndexHtmlSeoMeta } from '@api/utils/seo'
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

const RUNTIME_CONFIG = {
  authEnabled: config.authEnabled,
  plausible: config.plausible,
}

export const app = new Elysia()
  // Mount the API routes (includes BetterAuth and custom auth HTML routes when enabled)
  .use(api)
  .get('/config.js', ({ set }) => {
    const body = `globalThis.__APP_CONFIG__ = ${JSON.stringify(RUNTIME_CONFIG)};`
    set.headers = {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
    }
    return body
  })
  .get('/robots.txt', ({ set }) => {
    const body = renderRobotsTxt(config.publicOrigin)
    set.headers = {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    }
    return body
  })
  .get('/sitemap.xml', ({ set }) => {
    const body = renderSitemapXml(config.publicOrigin)

    set.headers = {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    }
    return body
  })

if (config.isProduction) {
  logger.info(`Frontend static files will be served from: ${FRONTEND_DIST_PATH}`)

  // Serve the app shell explicitly with proper headers.
  // This MUST be registered before the static plugin to take precedence.
  // This is needed because workbox precaches /index.html directly.
  const indexHtmlPath = path.join(FRONTEND_DIST_PATH, 'index.html')

  // Read the index.html content once at startup
  const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf-8')
  logger.info(`Loaded index.html (${indexHtmlContent.length} bytes)`)
  const indexHtmlSeoContent = rewriteIndexHtmlSeoMeta(indexHtmlContent, config.publicOrigin)
  logger.info(`Prepared SEO index.html (${indexHtmlSeoContent.length} bytes)`)

  app.get('/', ({ set }) => {
    set.headers['Content-Type'] = 'text/html; charset=utf-8'
    set.headers['Cache-Control'] = 'no-cache'
    return indexHtmlSeoContent
  })

  app.get('/index.html', ({ set }) => {
    set.headers['Content-Type'] = 'text/html; charset=utf-8'
    set.headers['Cache-Control'] = 'no-cache'
    return indexHtmlSeoContent
  })

  // Serve the service worker with no-cache so clients always check for updates.
  app.get('/sw.js', ({ set }) => {
    set.headers['Content-Type'] = 'application/javascript; charset=utf-8'
    set.headers['Cache-Control'] = 'no-cache'
    return Bun.file(path.join(FRONTEND_DIST_PATH, 'sw.js'))
  })

  // Static plugin for other assets (JS, CSS, images, etc.)
  // The ignorePatterns option prevents the static plugin from handling index.html
  // so our explicit routes above take precedence.
  app.use(staticPlugin({
    prefix: '/',
    assets: FRONTEND_DIST_PATH,
    alwaysStatic: false,
    indexHTML: false,
    ignorePatterns: [/index\.html$/],
  }))
}

app.onError(({ code, request }) => {
  if (config.isProduction && code === 'NOT_FOUND') {
    // Don't serve SPA for API routes - return JSON 404 instead
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) {
      return Response.json({ error: 'NOT_FOUND', message: 'Route not found' }, { status: 404 })
    }
    return new Response(Bun.file(path.join(FRONTEND_DIST_PATH, 'index.html')), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
})

app.listen(config.port, () => {
  logger.info(`Server started on http://localhost:${config.port}`)
})
