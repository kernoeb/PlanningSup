import { beforeAll, afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'

/**
 * Tests for the useAuth composable when auth is disabled via runtime config (globalThis.__APP_CONFIG__.authEnabled=false).
 * Expectations:
 * - authEnabled === false
 * - session is a simple ref-like object with { isPending: false, data: null, error: null }
 * - signInDiscord/signInGithub/signOut are no-ops (do not call auth client, warn in console)
 */

describe('useAuth (authEnabled=false via runtime config)', () => {
  let useAuth: any
  const warnings: string[] = []
  const originalWarn = console.warn

  // Track any accidental calls into the auth client from the composable
  const callCounters = {
    signInSocial: 0,
    signOut: 0,
    useSession: 0,
    updateUser: 0,
  }

  beforeAll(async () => {
    // Force disabled auth via runtime config before importing the composable
    (globalThis as any).__APP_CONFIG__ = { authEnabled: false }

    // Stub @libs to ensure no real BetterAuth client is created or used
    mock.module('@libs', () => {
      return {
        authClient: {
          signIn: {
            social: async (_opts: any) => {
              callCounters.signInSocial += 1
              return { ok: true }
            },
          },
          signOut: async () => {
            callCounters.signOut += 1
          },
          updateUser: async () => {
            callCounters.updateUser += 1
          },
          useSession: () => {
            callCounters.useSession += 1
            // Would normally return a ref; but with auth disabled the composable won't call this
            return { value: { isPending: true, data: null, error: null } }
          },
        },
        // Export "client" in case other imports occur transitively in the test env
        client: {},
      }
    })

    // Capture console warnings (no-op notices)
    // eslint-disable-next-line no-console
    console.warn = (...args: any[]) => {
      try {
        warnings.push(args.map(String).join(' '))
      } catch {
        warnings.push('warn:unserializable')
      }
      return undefined as unknown as void
    }

    // Import after mocks & env are set
    const mod = await import('@web/composables/useAuth')
    useAuth = mod.useAuth
  })

  afterAll(() => {
    // Restore console
    // eslint-disable-next-line no-console
    console.warn = originalWarn
  })

  beforeEach(() => {
    warnings.length = 0
    callCounters.signInSocial = 0
    callCounters.signOut = 0
    callCounters.useSession = 0
    callCounters.updateUser = 0
  })

  it('signInDiscord/signInGithub/signOut are no-ops and do not call auth client', async () => {
    const { signInDiscord, signInGithub, signOut } = useAuth()

    await expect(signInDiscord()).resolves.toBeUndefined()
    await expect(signInGithub()).resolves.toBeUndefined()
    await expect(signOut()).resolves.toBeUndefined()

    // Ensure no auth client calls were made
    expect(callCounters.signInSocial).toBe(0)
    expect(callCounters.signOut).toBe(0)
    expect(callCounters.updateUser).toBe(0)
    expect(callCounters.useSession).toBe(0)

    // Ensure no-op warnings were logged
    const joined = warnings.join(' | ')
    expect(joined).toContain('no-op')
    expect(joined).toContain('Auth is disabled')
  })
})
