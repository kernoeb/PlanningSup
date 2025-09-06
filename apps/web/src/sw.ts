import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'

declare let self: ServiceWorkerGlobalScope

// self.__WB_MANIFEST is the default injection point
precacheAndRoute(self.__WB_MANIFEST)

// clean old assets
cleanupOutdatedCaches()

let allowlist: RegExp[] | undefined
// in dev mode, we disable precaching to avoid caching issues
if (import.meta.env.DEV) allowlist = [/^\/$/]

// to allow work offline
registerRoute(new NavigationRoute(
  createHandlerBoundToURL('index.html'),
  { allowlist, denylist: [/^\/api\/auth\//] },
))

// Network-first + cache fallback for GET /api/plannings*
registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith('/api/plannings')
    && request.method === 'GET',
  new NetworkFirst({
    cacheName: 'api-plannings',
    networkTimeoutSeconds: 5, // fallback to cache if the network is slow/unavailable
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }), // cache only successful/opaque responses
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24, // 24 hours
      }),
    ],
    // If you want to treat requests with different query params as the same cache entry:
    // matchOptions: { ignoreSearch: true },
  }),
)

// @ts-expect-error missing types
self.skipWaiting()
clientsClaim()
