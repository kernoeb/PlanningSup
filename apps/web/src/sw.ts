/// <reference lib="webworker" />

// --- IMPORTS ---
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst, NetworkOnly } from 'workbox-strategies'

// --- SETUP ---
declare let self: ServiceWorkerGlobalScope

// 1. Precache assets (including index.html)
precacheAndRoute(self.__WB_MANIFEST)

// 2. Clean up old assets
cleanupOutdatedCaches()

// --- LIFECYCLE ---
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// --- ROUTING ---

// 3. API CACHING FOR 'GET' (Specific)
// Only cache network-first calls (exclude onlyDb=true which returns fast DB-only responses)
registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith('/api/plannings')
    && request.method === 'GET'
    && url.searchParams.get('onlyDb') !== 'true',
  new NetworkFirst({
    cacheName: 'api-plannings',
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 Year
      }),
      {
        handlerDidError: async () => {
          return new Response(
            JSON.stringify({ error: 'Network unavailable and no cache found.' }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        },
      },
    ],
  }),
)

// 4. API INVALIDATION FOR MUTATIONS
registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith('/api/plannings') && request.method !== 'GET',
  new NetworkOnly({
    plugins: [
      {
        fetchDidSucceed: async ({ response }) => {
          if (response.ok) {
            await caches.delete('api-plannings')
          }
          return response
        },
      },
    ],
  }),
)

// 5. APP SHELL / NAVIGATION FALLBACK
// Use NetworkFirst for navigation with automatic fallback to precache
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'pages',
      networkTimeoutSeconds: 3,
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 Days
        }),
      ],
    }),
    {
      denylist: [/^\/api\//],
    },
  ),
)
