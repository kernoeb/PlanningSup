import { createSharedComposable, useColorMode } from '@vueuse/core'
import { useUserPrefsSync } from '@web/composables/useUserPrefsSync'
import { computed } from 'vue'

export const AVAILABLE_THEMES = ['light', 'dracula', 'dark', 'auto'] as const
export type UiTheme = (typeof AVAILABLE_THEMES)[number]

// i18n labels hoisted to avoid recreating per call
export const I18N_THEMES = {
  auto: 'Système',
  light: 'Clair',
  dracula: 'Dracula',
  dark: 'Sombre',
} as const

/**
 * Centralized theme management using VueUse's useColorMode
 *
 * - data-theme attribute: 'light' | 'dark' | 'dracula' (for DaisyUI)
 * - .is-dark class: added for 'dark' and 'dracula' (for Schedule X and custom CSS)
 * - "auto" mode chooses between dark and light
 */

function useTheme() {
  const theme = useColorMode({
    selector: 'html',
    attribute: 'data-theme',
    storageKey: 'settings.theme',
    emitAuto: true,
    modes: {
      dracula: 'dracula',
    },
  })

  // Darkness flag for consumers like Schedule X.
  const isDark = computed<boolean>(() => theme.state.value === 'dark' || theme.state.value === 'dracula')

  function syncFavicon() {
    if (typeof document === 'undefined') return

    const faviconSvgEl = document.querySelector<HTMLLinkElement>('#favicon-svg')
      ?? document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]')

    if (!faviconSvgEl) return

    // Always drive favicon from the browser/OS theme (prefers-color-scheme),
    // so it's visible even when the app theme intentionally differs.
    const prefersDark = globalThis.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false
    const href = prefersDark ? '/favicon.dark.svg' : '/favicon.light.svg'

    // Avoid useless DOM churn (some browsers won't repaint on identical href).
    if (faviconSvgEl.getAttribute('href') === href) return
    faviconSvgEl.setAttribute('href', href)
  }

  // Init + keep in sync with browser theme changes.
  if (typeof window !== 'undefined' && typeof globalThis.matchMedia === 'function') {
    const mql = globalThis.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => syncFavicon()
    // Safari <14 uses addListener/removeListener.
    if (typeof mql.addEventListener === 'function') mql.addEventListener('change', onChange)
    else (mql as any).addListener?.(onChange)
  }

  syncFavicon()

  // Programmatic switching to an explicit theme.
  function setTheme(newTheme: typeof theme.value) {
    theme.value = newTheme
  }

  const { syncPref } = useUserPrefsSync()
  syncPref('theme', theme, {
    fromServerToLocal: (raw) => {
      if (typeof raw === 'string' && AVAILABLE_THEMES.includes(raw as UiTheme)) return raw as UiTheme
      return 'auto'
    },
    setLocal: setTheme,
    debounce: 10,
  })

  return {
    theme,
    isDark,
    i18nThemes: I18N_THEMES,
    setTheme,
  }
}

export const useSharedTheme = createSharedComposable(useTheme)
