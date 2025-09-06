import { authClient } from '@libs'
import { computed, watch } from 'vue'

const session = authClient.useSession()

watch(
  () => session.value.isPending,
  (isPending) => {
    if (!isPending && !session.value.data) {
      authClient.signIn.anonymous().catch(console.error)
    }
  },
  { immediate: true },
)

async function signInDiscord() {
  const data = await authClient.signIn.social({
    provider: 'discord',
  })
  console.log('signInDiscord', data)
}

async function signInGithub() {
  const data = await authClient.signIn.social({
    provider: 'github',
  })
  console.log('signInGithub', data)
}

async function signOut() {
  await authClient.signOut()
  await authClient.signIn.anonymous()
}

const isAnonymous = computed(() => {
  return session.value.data?.user?.isAnonymous ?? false
})

/**
 * Ensures there's an authenticated session (anonymous if needed) and exposes the session ref.
 *
 * Usage:
 * const { session } = useAuth()
 * // session.value contains { isPending, data, error, ... }
 */
export function useAuth() {
  return {
    session,
    isAnonymous,
    signInDiscord,
    signInGithub,
    signOut,
  }
}
