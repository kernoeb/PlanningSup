import type { auth } from '@api/utils/auth'
import { inferAdditionalFields } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'

const baseURL = import.meta.env.VITE_BACKEND_URL
console.log('Auth client baseURL:', baseURL || 'Not set, using relative URLs')

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    inferAdditionalFields<typeof auth>(),
  ],
})
