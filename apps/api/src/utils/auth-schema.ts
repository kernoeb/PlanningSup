import { passkey } from '@better-auth/passkey'
import { betterAuth } from 'better-auth'
import { userAdditionalFields } from './auth-fields'

// Config for `bun run generate-better-auth` only: it holds what shapes the schema and never opens the database.
// Keep the user fields and plugins in sync with auth.ts.
const passkeyPlugin = passkey()
// The plugin only indexes credential_id. WebAuthn credential IDs are unique, and the database enforces it.
Object.assign(passkeyPlugin.schema.passkey.fields.credentialID, { unique: true })

export const auth = betterAuth({
  user: { additionalFields: userAdditionalFields },
  plugins: [passkeyPlugin],
})
