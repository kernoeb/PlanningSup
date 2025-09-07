import { authClient } from '@libs'
import { computed, ref, watch } from 'vue'

const session = authClient.useSession()

// A simple flag to prevent multiple sign-in attempts from ever starting.
const signInAttempted = ref(false)

// Use a standard watch to precisely control the logic.
const stopWatch = watch(
  () => session.value.isPending,
  (isPending) => {
    // We only care about the moment the session is no longer pending.
    if (!isPending) {
      // Check if there's no session data and we haven't tried to sign in yet.
      if (!session.value.data && !signInAttempted.value) {
        console.log('Initial check complete. No session found. Signing in anonymously.')

        // Mark that we are attempting to sign in to prevent loops.
        signInAttempted.value = true

        authClient.signIn.anonymous().catch((err) => {
          console.error('Anonymous sign-in failed:', err)
          // Optional: If you want to allow a retry on a future state change,
          // you could reset the flag here. For most cases, you don't.
          // signInAttempted.value = false;
        })
      }

      // The initial check is done, so we stop the watcher.
      // This is the most robust way to avoid loops and unwanted side effects.
      stopWatch()
    }
  },
  {
    // `immediate: true` is crucial. It ensures the watcher runs right away.
    // If the session is already loaded (`isPending: false`), the logic
    // will execute immediately without waiting for a change.
    immediate: true,
  },
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
