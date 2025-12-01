/// <reference lib="webworker" />

// --- IMPORTS ---
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute, setCatchHandler } from 'workbox-routing'
import { NetworkFirst, NetworkOnly } from 'workbox-strategies'

// --- SETUP ---
declare let self: ServiceWorkerGlobalScope

// 1. Precache assets (including index.html)
// Ensure your vite config includes index.html in the manifest!
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
registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith('/api/plannings') && request.method === 'GET',
  new NetworkFirst({
    cacheName: 'api-plannings',
    networkTimeoutSeconds: 5, // Fallback to cache if network takes > 5s
    plugins: [
      new CacheableResponsePlugin({
        statuses: [200], // Removed '0' unless you specifically need Cross-Origin caching
      }),
      new ExpirationPlugin({
        maxEntries: 100, // Increased slightly to accommodate query params
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 Year (Virtually "Indefinite")
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
            console.log('Mutation successful, invalidating planning cache.')
            // Delete the entire cache bucket to ensure consistency
            await caches.delete('api-plannings')
          }
          return response
        },
      },
    ],
  }),
)

// 5. APP SHELL / NAVIGATION FALLBACK (Crucial for SPAs)
// This handles all navigation requests that aren't API calls.
// If Network fails, it serves the precached 'index.html'.
const authExclusion = /^\/api\// // Exclude API routes from returning index.html

registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'pages',
      networkTimeoutSeconds: 3,
      plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
        new ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 Days
        }),
      ],
    }),
    {
      // Optional: Allow the NetworkFirst strategy to fail, then fallback to index.html
      // However, usually, we want a "Catch Handler" for offline navigation:
      denylist: [authExclusion],
    },
  ),
)

setCatchHandler(async ({ request }) => {
  // Return the precached offline page if a document is being requested
  if (request.destination === 'document') {
    // This expects 'index.html' to be in your __WB_MANIFEST
    return createHandlerBoundToURL('/index.html')(event as any)
  }

  return Response.error()
})
