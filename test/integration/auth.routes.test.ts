import { describe, it, expect } from 'bun:test'
import './setup'

/**
 * Auth routes are optional and disabled by default (AUTH_ENABLED=false).
 * When disabled, no /api/auth/* routes should be mounted, and requests must return 404.
 *
 * These tests verify that behavior. If you enable auth locally (AUTH_ENABLED=true),
 * these tests will fail by design.
 */

const BASE_URL = 'http://localhost:20000'

async function expect404(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, init)
  expect(res.status).toBe(404)

  // The API error handler returns JSON for NOT_FOUND with { error, message }
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const body = await res.json()
    expect(body).toHaveProperty('message')
  } else {
    // Fallback for any non-JSON responses
    await res.text()
  }
}

describe('Auth routes (disabled)', () => {
  it('sanity: API is up and non-auth routes work', async () => {
    const res = await fetch(`${BASE_URL}/api/ping`)
    expect(res.ok).toBe(true)
    const text = await res.text()
    expect(text).toBe('pong')
  })

  it('GET /api/auth/session returns 404 when auth is disabled', async () => {
    await expect404('/api/auth/session', { method: 'GET' })
  })

  it('GET /api/auth/get-session returns 404 when auth is disabled', async () => {
    await expect404('/api/auth/get-session', { method: 'GET' })
  })

  it('POST /api/auth/sign-in/social returns 404 when auth is disabled', async () => {
    await expect404('/api/auth/sign-in/social', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'discord' }),
    })
  })

  it('POST /api/auth/sign-out returns 404 when auth is disabled', async () => {
    await expect404('/api/auth/sign-out', { method: 'POST' })
  })

  it('POST /api/auth/update-user returns 404 when auth is disabled', async () => {
    await expect404('/api/auth/update-user', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ theme: 'dark' }),
    })
  })

  it('unknown /api/auth/* routes return 404 when auth is disabled', async () => {
    await expect404('/api/auth/unknown-endpoint', { method: 'GET' })
    await expect404('/api/auth/unknown-endpoint', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ any: 'payload' }),
    })
  })
})
