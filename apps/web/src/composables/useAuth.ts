import { authClient } from '@libs'
import { computed, ref } from 'vue'

const AUTH_ENABLED = String(import.meta.env.VITE_ENABLE_AUTH ?? 'false').toLowerCase() === 'true'

const session = AUTH_ENABLED
  ? authClient.useSession()
  : ref<{ isPending: boolean, data: null, error: null }>({
      isPending: false,
      data: null,
      error: null,
    })

// Auth optional mode: no automatic anonymous sign-in

async function signInDiscord() {
  if (!AUTH_ENABLED) {
    console.warn('Auth is disabled; signInDiscord is a no-op.')
    return
  }
  const data = await authClient.signIn.social({
    provider: 'discord',
  })
  console.log('signInDiscord', data)
}

async function signInGithub() {
  if (!AUTH_ENABLED) {
    console.warn('Auth is disabled; signInGithub is a no-op.')
    return
  }
  const data = await authClient.signIn.social({
    provider: 'github',
  })
  console.log('signInGithub', data)
}

async function signOut() {
  if (!AUTH_ENABLED) {
    console.warn('Auth is disabled; signOut is a no-op.')
    return
  }
  await authClient.signOut()
}

const isAnonymous = computed(() => false)

/**
 * Ensures there's an authenticated session when auth is enabled and exposes the session ref.
 *
 * Usage:
 * const { session } = useAuth()
 * // session.value contains { isPending, data, error, ... }
 */
export function useAuth() {
  return {
    authEnabled: AUTH_ENABLED,
    session,
    isAnonymous,
    signInDiscord,
    signInGithub,
    signOut,
  }
}
