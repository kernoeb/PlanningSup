import { db } from '@api/db'
import * as schema from '@api/db/schemas/auth'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { anonymous } from 'better-auth/plugins'

export const auth = betterAuth({
  basePath: '/auth',
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  session: {
    // expires in 30 days
    maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
    // session is updated every 7 days
    updateAge: 7 * 24 * 60 * 60, // 7 days in seconds
  },
  telemetry: {
    enabled: false,
    disableNotice: true,
  },
  trustedOrigins: import.meta.env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:4444'],
  plugins: [anonymous()],
  socialProviders: {
    discord: {
      clientId: Bun.env.DISCORD_CLIENT_ID as string,
      clientSecret: Bun.env.DISCORD_CLIENT_SECRET as string,
    },
    github: {
      clientId: Bun.env.GITHUB_CLIENT_ID as string,
      clientSecret: Bun.env.GITHUB_CLIENT_SECRET as string,
    },
  },
})

export interface AuthType {
  user: typeof auth.$Infer.Session.user | null
  session: typeof auth.$Infer.Session.session | null
}
