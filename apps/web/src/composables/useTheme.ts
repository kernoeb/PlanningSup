import { createSharedComposable, useColorMode } from '@vueuse/core'
import { useUserPrefsSync } from '@web/composables/useUserPrefsSync'
import { computed } from 'vue'

export type UiTheme = 'light' | 'dracula' | 'black'
export const AVAILABLE_THEMES: readonly UiTheme[] = ['light', 'dracula', 'black'] as const

// i18n labels hoisted to avoid recreating per call
export const I18N_THEMES = {
  system: 'Système',
  light: 'Clair',
  dracula: 'Dracula',
  black: 'Noir',
} as const

/**
 * Centralized theme management using VueUse's useColorMode
 *
 * - data-theme attribute: 'light' | 'black' | 'dracula' (for DaisyUI)
 * - .is-dark class: added for 'black' and 'dracula' (for Schedule X and custom CSS)
 * - "auto" mode chooses between dark (mapped to 'black') and light
 */

function useTheme() {
  const mode = useColorMode<'dracula'>({
    selector: 'html',
    attribute: 'data-theme',
    storageKey: 'settings.theme',
    // Map the attribute values directly so DaisyUI receives a valid theme name.
    // Here, dark -> "black" to match our DaisyUI custom theme.
    modes: {
      dark: 'black',
      light: 'light',
      dracula: 'dracula',
    },
    // Use the default handler to apply the attribute and disable transitions,
    // then toggle our custom .is-dark flag for dark-like themes.
    onChanged: (next, defaultHandler) => {
      defaultHandler(next)
      if (typeof document === 'undefined') return
      const el = document.documentElement
      if (next === 'dark' || next === 'dracula') el.classList.add('is-dark')
      else el.classList.remove('is-dark')
    },
  })

  // Applied theme name as used by DaisyUI (light | black | dracula).
  // Note: when reading, mode.value returns the resolved mode (dark|light|dracula),
  // so we only need to map 'dark' -> 'black' for display and consumers.
  const theme = computed<UiTheme>(() =>
    mode.value === 'dark' ? 'black' : (mode.value as UiTheme),
  )

  // Darkness flag for consumers like Schedule X.
  const isDark = computed<boolean>(() => mode.value === 'dark' || mode.value === 'dracula')

  // i18n labels (hoisted module-level)
  const i18nThemes = I18N_THEMES

  // Programmatic switching to an explicit theme.
  function setTheme(next: UiTheme) {
    mode.value = next === 'black' ? 'dark' : next
  }

  // Switch back to system preference (auto).
  function setAuto() {
    mode.value = 'auto'
  }

  // Early init to minimize FOUC. Apply the current mode to the DOM immediately.
  function init() {
    console.log('Initializing theme')
    if (typeof document === 'undefined') return
    const el = document.documentElement
    const current = mode.value as 'dark' | 'light' | 'dracula'
    const themeAttr = current === 'dark' ? 'black' : current
    el.setAttribute('data-theme', themeAttr)
    if (current === 'dark' || current === 'dracula') el.classList.add('is-dark')
    else el.classList.remove('is-dark')
  }

  const { syncPref } = useUserPrefsSync()
  syncPref('theme', theme, {
    toServer: t => t,
    normalizeLocal: t => t,
    normalizeServer: t => t,
    fromServerToLocal: (raw) => {
      const v = String(raw) as UiTheme
      return v === 'light' || v === 'dracula' || v === 'black' ? v : null
    },
    setLocal: t => setTheme(t),
    debounce: 500,
    preferServerOnLoad: true,
    localStorageKey: 'settings.theme',
    isLocalDefault: () => {
      if (typeof window === 'undefined') return false
      return window.localStorage.getItem('settings.theme') === null
    },
  })

  return {
    // Applied theme (light | black | dracula)
    theme,
    // Darkness flag
    isDark,
    // Labels and helpers
    i18nThemes,
    setTheme,
    setAuto,
    // Expose the underlying useColorMode return for advanced cases
    mode,
    // FOUC prevention
    init,
  }
}

export const useSharedTheme = createSharedComposable(useTheme)
