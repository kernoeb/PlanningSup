import { authClient } from '@libs'
import { isTauri } from '@tauri-apps/api/core'
import { ref } from 'vue'

const AUTH_ENABLED = globalThis.__APP_CONFIG__?.authEnabled ?? import.meta.env?.VITE_AUTH_ENABLED === 'true'
console.log('AUTH_ENABLED', AUTH_ENABLED)

const IS_TAURI = isTauri()

// @ts-expect-error browser/chrome
const IS_EXTENSION = !!(globalThis.browser || globalThis.chrome)?.runtime?.id

console.log('IS_TAURI', IS_TAURI)
console.log('IS_EXTENSION', IS_EXTENSION)

const session = AUTH_ENABLED
  ? authClient.useSession()
  : ref<{ isPending: boolean, data: null, error: null }>({
      isPending: false,
      data: null,
      error: null,
    })

if (IS_TAURI) {
  console.log('Setting up Tauri deep link handler')
  const { onOpenUrl } = await import('@tauri-apps/plugin-deep-link')
  console.log('onOpenUrl', !!onOpenUrl)

  await onOpenUrl(async (urls) => {
    console.log('Received deep link URLs:', urls)
    if (!urls || urls.length === 0) return
    const url = urls[0]
    if (!url) return
    console.log('onOpenUrl', url)

    if (url.startsWith('planningsup://auth-callback/')) { // e.g. planningsup://auth-callback/discord?code=...&state=...
      if (!AUTH_ENABLED) {
        console.warn('Auth disabled; ignoring OAuth callback.')
        return
      }

      console.log('Handling auth callback URL:', url)

      try {
        // Extract the callback data from the URL
        const urlObj = new URL(url)

        // Parse provider from path: "/auth-callback/<provider>"
        const provider = urlObj.pathname.split('/')[1]
        if (!provider || /^[^a-z]+$/i.test(provider)) {
          console.warn('Missing provider in auth callback URL:', urlObj.toString())
          return
        }

        // Hit the server callback endpoint to complete the OAuth exchange and set cookies
        const callbackUrl = new URL(`${import.meta.env.VITE_BACKEND_URL}/api/auth/callback/${provider}${urlObj.search}`)
        callbackUrl.searchParams.set('client', 'tauri')

        console.log('Fetching OAuth callback URL:', callbackUrl)

        await fetch(callbackUrl, {
          method: 'GET',
          credentials: 'include',
          // Some providers may 302; we only need cookies, not to follow UI redirects
          redirect: 'manual',
          headers: { accept: 'application/json' },
        })

        window.location.reload()
      } catch (error) {
        console.error('Error processing OAuth callback:', error)
      }
    }
  })

  console.log('Tauri deep link handler set up')
} else if (IS_EXTENSION) {
  if (!AUTH_ENABLED) {
    console.warn('Auth disabled; ignoring OAuth callback.')
    throw new Error('Auth is disabled; extension OAuth callback handler will not be set up.')
  }

  console.log('Setting up extension message listener')
  const { default: browser } = await import('webextension-polyfill')

  browser.runtime.onMessage.addListener(async (message: any) => {
    console.log('[useAuth.ts] onMessage', message)
    if (message.type !== 'authCallback') return

    if (!message.provider || /^[^a-z]+$/i.test(message.provider)) {
      console.warn('Missing provider in auth callback message:', message)
      return
    }
    if (!message.code) {
      console.warn('Missing code in auth callback message:', message)
      return
    }
    if (!message.state) {
      console.warn('Missing state in auth callback message:', message)
      return
    }

    // Hit the server callback endpoint to complete the OAuth exchange and set cookies
    const callbackUrl = new URL(`${import.meta.env.VITE_BACKEND_URL}/api/auth/callback/${message.provider}`)
    callbackUrl.searchParams.set('code', message.code)
    callbackUrl.searchParams.set('state', message.state)
    callbackUrl.searchParams.set('client', 'extension')

    console.log('Fetching OAuth callback URL:', callbackUrl)

    try {
      await fetch(callbackUrl, {
        method: 'GET',
        credentials: 'include',
        // Some providers may 302; we only need cookies, not to follow UI redirects
        redirect: 'manual',
        headers: { accept: 'application/json' },
      })
    } catch {
      // Ignore errors; we just want the cookies to be set
    }

    window.location.reload()
  })
}

// const forceSignIn = new URLSearchParams(window.location.search).get('forceSignIn') === 'true'
// if (forceSignIn) signInDiscord()

const client = (() => {
  if (IS_TAURI) return 'tauri'
  if (IS_EXTENSION) return 'extension'
  return 'web'
})()

async function signInDiscord() {
  if (!AUTH_ENABLED) {
    console.warn('Auth is disabled; signInDiscord is a no-op.')
    return
  }

  const { data, error } = await authClient.signIn.social({
    provider: 'discord',
    callbackURL: `${window.location.origin}?client=${client}`,
    disableRedirect: true,
  })

  if (error) throw new Error(error.message)
  const url = data?.url
  if (!url) throw new Error('No authorization URL returned')

  if (IS_TAURI) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
  } else if (IS_EXTENSION) {
    const { default: browser } = await import('webextension-polyfill')
    browser.runtime.sendMessage({ type: 'openUrl', url })
  } else {
    window.location.href = url
  }
}

async function signInGithub() {
  if (!AUTH_ENABLED) {
    console.warn('Auth is disabled; signInGithub is a no-op.')
    return
  }

  const { data, error } = await authClient.signIn.social({
    provider: 'github',
    callbackURL: `${window.location.origin}?client=${client}`,
    disableRedirect: true,
  })

  if (error) throw new Error(error.message)
  const url = data?.url
  if (!url) throw new Error('No authorization URL returned')

  if (IS_TAURI) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
  } else if (IS_EXTENSION) {
    const { default: browser } = await import('webextension-polyfill')
    browser.runtime.sendMessage({ type: 'openUrl', url })
  } else {
    window.location.href = url
  }
}

async function signOut() {
  if (!AUTH_ENABLED) {
    console.warn('Auth is disabled; signOut is a no-op.')
    return
  }
  await authClient.signOut()
}

// Passkeys are only supported on web (not Tauri/extension)
const IS_WEB = !IS_TAURI && !IS_EXTENSION
const PASSKEY_SUPPORTED = AUTH_ENABLED && IS_WEB

/**
 * Check if passkey (WebAuthn) is supported in the current browser
 */
function isPasskeyAvailable(): boolean {
  return PASSKEY_SUPPORTED && !!window.PublicKeyCredential
}

/**
 * Check if Conditional UI (autofill) is supported in the current browser
 */
async function isConditionalUIAvailable(): Promise<boolean> {
  if (!isPasskeyAvailable()) return false
  try {
    return await PublicKeyCredential.isConditionalMediationAvailable?.() ?? false
  } catch {
    return false
  }
}

/**
 * Register a new passkey for the currently authenticated user
 */
async function addPasskey(name?: string) {
  if (!PASSKEY_SUPPORTED) {
    console.warn('Passkeys are not supported in this environment.')
    return { data: null, error: { message: 'Passkeys are not supported' } }
  }
  return authClient.passkey.addPasskey({ name })
}

/**
 * Sign in with a passkey
 * @param autoFill - If true, uses Conditional UI (browser autofill)
 */
async function signInPasskey(autoFill = false) {
  if (!PASSKEY_SUPPORTED) {
    console.warn('Passkeys are not supported in this environment.')
    return { data: null, error: { message: 'Passkeys are not supported' } }
  }
  return authClient.signIn.passkey({ autoFill })
}

/**
 * Get the reactive passkey list store for the currently authenticated user.
 * Returns a Vue ref with { data, error, isPending, refetch }.
 */
function usePasskeyList() {
  if (!PASSKEY_SUPPORTED) {
    return ref({ data: null, error: { message: 'Passkeys are not supported' }, isPending: false, refetch: () => {} })
  }
  return authClient.useListPasskeys()
}

/**
 * Delete a passkey by ID
 */
async function deletePasskey(id: string) {
  if (!PASSKEY_SUPPORTED) {
    console.warn('Passkeys are not supported in this environment.')
    return { data: null, error: { message: 'Passkeys are not supported' } }
  }
  return authClient.passkey.deletePasskey({ id })
}

/**
 * Update a passkey's name
 */
async function updatePasskey(id: string, name: string) {
  if (!PASSKEY_SUPPORTED) {
    console.warn('Passkeys are not supported in this environment.')
    return { data: null, error: { message: 'Passkeys are not supported' } }
  }
  return authClient.passkey.updatePasskey({ id, name })
}

/**
 * Ensures there's an authenticated session when auth is enabled and exposes the session ref.
 *
 * Usage:
 * const { session } = useAuth()
 * // session.value contains { isPending, data, error, ... }
 */
export function useAuth() {
  return {
    authEnabled: AUTH_ENABLED,
    session,
    signInDiscord,
    signInGithub,
    signOut,
    // Passkey methods (web only)
    passkeySupported: PASSKEY_SUPPORTED,
    isPasskeyAvailable,
    isConditionalUIAvailable,
    addPasskey,
    signInPasskey,
    usePasskeyList,
    deletePasskey,
    updatePasskey,
  }
}
