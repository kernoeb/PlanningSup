import type { BetterAuthOptions } from 'better-auth'
import { db } from '@api/db'
import * as schema from '@api/db/schemas/auth'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { anonymous, customSession } from 'better-auth/plugins'
import * as z from 'zod'

const options = {
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  user: {
    additionalFields: {
      theme: {
        type: 'string',
        validator: {
          input: z.enum(['dark', 'light', 'dracula', 'auto']).optional(),
        },
      },
      highlightTeacher: {
        type: 'boolean',
        validator: { input: z.boolean().optional() },
      },
      showWeekends: {
        type: 'boolean',
        validator: { input: z.boolean().optional() },
      },
      blocklist: {
        type: 'string[]',
        validator: { input: z.array(z.string()).optional() },
      },
      colors: {
        type: 'string',
        validator: {
          // Record<string, string>
          input: z.string().optional().transform((val) => {
            try {
              const parsed = JSON.parse(val || '{}')
              if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                for (const [key, value] of Object.entries(parsed)) {
                  if (typeof key !== 'string' || typeof value !== 'string') {
                    return '{}'
                  }
                }
                return JSON.stringify(parsed)
              }
              return '{}'
            } catch {
              return '{}'
            }
          }),
        },
      },
      prefsMeta: {
        type: 'string',
        validator: {
          // Authoritative server-side timestamping:
          // - Allowed keys only
          // - If value is a number, keep it as-is
          // - If value is not a number, stamp with Date.now()
          // - Always return normalized JSON string
          // Shape: Record<'theme' | 'highlightTeacher' | 'showWeekends' | 'blocklist' | 'colors', number>
          input: z.string().optional().transform((val) => {
            try {
              const allowed = ['theme', 'highlightTeacher', 'showWeekends', 'blocklist', 'colors'] as const
              const set = new Set<string>(allowed as unknown as string[])
              const raw = JSON.parse(val || '{}')
              if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return '{}'

              const out: Record<string, number> = {}
              const now = Date.now()
              for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
                if (!set.has(key)) continue
                if (typeof value === 'number' && Number.isFinite(value)) {
                  out[key] = value
                } else {
                  // Non-number means: "stamp this key server-side"
                  out[key] = now
                }
              }
              return JSON.stringify(out)
            } catch {
              return '{}'
            }
          }),
        },
      },
    },
  },
  session: {
    // expires in 30 days
    expiresIn: 30 * 24 * 60 * 60, // 30 days in seconds
    // session is updated every 7 days
    updateAge: 7 * 24 * 60 * 60, // 7 days in seconds
  },
  plugins: [
    anonymous(),
  ],
  telemetry: {
    enabled: false,
  },
  trustedOrigins: import.meta.env.NODE_ENV === 'production'
    ? (Bun.env.TRUSTED_ORIGINS as string | undefined)?.split(',').map(s => s.trim()) ?? []
    : ['chrome-extension://fhepfbdpjmlkkjkfbmhhjakenibnjfgn'],
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
} satisfies BetterAuthOptions

export const auth = betterAuth({
  ...options,
  plugins: [
    ...(options.plugins ?? []),
    customSession(async ({ user, session }) => {
      return { user, session }
    }, options),
  ],
})

export interface AuthType {
  user: typeof auth.$Infer.Session.user | null
  session: typeof auth.$Infer.Session.session | null
}
