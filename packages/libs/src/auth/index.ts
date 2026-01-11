import type { BetterAuthInstance } from '@api/utils/auth'
import { passkeyClient } from '@better-auth/passkey/client'
import { inferAdditionalFields } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'

const baseURL = import.meta.env.VITE_BACKEND_URL
console.log('Auth client baseURL:', baseURL || 'Not set, using relative URLs')

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    inferAdditionalFields<BetterAuthInstance>(),
    passkeyClient(),
  ],
})
