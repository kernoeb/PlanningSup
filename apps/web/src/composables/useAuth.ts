import { authClient } from '@libs'
import { watch } from 'vue'

/**
 * Ensures there's an authenticated session (anonymous if needed) and exposes the session ref.
 *
 * Usage:
 * const { session } = useAuth()
 * // session.value contains { isPending, data, error, ... }
 */
export function useAuth() {
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

  return { session }
}
