import type { BetterAuthOptions } from 'better-auth'
import config from '@api/config'
import { db } from '@api/db'
import * as schema from '@api/db/schemas/auth'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { createAuthMiddleware } from 'better-auth/api'
import { customSession } from 'better-auth/plugins'
import * as z from 'zod'
import { colorsInput, customGroupsInput, planningsInput, prefsMetaInput } from './auth-validators'

function createAuth() {
  // Skip BetterAuth initialization entirely when auth is disabled
  if (!config.authEnabled) {
    return null
  }

  const options = {
    appName: 'PlanningSup',
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
        mergeDuplicates: {
          type: 'boolean',
          validator: { input: z.boolean().optional() },
        },
        blocklist: {
          type: 'string[]',
          validator: { input: z.array(z.string()).optional() },
        },
        plannings: {
          type: 'string[]',
          validator: {
            input: planningsInput,
          },
        },
        customGroups: {
          // Stored as a JSON string for type stability across clients.
          // Shape: Array<{ id: string; name: string; plannings: string[] }>
          type: 'string',
          validator: {
            input: customGroupsInput,
          },
        },
        colors: {
          type: 'string',
          validator: {
            // Record<string, string>
            input: colorsInput,
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
            // Shape: Record<'theme' | 'highlightTeacher' | 'showWeekends' | 'mergeDuplicates' | 'blocklist' | 'colors' | 'plannings' | 'customGroups', number>
            input: prefsMetaInput,
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
    plugins: [],
    telemetry: {
      enabled: false,
    },
    trustedOrigins: config.trustedOrigins,
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const state = ctx.query?.state
        const client = ctx.query?.client // e.g. "tauri" or "extension"

        if (!client && ctx.request && ctx.path === '/callback/:id' && state) {
          const data = await ctx.context.internalAdapter.findVerificationValue(state)
          if (data) {
            const parsedData = z
              .object({ callbackURL: z.string() })
              .parse(JSON.parse(data.value))

            if (parsedData.callbackURL) {
              const callbackURL = new URL(parsedData.callbackURL)
              const client = callbackURL.searchParams.get('client')
              if (client === 'tauri' || client === 'extension') {
                // Redirect to our auto-redirect page, which will handle the deep link
                const newUrl = new URL(`${ctx.context.baseURL}/auto-redirect/${ctx.params.id}`)
                // Copy over all search params from the original URL (ctx.request.url)
                const originalUrl = new URL(ctx.request.url)
                for (const [key, value] of originalUrl.searchParams.entries()) {
                  if (key !== 'client') newUrl.searchParams.set(key, value)
                }
                newUrl.searchParams.set('client', client)
                ctx.context.logger.success('Redirecting to auto-redirect URL:', newUrl.toString())
                throw ctx.redirect(newUrl.toString())
              }
            }
          }
        }
      }),
    },
    socialProviders: {
      discord: {
        clientId: config.auth.discord.clientId!,
        clientSecret: config.auth.discord.clientSecret!,
        prompt: 'consent',
      },
      github: {
        clientId: config.auth.github.clientId!,
        clientSecret: config.auth.github.clientSecret!,
        prompt: 'consent',
      },
    },
  } satisfies BetterAuthOptions

  return betterAuth({
    ...options,
    plugins: [
      ...(options.plugins ?? []),
      customSession(async ({ user, session }) => {
        return { user, session }
      }, options),
    ],
  })
}

export const auth = createAuth()

// Type export for client-side type inference (used by @libs/auth)
// This type represents what auth looks like when enabled, for type inference purposes
export type BetterAuthInstance = NonNullable<ReturnType<typeof createAuth>>

export interface AuthType {
  user: BetterAuthInstance extends { $Infer: { Session: { user: infer U } } } ? U | null : null
  session: BetterAuthInstance extends { $Infer: { Session: { session: infer S } } } ? S | null : null
}
