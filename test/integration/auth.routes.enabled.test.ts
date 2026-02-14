import { describe, it, expect, beforeAll, afterAll } from 'bun:test'

/**
 * Integration tests for auth routes when AUTH_ENABLED=true.
 *
 * These tests verify that BetterAuth routes are properly mounted and respond
 * when authentication is enabled. They run against a separate Docker environment
 * (docker-compose.test-auth.yml) on port 20001.
 *
 * Note: These tests don't verify full OAuth flows (which require real provider credentials).
 * They verify that:
 * 1. Auth routes are mounted and respond (not 404)
 * 2. BetterAuth handler processes requests correctly
 * 3. Session endpoints return appropriate responses for unauthenticated requests
 *
 * Run with: bun run test:integration:auth
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:20001'

// Setup: wait for the auth-enabled test server to be ready
beforeAll(async () => {
  console.log(`Setting up auth-enabled integration tests (BASE_URL: ${BASE_URL})...`)

  const maxAttempts = 30
  let attempts = 0

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`${BASE_URL}/api/ping`)
      if (response.ok) {
        console.log('✅ Auth-enabled application is ready for testing')
        return
      }
    } catch {
      // Continue trying
    }

    attempts++
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  throw new Error('Auth-enabled application failed to start within timeout')
})

afterAll(() => {
  console.log('Cleaning up auth-enabled integration tests...')
})

describe('Auth routes (enabled)', () => {
  describe('Sanity checks', () => {
    it('API is up and non-auth routes work', async () => {
      const res = await fetch(`${BASE_URL}/api/ping`)
      expect(res.ok).toBe(true)
      const text = await res.text()
      expect(text).toBe('pong')
    })

    it('/config.js reports authEnabled: true', async () => {
      const res = await fetch(`${BASE_URL}/config.js`)
      expect(res.ok).toBe(true)

      const text = await res.text()
      expect(text).toContain('authEnabled')
      expect(text).toContain('true')

      // Verify it's valid JavaScript that sets __APP_CONFIG__
      expect(text).toContain('globalThis.__APP_CONFIG__')
    })
  })

  describe('BetterAuth session endpoints', () => {
    it('GET /api/auth/get-session returns valid JSON response (not 404)', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/get-session`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      })

      // Should NOT be 404 - the route must be mounted
      expect(res.status).not.toBe(404)

      // BetterAuth returns 200 with null/empty session for unauthenticated requests
      // The exact status depends on BetterAuth version, but it should be a valid response
      expect([200, 401, 403]).toContain(res.status)

      const contentType = res.headers.get('content-type') || ''
      expect(contentType).toContain('application/json')

      // Should be valid JSON (null is valid for unauthenticated)
      const text = await res.text()
      expect(text).toBeDefined()
      // BetterAuth returns "null" (as JSON) for unauthenticated requests
      if (text && text !== 'null') {
        expect(() => JSON.parse(text)).not.toThrow()
      }
    })

    // Note: BetterAuth uses /api/auth/get-session, not /api/auth/session
    // The /session endpoint doesn't exist in BetterAuth by default
  })

  describe('BetterAuth sign-out endpoint', () => {
    it('POST /api/auth/sign-out responds (not 404)', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/sign-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      // Should NOT be 404 - the route must be mounted
      expect(res.status).not.toBe(404)

      // Sign-out without a session might return 200 (no-op) or an error status
      // but definitely not 404
    })
  })

  describe('BetterAuth social sign-in endpoints', () => {
    it('POST /api/auth/sign-in/social responds (not 404)', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/sign-in/social`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: 'discord',
          callbackURL: 'http://localhost:3000/auth/callback',
        }),
      })

      // Should NOT be 404 - the route must be mounted
      expect(res.status).not.toBe(404)

      // This will likely return a redirect URL or an error since we have test OAuth creds,
      // but the route should be mounted and respond
      // BetterAuth typically returns 200 with a URL to redirect to
    })

    it('GET /api/auth/callback/discord route exists (not 404)', async () => {
      // OAuth callback routes should exist even without valid OAuth params
      const res = await fetch(`${BASE_URL}/api/auth/callback/discord`, {
        method: 'GET',
      })

      // Should NOT be 404 - the route must be mounted
      // Without proper OAuth state/code, it will error, but the route exists
      expect(res.status).not.toBe(404)
    })
  })

  describe('Custom auth HTML routes', () => {
    it('GET /api/auth/auto-redirect/:provider returns 400 without params', async () => {
      // This is a custom route from auth-html.tsx for Tauri/extension deep links
      const res = await fetch(`${BASE_URL}/api/auth/auto-redirect/discord`, {
        method: 'GET',
      })

      // Without proper query params (code, state, client), it should return 400
      // but NOT 404 - the route must exist
      expect(res.status).not.toBe(404)
      expect(res.status).toBe(400) // Missing required query parameters
    })

    it('GET /api/auth/auto-redirect/:provider returns 400 for unsupported provider', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/auto-redirect/unsupported?code=test&state=test&client=tauri`, {
        method: 'GET',
      })

      expect(res.status).toBe(400)
      const text = await res.text()
      expect(text).toContain('Unsupported provider')
    })

    it('GET /api/auth/auto-redirect/:provider returns 400 for invalid client', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/auto-redirect/discord?code=test&state=test&client=invalid`, {
        method: 'GET',
      })

      expect(res.status).toBe(400)
      const text = await res.text()
      expect(text).toContain('Invalid client parameter')
    })
  })

  describe('Passkey routes', () => {
    it('GET /api/auth/passkey/generate-authenticate-options responds (not 404)', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/passkey/generate-authenticate-options`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      })
      expect(res.status).not.toBe(404)
    })

    it('GET /api/auth/passkey/generate-register-options responds (not 404)', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/passkey/generate-register-options`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      })
      expect(res.status).not.toBe(404)
    })

    it('GET /api/auth/passkey/list-user-passkeys responds (not 404)', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/passkey/list-user-passkeys`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      })
      expect(res.status).not.toBe(404)
    })
  })

  describe('Unknown auth routes', () => {
    it('unknown /api/auth/* routes return 404', async () => {
      // Routes that don't exist in BetterAuth should still 404
      const res = await fetch(`${BASE_URL}/api/auth/definitely-not-a-real-endpoint`, {
        method: 'GET',
      })

      // BetterAuth will return 404 for unknown routes within its handler
      expect(res.status).toBe(404)
    })
  })

  describe('API 404 behavior', () => {
    it('unknown /api/* routes return JSON 404 (not SPA)', async () => {
      // This verifies the fix for API 404s returning JSON instead of SPA HTML
      const testPaths = [
        '/api/unknown-route',
        '/api/nonexistent',
        '/api/foo/bar/baz',
      ]

      for (const path of testPaths) {
        const res = await fetch(`${BASE_URL}${path}`)

        expect(res.status).toBe(404)

        const contentType = res.headers.get('content-type') || ''
        expect(contentType).toContain('application/json')

        const body = await res.json()
        expect(body).toHaveProperty('error', 'NOT_FOUND')
        expect(body).toHaveProperty('message', 'Route not found')
      }
    })
  })
})
