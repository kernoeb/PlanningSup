import { db } from '@api/db'
import * as schema from '@api/db/schemas/auth'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { anonymous } from 'better-auth/plugins'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day (every 1 day the session expiration is updated)
  },
  telemetry: {
    enabled: false,
    disableNotice: true,
  },
  trustedOrigins: ['http://localhost:4444'],
  baseURL: Bun.env.BETTER_AUTH_BASE_URL || 'http://localhost:20000',
  plugins: [anonymous()],
})

export interface AuthType {
  user: typeof auth.$Infer.Session.user | null
  session: typeof auth.$Infer.Session.session | null
}
