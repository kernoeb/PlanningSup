import type { auth } from '@api/utils/auth'
import { anonymousClient, inferAdditionalFields } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields<typeof auth>(),
    anonymousClient(),
  ],
})
