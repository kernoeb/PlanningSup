import { afterAll, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'

/**
 * Tests for the passkey-related exports of useAuth when auth is enabled (web context).
 * Uses _resetForTesting() to re-read __APP_CONFIG__ after the module was cached
 * by web.useAuth.disabled.test.ts with authEnabled=false.
 */

describe('useAuth passkey (authEnabled=true, web)', () => {
  let useAuth: any
  let resetForTesting: any
  const warnings: string[] = []
  const originalWarn = console.warn

  const callCounters = {
    addPasskey: 0,
    signInPasskey: 0,
    deletePasskey: 0,
    updatePasskey: 0,
    useListPasskeys: 0,
  }

  beforeAll(async () => {
    (globalThis as any).__APP_CONFIG__ = { authEnabled: true }

    mock.module('@tauri-apps/api/core', () => ({
      isTauri: () => false,
    }))

    mock.module('@libs', () => ({
      authClient: {
        signIn: {
          social: async () => ({ data: null, error: null }),
          passkey: async (_opts: any) => {
            callCounters.signInPasskey += 1
            return { data: { token: 'mock' }, error: null }
          },
        },
        signOut: async () => {},
        useSession: () => ({ value: { isPending: false, data: null, error: null } }),
        passkey: {
          addPasskey: async (_opts: any) => {
            callCounters.addPasskey += 1
            return { data: { id: 'pk_1' }, error: null }
          },
          deletePasskey: async (_opts: any) => {
            callCounters.deletePasskey += 1
            return { data: {}, error: null }
          },
          updatePasskey: async (_opts: any) => {
            callCounters.updatePasskey += 1
            return { data: {}, error: null }
          },
        },
        useListPasskeys: () => {
          callCounters.useListPasskeys += 1
          return { value: { data: [], error: null, isPending: false } }
        },
      },
      client: {},
    }))

    // eslint-disable-next-line no-console
    console.warn = (...args: any[]) => {
      try {
        warnings.push(args.map(String).join(' '))
      } catch {
        warnings.push('warn:unserializable')
      }
      return undefined as unknown as void
    }

    const mod = await import('@web/composables/useAuth')
    useAuth = mod.useAuth
    resetForTesting = mod._resetForTesting

    // Re-read __APP_CONFIG__ (may have been cached with authEnabled=false)
    resetForTesting()
  })

  afterAll(() => {
    // eslint-disable-next-line no-console
    console.warn = originalWarn
    mock.restore()
    delete (globalThis as any).__APP_CONFIG__
  })

  beforeEach(() => {
    warnings.length = 0
    callCounters.addPasskey = 0
    callCounters.signInPasskey = 0
    callCounters.deletePasskey = 0
    callCounters.updatePasskey = 0
    callCounters.useListPasskeys = 0
  })

  it('passkeySupported is true when auth is enabled on web', () => {
    const { passkeySupported } = useAuth()
    expect(passkeySupported).toBe(true)
  })

  it('isPasskeyAvailable() returns false (no PublicKeyCredential in Bun)', () => {
    const { isPasskeyAvailable } = useAuth()
    expect(isPasskeyAvailable()).toBe(false)
  })

  it('addPasskey calls through to authClient', async () => {
    const { addPasskey } = useAuth()
    const result = await addPasskey('My Key')
    expect(callCounters.addPasskey).toBe(1)
    expect(result.data).toEqual({ id: 'pk_1' })
  })

  it('signInPasskey calls through to authClient', async () => {
    const { signInPasskey } = useAuth()
    const result = await signInPasskey(false)
    expect(callCounters.signInPasskey).toBe(1)
    expect(result.data).toEqual({ token: 'mock' })
  })

  it('deletePasskey calls through to authClient', async () => {
    const { deletePasskey } = useAuth()
    const result = await deletePasskey('pk_1')
    expect(callCounters.deletePasskey).toBe(1)
    expect(result.error).toBeNull()
  })

  it('updatePasskey calls through to authClient', async () => {
    const { updatePasskey } = useAuth()
    const result = await updatePasskey('pk_1', 'Renamed')
    expect(callCounters.updatePasskey).toBe(1)
    expect(result.error).toBeNull()
  })

  it('usePasskeyList calls through to authClient', () => {
    const { usePasskeyList } = useAuth()
    usePasskeyList()
    expect(callCounters.useListPasskeys).toBe(1)
  })
})
